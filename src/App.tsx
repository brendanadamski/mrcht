import { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { onAuthStateChanged, type User } from "firebase/auth";
import exampleProductsCsvUrl from "../example-products.csv?url";
import { demoProducts } from "./data/demoProducts";
import { simulateAgentTurn } from "./lib/agentSimulator";
import { extractRowsFromApiResponse, mapProductRows } from "./lib/normalize";
import {
  getFirebaseServices,
  isFirebaseConfigured,
  saveTrace,
  signInWithGoogle,
  signOutOfFirebase,
  uploadSourceFile
} from "./lib/firebase";
import type { ChatMessage, DataSourceState, Product, TraceEvent } from "./types";

const starterMessages: ChatMessage[] = [
  {
    id: "system-1",
    role: "system",
    content: "This demo loads an ACP-style product feed sample from acp-demo-products.jsonl."
  },
  {
    id: "assistant-1",
    role: "assistant",
    content: "Try: I want to buy a blue shirt."
  }
];

const defaultDataSource: DataSourceState = {
  kind: "demo",
  label: "Demo commerce catalog",
  status: "ready",
  products: demoProducts,
  warnings: []
};

const emptyCustomDataSource: DataSourceState = {
  kind: "file",
  label: "No custom data connected",
  status: "empty",
  products: [],
  warnings: []
};

const examplePrompts = [
  "I want to buy a blue shirt",
  "Compare giftable travel bags under $200",
  "Can I buy the coffee grinder now?",
  "Show me an office chair I can follow up on in chat"
];

const MAX_PREVIEW_PRODUCTS = 3;

const customPromptTemplate = `Generate two files for the OpenAI Agentic Commerce file-upload products spec at https://developers.openai.com/commerce/specs/file-upload/products:
1. A header JSON file with feed_id, account_id, target_merchant, and target_country.
2. A product JSONL file where each line is one product object.

Make 12 realistic products for a single merchant. Every product must include a stable product id and at least one variant. Every variant must include id and title. Use optional fields that improve realism when available, including description.plain, url, media, barcodes, price, list_price, availability, categories, variant_options, seller links, and unit_price where relevant.

Return both files in fenced code blocks and keep the data internally consistent.`;

const toJsonPreview = (value: unknown) => JSON.stringify(value, null, 2);

const productPrice = (product: Product) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: product.currency || "USD" }).format(product.price);

const productImage = (product: Product) => product.image ?? product.media?.[0]?.url ?? product.variants[0]?.media?.[0]?.url ?? "/logo_clean.png";

const productRating = (product: Product) => {
  const seed = Array.from(product.id).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return (4.3 + (seed % 6) * 0.1).toFixed(1);
};

const actionLabel = (product: Product) => {
  if (product.action === "checkout") return "Checkout";
  if (product.action === "test_drive") return "Test drive";
  if (product.action === "lead_form") return "Contact";
  return "Action missing";
};

const availabilityLabel = (availability: Product["availability"]) => availability.replaceAll("_", " ");

const samplePromptForProduct = (product: Product) => {
  const keyword =
    product.tags.find((tag) => !tag.includes(":")) ??
    product.category.split(">").at(-1)?.trim().toLowerCase() ??
    "product";

  if (product.action === "test_drive") return `Show me a ${keyword} I can try before I commit.`;
  if (product.action === "lead_form") return `Find me a ${keyword} and tell me how I would follow up in chat.`;
  return `Find me a ${keyword} I can buy directly in chat.`;
};

const assistantPreviewForProduct = (product: Product) => {
  const availabilityCopy =
    product.availability === "in_stock"
      ? "It is in stock, so the card can include a direct purchase path."
      : product.availability === "limited"
        ? "Inventory is limited, so the chat would likely nudge the user to act soon."
        : product.availability === "out_of_stock"
          ? "It is currently out of stock, so the chat would shift toward follow-up or notification flows."
          : "Inventory is unknown, so the chat would call that out before recommending an action.";

  const actionCopy =
    product.action === "checkout"
      ? `The primary action shown in chat would be "${actionLabel(product)}".`
      : product.action === "test_drive"
        ? `The primary action shown in chat would be "${actionLabel(product)}" to keep the journey consultative.`
        : product.action === "lead_form"
          ? `The primary action shown in chat would be "${actionLabel(product)}" so the customer can request a follow-up.`
          : "This product needs a mapped action before it is ready for a strong in-chat commerce experience.";

  return `${product.title} is a strong fit for this request. ${availabilityCopy} ${actionCopy}`;
};

const resultHeading = (products: Product[]) => {
  if (!products.length) return "Catalog preview";
  return "Product previews";
};

const easeInOutCubic = (progress: number) => (progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2);

const animateWindowScrollToElement = (element: HTMLElement | null, duration = 420) => {
  if (!element) return;

  const startY = window.scrollY;
  const targetY = Math.max(0, element.getBoundingClientRect().top + window.scrollY - 24);
  const distance = targetY - startY;

  if (Math.abs(distance) < 4) return;

  const startTime = performance.now();

  const step = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = easeInOutCubic(progress);

    window.scrollTo({ top: startY + distance * easedProgress, behavior: "auto" });

    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  };

  window.requestAnimationFrame(step);
};

const readUploadedFile = async (file: File) => {
  const text = await file.text();
  if (file.name.toLowerCase().endsWith(".jsonl")) {
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  }

  if (file.name.toLowerCase().endsWith(".json")) {
    const parsed = JSON.parse(text) as unknown;
    return Array.isArray(parsed) ? parsed : extractRowsFromApiResponse(parsed);
  }

  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true
  });

  if (result.errors.length > 0) {
    throw new Error(result.errors.map((error) => error.message).join(", "));
  }

  return result.data;
};

const readDemoFeed = async () => {
  const response = await fetch("/acp-demo-products.jsonl");
  if (!response.ok) throw new Error(`Demo feed responded with ${response.status}`);
  const text = await response.text();

  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
};

const normalizeEndpoint = (value: string) => {
  if (!value.trim()) return "";
  if (/^https?:\/\//i.test(value)) return value.trim();
  return `http://${value.trim()}`;
};

const customStarterMessages: ChatMessage[] = [
  {
    id: "custom-system-1",
    role: "system",
    content: "Connect your own CSV, JSON, localhost API, or public API to start a custom commerce simulation."
  }
];

const getRouteExperience = () => {
  const hash = window.location.hash;
  const pathname = window.location.pathname.replace(/\/+$/, "") || "/";

  if (hash === "#/custom" || pathname === "/custom") return "custom";
  if (hash === "#/resources" || pathname === "/resources") return "resources";
  return "demo";
};

function App() {
  const [cardView, setCardView] = useState<"vertical" | "horizontal">("vertical");
  const [experience, setExperience] = useState<"demo" | "custom" | "resources">(() => getRouteExperience());
  const [dataSource, setDataSource] = useState<DataSourceState>(() => (getRouteExperience() === "custom" ? emptyCustomDataSource : defaultDataSource));
  const [messages, setMessages] = useState<ChatMessage[]>(() => (getRouteExperience() === "custom" ? customStarterMessages : starterMessages));
  const [prompt, setPrompt] = useState("");
  const [apiEndpoint, setApiEndpoint] = useState("http://localhost:8787/mock-api/products");
  const [traces, setTraces] = useState<TraceEvent[]>([]);
  const [activeTraceId, setActiveTraceId] = useState<string | null>(null);
  const [isLoadingApi, setIsLoadingApi] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authNotice, setAuthNotice] = useState("");
  const [isHeaderCompact, setIsHeaderCompact] = useState(false);
  const [isAgentThinking, setIsAgentThinking] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedPreviewProducts, setSelectedPreviewProducts] = useState<Product[]>([]);
  const [isCustomPreviewLoading, setIsCustomPreviewLoading] = useState(false);
  const [isSelectedProductsHovered, setIsSelectedProductsHovered] = useState(false);
  const [checkoutProduct, setCheckoutProduct] = useState<Product | null>(null);
  const [completedActionProductId, setCompletedActionProductId] = useState<string | null>(null);
  const [cardCursor, setCardCursor] = useState<{ x: number; y: number } | null>(null);
  const [isDrawerJsonVisible, setIsDrawerJsonVisible] = useState(false);
  const [isDrawerTraceVisible, setIsDrawerTraceVisible] = useState(false);
  const conversationRef = useRef<HTMLDivElement | null>(null);
  const customPreviewChatRef = useRef<HTMLElement | null>(null);
  const customPreviewGridRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const firebase = getFirebaseServices();
    if (!firebase) return undefined;

    return onAuthStateChanged(firebase.auth, setAuthUser);
  }, []);

  useEffect(() => {
    const updateHeader = () => setIsHeaderCompact(window.scrollY > 96);
    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });

    return () => window.removeEventListener("scroll", updateHeader);
  }, []);

  useEffect(() => {
    const applyRoute = () => {
      const nextExperience = getRouteExperience();
      setExperience(nextExperience);
      setDataSource(nextExperience === "custom" ? emptyCustomDataSource : defaultDataSource);
      setMessages(nextExperience === "custom" ? customStarterMessages : starterMessages);
      setTraces([]);
      setActiveTraceId(null);
      setSelectedProduct(null);
      setSelectedPreviewProducts([]);
      setIsCustomPreviewLoading(false);
      setCheckoutProduct(null);
      setCompletedActionProductId(null);
      setIsDrawerJsonVisible(false);
      setIsDrawerTraceVisible(false);
      setPrompt("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    applyRoute();
    window.addEventListener("hashchange", applyRoute);
    window.addEventListener("popstate", applyRoute);
    return () => {
      window.removeEventListener("hashchange", applyRoute);
      window.removeEventListener("popstate", applyRoute);
    };
  }, []);

  useEffect(() => {
    if (experience !== "demo") return;

    let isCancelled = false;
    setDataSource((current) => ({
      ...current,
      label: "ACP demo feed upload",
      status: "loading"
    }));

    void readDemoFeed()
      .then((rows) => {
        if (isCancelled) return;
        const mapped = mapProductRows(rows);
        setDataSource({
          kind: "demo",
          label: "ACP demo feed upload: acp-demo-products.jsonl",
          status: "ready",
          products: mapped.products,
          warnings: [
            "Demo feed is loaded from a local JSONL upload sample. Production delivery would use SFTP with stable filenames.",
            ...mapped.warnings
          ]
        });
      })
      .catch((error) => {
        if (isCancelled) return;
        setDataSource({
          ...defaultDataSource,
          warnings: [error instanceof Error ? error.message : "Could not load demo feed; using fallback products."]
        });
      });

    return () => {
      isCancelled = true;
    };
  }, [experience]);

  useEffect(() => {
    const conversation = conversationRef.current;
    if (!conversation) return;

    conversation.scrollTo({ top: conversation.scrollHeight, behavior: "smooth" });
    requestAnimationFrame(() => {
      conversation.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }, [messages, isAgentThinking]);

  const activeTrace = useMemo(
    () => traces.find((trace) => trace.id === activeTraceId) ?? traces[0] ?? null,
    [activeTraceId, traces]
  );
  const customSandboxProducts = useMemo(() => dataSource.products.slice(0, 10), [dataSource.products]);
  const isCustomExperience = experience === "custom";
  const isResourcesExperience = experience === "resources";
  const isDemoExperience = experience === "demo";
  const needsGoogleLogin = isCustomExperience && isFirebaseConfigured && !authUser;
  const hasConnectedData = dataSource.products.length > 0 && dataSource.status === "ready";
  const hasDemoChat = !isCustomExperience && messages.some((message) => message.role === "user");

  const catalogHealth = useMemo(() => {
    const missingActions = dataSource.products.filter((product) => product.action === "none").length;
    const unknownAvailability = dataSource.products.filter((product) => product.availability === "unknown").length;
    const categories = new Set(dataSource.products.map((product) => product.category)).size;

    return { missingActions, unknownAvailability, categories };
  }, [dataSource.products]);

  useEffect(() => {
    if (!isCustomExperience || !hasConnectedData) return;

    setSelectedPreviewProducts((current) => {
      const validProducts = current.filter((product) => customSandboxProducts.some((candidate) => candidate.id === product.id));
      if (validProducts.length > 0) return validProducts.slice(0, MAX_PREVIEW_PRODUCTS);
      return customSandboxProducts.slice(0, 1);
    });
  }, [customSandboxProducts, hasConnectedData, isCustomExperience]);

  useEffect(() => {
    if (!isCustomExperience) return;
    setSelectedProduct(selectedPreviewProducts[0] ?? null);
  }, [isCustomExperience, selectedPreviewProducts]);

  useEffect(() => {
    if (!isCustomExperience) return;
    if (selectedPreviewProducts.length === 0) {
      setIsCustomPreviewLoading(false);
      return;
    }

    setIsCustomPreviewLoading(true);
    const timeoutId = window.setTimeout(() => {
      setIsCustomPreviewLoading(false);
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [isCustomExperience, selectedPreviewProducts]);

  const handleFileUpload = async (file: File | null) => {
    if (!file) return;
    setDataSource((current) => ({ ...current, kind: "file", status: "loading", label: file.name }));

    try {
      const rows = await readUploadedFile(file);
      const mapped = mapProductRows(rows);
      await uploadSourceFile(authUser, file);

      setDataSource({
        kind: "file",
        label: file.name,
        status: "ready",
        products: mapped.products,
        warnings: mapped.warnings
      });
    } catch (error) {
      setDataSource({
        kind: "file",
        label: file.name,
        status: "error",
        products: [],
        warnings: [error instanceof Error ? error.message : "Could not parse file."]
      });
    }
  };

  const connectApi = async () => {
    const endpoint = normalizeEndpoint(apiEndpoint);
    if (!endpoint) return;

    setIsLoadingApi(true);
    setDataSource((current) => ({ ...current, kind: "api", status: "loading", endpoint, label: endpoint }));

    try {
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error(`API responded with ${response.status}`);
      const payload = (await response.json()) as unknown;
      const rows = extractRowsFromApiResponse(payload);
      if (rows.length === 0) throw new Error("Could not find a products/items/results/data array in the response.");
      const mapped = mapProductRows(rows);

      setDataSource({
        kind: "api",
        label: endpoint,
        status: "ready",
        products: mapped.products,
        endpoint,
        warnings: mapped.warnings
      });
    } catch (error) {
      setDataSource({
        kind: "api",
        label: endpoint,
        status: "error",
        products: [],
        endpoint,
        warnings: [error instanceof Error ? error.message : "Could not connect to API."]
      });
    } finally {
      setIsLoadingApi(false);
    }
  };

  const sendPrompt = async (text = prompt) => {
    const trimmed = text.trim();
    if (!trimmed || dataSource.products.length === 0 || isAgentThinking) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed
    };
    setMessages((current) => [...current, userMessage]);
    setPrompt("");
    setIsAgentThinking(true);

    window.setTimeout(() => {
      const { assistantMessage, trace } = simulateAgentTurn(trimmed, dataSource.products);

      setMessages((current) => [...current, assistantMessage]);
      setTraces((current) => [trace, ...current]);
      setActiveTraceId(trace.id);
      setIsAgentThinking(false);

      void saveTrace(authUser, trace).catch(() => {
        setAuthNotice("Trace stayed local because Firestore rejected the write.");
      });
    }, 900);
  };

  const handleGoogleLogin = async () => {
    setAuthNotice("");
    try {
      await signInWithGoogle();
    } catch (error) {
      setAuthNotice(error instanceof Error ? error.message : "Google sign-in failed.");
    }
  };

  const handleSignOut = async () => {
    await signOutOfFirebase();
  };

  const customPreviewPrompt =
    selectedPreviewProducts.length > 1
      ? `Compare these ${selectedPreviewProducts.length} options and tell me which one I can buy directly in chat.`
      : selectedProduct
        ? samplePromptForProduct(selectedProduct)
        : "";
  const customPreviewHeading =
    selectedPreviewProducts.length > 1
      ? `${selectedPreviewProducts.length} selected products`
      : selectedProduct
        ? selectedProduct.title
        : "Select up to 3 products";
  const customPreviewMessages = selectedProduct
    ? [
        {
          id: `preview-user-${selectedProduct.id}`,
          role: "user" as const,
          content: customPreviewPrompt
        },
        {
          id: `preview-assistant-${selectedProduct.id}`,
          role: "assistant" as const,
          content:
            selectedPreviewProducts.length > 1
              ? `These ${selectedPreviewProducts.length} products are strong matches for the request. In chat, they should render together so the user can compare fit, price, and next action without leaving the thread.`
              : assistantPreviewForProduct(selectedProduct),
          products: selectedPreviewProducts
        },
        {
          id: `preview-user-followup-${selectedProduct.id}`,
          role: "user" as const,
          content: "Thanks!"
        }
      ]
    : [];
  const selectedProductLowLevelData = selectedPreviewProducts.length
    ? selectedPreviewProducts.map((product) => ({
        header: product.header,
        product: {
          id: product.id,
          title: product.title,
          description: product.description,
          category: product.category,
          action: product.action
        },
        media: product.media ?? [],
        seller: product.seller ?? null,
        unit_price: product.unitPrice ?? null,
        variants: product.variants,
        raw: product.raw ?? null
      }))
    : null;

  const navigateTo = (nextExperience: "demo" | "custom" | "resources") => {
    const nextPath = nextExperience === "custom" ? "/custom" : nextExperience === "resources" ? "/resources" : "/";
    if (window.location.pathname === nextPath) return;
    setExperience(nextExperience);
    window.history.pushState({}, "", nextPath);
  };
  const scrollToCustomPreviewChat = () => {
    animateWindowScrollToElement(customPreviewChatRef.current, 480);
  };
  const scrollToCustomPreviewGrid = () => {
    animateWindowScrollToElement(customPreviewGridRef.current, 480);
  };
  const handleCustomProductSelect = (product: Product, element?: HTMLElement | null) => {
    let nextSelectionCount = 0;
    let isAddingSelection = false;

    setSelectedPreviewProducts((current) => {
      const isSelected = current.some((item) => item.id === product.id);
      isAddingSelection = !isSelected;
      const nextSelection = isSelected ? current.filter((item) => item.id !== product.id) : [...current, product].slice(-MAX_PREVIEW_PRODUCTS);
      nextSelectionCount = nextSelection.length;
      return nextSelection;
    });

    if (isAddingSelection && nextSelectionCount === MAX_PREVIEW_PRODUCTS) {
      window.requestAnimationFrame(() => {
        scrollToCustomPreviewChat();
      });
    }
  };
  const handleGenerateRandomPrompt = () => {
    const nextPrompt = examplePrompts[Math.floor(Math.random() * examplePrompts.length)] ?? "";
    setPrompt(nextPrompt);
  };
  const customCheckoutDetail = checkoutProduct ? (
    <aside className="chatgpt-inline-detail" aria-label="Checkout preview">
      <div className="chatgpt-inline-detail-topline">
        <p className="eyebrow">Product detail</p>
        <button
          type="button"
          className="ghost-button"
          onClick={() => {
            setCheckoutProduct(null);
            setCompletedActionProductId(null);
          }}
        >
          Close
        </button>
      </div>
      <div className="chatgpt-inline-detail-image">
        <img src={productImage(checkoutProduct)} alt="" />
      </div>
      <h3>{checkoutProduct.title}</h3>
      <p className="drawer-price">{productPrice(checkoutProduct)}</p>
      <p>{checkoutProduct.description}</p>
      <div className="chatgpt-inline-detail-meta">
        <span>{checkoutProduct.category}</span>
        <span>{availabilityLabel(checkoutProduct.availability)}</span>
      </div>
      {completedActionProductId === checkoutProduct.id && (
        <div className="purchase-complete">
          <strong>{checkoutProduct.action === "checkout" ? "Purchase complete" : "Action complete"}</strong>
          <p>
            {checkoutProduct.action === "test_drive"
              ? "Test drive request created."
              : checkoutProduct.action === "lead_form"
                ? "Follow-up request sent."
                : "Simulated checkout completed successfully."}
          </p>
        </div>
      )}
      {completedActionProductId !== checkoutProduct.id && (
        <button type="button" onClick={() => setCompletedActionProductId(checkoutProduct.id)}>
          {actionLabel(checkoutProduct)}
        </button>
      )}
    </aside>
  ) : null;

  const customWorkspace = (
    <>
      <div className={`custom-top-row ${hasConnectedData ? "chat-active" : ""}`}>
        <section className="chat-panel custom-chat-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">2. Sample chat</p>
              <h2>{hasConnectedData ? "Chat preview" : "Waiting for data"}</h2>
            </div>
            <div className="card-view-toggle" aria-label="Product card layout">
              <button type="button" className={cardView === "vertical" ? "active" : ""} onClick={() => setCardView("vertical")}>
                Vertical
              </button>
              <button type="button" className={cardView === "horizontal" ? "active" : ""} onClick={() => setCardView("horizontal")}>
                Horizontal
              </button>
            </div>
          </div>

          {hasConnectedData ? (
            <section
              className={`chatgpt-preview-shell ${checkoutProduct ? "has-inline-detail" : ""} ${isSelectedProductsHovered ? "highlight-selected-preview" : ""}`}
              aria-label="Sample chat preview"
              ref={customPreviewChatRef}
            >
              <div className="chatgpt-preview-header">
                <div>
                  <p className="eyebrow">Selected product</p>
                  <h3>{customPreviewHeading}</h3>
                </div>
                <p>This is how up to three selected products can appear inside a chat-style shopping response.</p>
              </div>

              <div className="chatgpt-preview-body">
                <div className="chatgpt-preview-main">
                  <div className="chatgpt-thread">
                    {isCustomPreviewLoading ? (
                      <article className="message assistant thinking preview-message">
                        <span>ChatGPT</span>
                        <p>Reviewing the selected products and preparing the preview...</p>
                      </article>
                    ) : (
                      customPreviewMessages.map((message) => (
                        <article key={message.id} className={`message ${message.role} preview-message`}>
                          {message.role === "assistant" && <span>ChatGPT</span>}
                          <p>{message.content}</p>
                          {message.products && message.products.length > 0 && (
                            <div className={`chatgpt-product-card-list ${cardView === "horizontal" ? "is-horizontal" : "is-vertical"}`}>
                              {message.products.slice(0, MAX_PREVIEW_PRODUCTS).map((product) => (
                                <div
                                  key={product.id}
                                  className={`chatgpt-product-card ${cardView === "horizontal" ? "is-horizontal" : ""}`}
                                  onClick={() => {
                                    setCheckoutProduct(product);
                                    setCompletedActionProductId(null);
                                    setIsDrawerJsonVisible(false);
                                    setIsDrawerTraceVisible(false);
                                  }}
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(event) => {
                                    if (event.key !== "Enter" && event.key !== " ") return;
                                    event.preventDefault();
                                    setCheckoutProduct(product);
                                    setCompletedActionProductId(null);
                                    setIsDrawerJsonVisible(false);
                                    setIsDrawerTraceVisible(false);
                                  }}
                                >
                                  <div className="chatgpt-product-category">{product.category}</div>
                                  <div className="chatgpt-product-image">
                                    <img src={productImage(product)} alt="" />
                                  </div>
                                  <div className="chatgpt-product-copy">
                                    <div className="chatgpt-product-topline">
                                      <strong>{product.title}</strong>
                                      <span>{productPrice(product)}</span>
                                    </div>
                                    <p>{product.description}</p>
                                    <div className="commerce-meta">
                                      <span>{availabilityLabel(product.availability)}</span>
                                    </div>
                                    <div className="chatgpt-product-footer">
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setCheckoutProduct(product);
                                          setCompletedActionProductId(null);
                                          setIsDrawerJsonVisible(false);
                                          setIsDrawerTraceVisible(false);
                                        }}
                                      >
                                        {actionLabel(product)}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </article>
                      ))
                    )}
                  </div>

                  <div className="chatgpt-composer" aria-hidden="true">
                    <input value={customPreviewPrompt} readOnly />
                    <button type="button" disabled>
                      Send
                    </button>
                  </div>
                </div>

                {customCheckoutDetail}
              </div>
            </section>
          ) : (
            <div className="empty-trace custom-empty-state">
              <strong>Connect a product source to begin</strong>
              <p>Once data is loaded, the sample chat will render here and the preview grid will appear below.</p>
              <p className="empty-state-kicker">Get started quick</p>
              <div className="empty-state-actions">
                <button
                  type="button"
                  className="ghost-button download-link"
                  onClick={() => {
                    const link = document.createElement("a");
                    link.href = exampleProductsCsvUrl;
                    link.download = "example-products.csv";
                    link.click();
                  }}
                >
                  Download sample CSV
                </button>
                <span className="empty-state-or">or</span>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(customPromptTemplate);
                  }}
                >
                  Copy ChatGPT prompt
                </button>
              </div>
              <div className="empty-state-prompt">
                <span>Starter prompt</span>
                <pre>{customPromptTemplate}</pre>
              </div>
            </div>
          )}

          {authNotice && <p className="auth-notice">{authNotice}</p>}
        </section>

        <aside className="source-panel custom-source-panel">
          <div className="panel-heading">
            <p className="eyebrow">1. Custom data</p>
            <h2>{hasConnectedData ? "Logs & data" : "Connect data"}</h2>
          </div>

          {needsGoogleLogin ? (
            <div className="login-gate">
              <strong>Google login required</strong>
              <p>Sign in to use the custom sandbox, save traces, and persist uploaded sources.</p>
              <button type="button" onClick={handleGoogleLogin}>
                Continue with Google
              </button>
            </div>
          ) : (
            <>
              {!hasConnectedData && (
                <>
                  <p className="source-intro">Connect your own CSV, JSON, localhost endpoint, or public catalog API. The chat unlocks after data is ready.</p>

                  <div className="source-actions single">
                    <label className="file-picker">
                      Upload CSV/JSON
                      <input type="file" accept=".csv,.json,.jsonl,application/json,text/csv,application/x-ndjson" onChange={(event) => void handleFileUpload(event.target.files?.[0] ?? null)} />
                    </label>
                  </div>

                  <div className="api-box">
                    <label htmlFor="apiEndpoint">Local or public API</label>
                    <input
                      id="apiEndpoint"
                      value={apiEndpoint}
                      onChange={(event) => setApiEndpoint(event.target.value)}
                      placeholder="http://localhost:8787/mock-api/products"
                    />
                    <button type="button" onClick={() => void connectApi()} disabled={isLoadingApi}>
                      {isLoadingApi ? "Connecting..." : "Connect API"}
                    </button>
                  </div>
                </>
              )}

              <div className="source-status">
                <span className={`status-dot ${dataSource.status}`} />
                <div>
                  <strong>{dataSource.label}</strong>
                  <p>{dataSource.products.length} products ready</p>
                </div>
              </div>

              {hasConnectedData && (
                <>
                  <div className="health-grid">
                    <div>
                      <strong>{catalogHealth.categories}</strong>
                      <span>Categories</span>
                    </div>
                    <div>
                      <strong>{catalogHealth.unknownAvailability}</strong>
                      <span>Unknown stock</span>
                    </div>
                    <div>
                      <strong>{catalogHealth.missingActions}</strong>
                      <span>Missing actions</span>
                    </div>
                  </div>

                  <button type="button" className="ghost-button reset-source" onClick={() => setDataSource(emptyCustomDataSource)}>
                    Connect another source
                  </button>

                  <div className="left-log-panel">
                    <div className="panel-heading compact">
                      <p className="eyebrow">3. Selection</p>
                      <h2>{customSandboxProducts.length} preview cards</h2>
                    </div>

                    <section
                      className="trace-block preview-jump-block"
                      role="button"
                      tabIndex={0}
                      onClick={scrollToCustomPreviewGrid}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        scrollToCustomPreviewGrid();
                      }}
                    >
                      <span>Preview behavior</span>
                      <p>The preview grid now sits below this top row so you can scan products and chat at the same time.</p>
                      <p>Select up to {MAX_PREVIEW_PRODUCTS} products below to update the sample chat.</p>
                    </section>

                    {selectedProduct ? (
                      <>
                        <section
                          className="trace-block selected-products-block"
                          onMouseEnter={() => setIsSelectedProductsHovered(true)}
                          onMouseLeave={() => setIsSelectedProductsHovered(false)}
                        >
                          <span>Selected products</span>
                          <strong>{selectedPreviewProducts.length === 1 ? selectedProduct.title : `${selectedPreviewProducts.length} products selected`}</strong>
                          <p>{productPrice(selectedProduct)} · {availabilityLabel(selectedProduct.availability)}</p>
                          <p>Selections are capped at {MAX_PREVIEW_PRODUCTS} and render together in the sample chat.</p>
                        </section>

                        <section className="trace-block low-level-data-block">
                          <span>Low-level data</span>
                          <pre>{toJsonPreview(selectedProductLowLevelData)}</pre>
                        </section>
                      </>
                    ) : (
                      <div className="empty-trace">
                        <strong>No product selected</strong>
                        <p>Connect a source, then pick up to three products from the grid below to open the sample chat preview.</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </aside>
      </div>

      {hasConnectedData ? (
        <section className="custom-grid-panel" ref={customPreviewGridRef}>
          {dataSource.warnings.length > 0 && (
            <div className="warning-list">
              <strong>Readiness notes</strong>
              {dataSource.warnings.slice(0, 4).map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          )}
          <section className="sandbox-grid-section" aria-label="Custom sandbox product gallery">
            <div className="sandbox-grid-topline">
              <div className="sandbox-grid-titleline">
                <h3>{resultHeading(customSandboxProducts)}</h3>
                {selectedPreviewProducts.length > 0 && (
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      setSelectedPreviewProducts([]);
                      setSelectedProduct(null);
                      setCheckoutProduct(null);
                      setCompletedActionProductId(null);
                    }}
                  >
                    Clear preview
                  </button>
                )}
              </div>
              <div className="sandbox-grid-actions">
                <p>Showing {customSandboxProducts.length} generated previews from the connected catalog. Select up to {MAX_PREVIEW_PRODUCTS} cards to load them into the sample chat.</p>
              </div>
            </div>
            <div className="sandbox-product-grid">
              {customSandboxProducts.map((product) => (
                <button
                  type="button"
                  key={product.id}
                  className={`sandbox-product-card ${selectedPreviewProducts.some((item) => item.id === product.id) ? "active" : ""}`}
                  onClick={(event) => handleCustomProductSelect(product, event.currentTarget)}
                >
                  <div className="sandbox-product-image">
                    <img src={productImage(product)} alt="" />
                  </div>
                  <div className="sandbox-product-copy">
                    <strong>{product.title}</strong>
                    <p>
                      <strong>{productPrice(product)}</strong> · {product.description}
                    </p>
                  </div>
                  <div className="commerce-rating sandbox-rating">
                    <span>★ {productRating(product)}</span>
                  </div>
                  <div className="sandbox-product-meta">
                    <span>{availabilityLabel(product.availability)}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </section>
      ) : null}
    </>
  );

  const demoWorkspace = (
    <section className="chat-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">2. Demo chat</p>
          <h2>{hasConnectedData ? "Shopping flow" : "Waiting for data"}</h2>
        </div>
        <div className="card-view-toggle" aria-label="Product card layout">
          <button type="button" className={cardView === "vertical" ? "active" : ""} onClick={() => setCardView("vertical")}>
            Vertical
          </button>
          <button type="button" className={cardView === "horizontal" ? "active" : ""} onClick={() => setCardView("horizontal")}>
            Horizontal
          </button>
        </div>
      </div>

      <div className="prompt-strip">
        {examplePrompts.map((example) => (
          <button type="button" key={example} onClick={() => void sendPrompt(example)} disabled={!hasConnectedData || needsGoogleLogin}>
            {example}
          </button>
        ))}
      </div>

      <div className="conversation" aria-live="polite" ref={conversationRef}>
        {messages.map((message) => (
          <article key={message.id} className={`message ${message.role}`}>
            {message.role !== "user" && <span>{message.role === "assistant" ? "ChatGPT" : message.selectedTool ?? message.role}</span>}
            <p>{message.content}</p>
            {message.products && message.products.length > 0 && (
              <div className="commerce-results" aria-label="Agentic commerce product results">
                <div className="commerce-divider" />
                <h3>{resultHeading(message.products)}</h3>
                <div className="commerce-grid">
                  {message.products.slice(0, MAX_PREVIEW_PRODUCTS).map((product) => (
                    <article
                      key={product.id}
                      className="commerce-card"
                      onClick={() => {
                        setSelectedProduct(product);
                        setIsDrawerJsonVisible(false);
                        setIsDrawerTraceVisible(false);
                      }}
                      onMouseMove={(event) => setCardCursor({ x: event.clientX, y: event.clientY })}
                      onMouseLeave={() => setCardCursor(null)}
                    >
                      <div className="commerce-image">
                        <img src={productImage(product)} alt="" />
                      </div>
                      <div className="commerce-card-body">
                        <div className="commerce-card-topline">
                          <strong>{product.title}</strong>
                        </div>
                        <p>
                          <strong>{productPrice(product)}</strong> · {product.description}
                        </p>
                        <div className="commerce-rating">
                          <span>★ {productRating(product)}</span>
                        </div>
                        <div className="commerce-meta subtle">
                          <span>{availabilityLabel(product.availability)}</span>
                        </div>
                        <div className="commerce-actions">
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedProduct(product);
                              setCompletedActionProductId(null);
                              setIsDrawerTraceVisible(false);
                              setIsDrawerJsonVisible(false);
                            }}
                          >
                            {actionLabel(product)}
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
                <div className="commerce-summary">
                  <p>These are the strongest matches from the connected catalog.</p>
                  <ul>
                    <li>Best fit: {message.products[0]?.title}</li>
                    <li>Next action: {message.products[0] ? actionLabel(message.products[0]) : "Review mapping"}</li>
                  </ul>
                </div>
              </div>
            )}
          </article>
        ))}
        {isAgentThinking && (
          <article className="message assistant thinking">
            <span>agent</span>
            <p>Searching the connected catalog and preparing commerce cards...</p>
          </article>
        )}
      </div>

      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          void sendPrompt();
        }}
      >
        <input
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder={hasConnectedData ? "Ask: Find products for a city commuter with checkout or test drive..." : "Connect data on the left to start chatting..."}
          disabled={!hasConnectedData || needsGoogleLogin}
        />
        <button type="submit" disabled={!hasConnectedData || needsGoogleLogin || isAgentThinking}>
          {isAgentThinking ? "Working..." : "Run agent"}
        </button>
      </form>

      {authNotice && <p className="auth-notice">{authNotice}</p>}
    </section>
  );

  const resourcesWorkspace = (
    <section className="chat-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Resources</p>
          <h2>Documentation & links</h2>
        </div>
      </div>
      <div className="empty-trace">
        <strong>Documentation hub</strong>
        <p>Use this page for implementation notes, sample files, and links to related websites for the commerce sandbox.</p>
      </div>

      <section className="trace-block">
        <span>Getting started</span>
        <strong>How to use the sandbox</strong>
        <p>Start in Home demo to see the simulated shopping flow, then move to Custom sandbox to upload your own CSV, JSON, JSONL, or connect a local API.</p>
        <p>Use the sample files below if you want a quick starting point before bringing in your own catalog.</p>
      </section>

      <section className="trace-block">
        <span>Sample files</span>
        <strong>Local reference data</strong>
        <p><a href="/example-products.csv">Example products CSV</a></p>
        <p><a href="/acp-demo-products.jsonl">ACP demo products JSONL</a></p>
        <p><a href="/acp-demo-header.json">ACP demo header JSON</a></p>
      </section>

      <section className="trace-block">
        <span>Documentation</span>
        <strong>Specs and implementation references</strong>
        <p><a href="https://developers.openai.com/commerce/specs/file-upload/products" target="_blank" rel="noreferrer">OpenAI file-upload products spec</a></p>
        <p><a href="https://developers.openai.com/commerce/" target="_blank" rel="noreferrer">OpenAI commerce docs</a></p>
        <p><a href="https://developers.openai.com/" target="_blank" rel="noreferrer">OpenAI developer docs</a></p>
      </section>

      <section className="trace-block">
        <span>Related sites</span>
        <strong>Useful external links</strong>
        <p><a href="https://platform.openai.com/" target="_blank" rel="noreferrer">OpenAI Platform</a></p>
        <p><a href="https://chatgpt.com/" target="_blank" rel="noreferrer">ChatGPT</a></p>
        <p><a href="https://github.com/" target="_blank" rel="noreferrer">GitHub</a></p>
      </section>
    </section>
  );

  const productDrawer = !isCustomExperience && selectedProduct ? (
    <aside className="product-drawer" aria-label="Product detail panel">
      <div className="drawer-controls">
        <button type="button" className="ghost-button" onClick={() => setIsDrawerJsonVisible((current) => !current)}>
          {isDrawerJsonVisible ? "Hide data" : "View data"}
        </button>
        <button type="button" className="ghost-button" onClick={() => setIsDrawerTraceVisible((current) => !current)} disabled={!activeTrace}>
          {isDrawerTraceVisible ? "Hide trace" : "View trace"}
        </button>
        <button
          type="button"
          className="ghost-button"
          onClick={() => {
            if (isCustomExperience) {
              setCheckoutProduct(null);
              return;
            }

            setSelectedProduct(null);
          }}
        >
          Close
        </button>
      </div>
      <div className="drawer-image">
        <img src={productImage(selectedProduct)} alt="" />
      </div>
      <p className="eyebrow">Product detail</p>
      <h2>{selectedProduct.title}</h2>
      <p className="drawer-price">{productPrice(selectedProduct)}</p>
      <p>{selectedProduct.description}</p>
      <div className="commerce-meta">
        <span>{selectedProduct.category}</span>
        <span>{availabilityLabel(selectedProduct.availability)}</span>
        <span>{selectedProduct.action.replaceAll("_", " ")}</span>
      </div>
      <div className="drawer-section">
        <strong>Agent mapping</strong>
        <p>This item maps to product discovery, availability checks, and the {actionLabel(selectedProduct).toLowerCase()} action.</p>
      </div>
      {completedActionProductId === selectedProduct.id ? (
        <div className="purchase-complete">
          <strong>{selectedProduct.action === "checkout" ? "Purchase complete" : "Action complete"}</strong>
          <p>{selectedProduct.action === "test_drive" ? "Test drive request created." : selectedProduct.action === "lead_form" ? "Follow-up request sent." : "Simulated checkout completed successfully."}</p>
        </div>
      ) : (
        <button type="button" onClick={() => setCompletedActionProductId(selectedProduct.id)}>
          {actionLabel(selectedProduct)}
        </button>
      )}
      {isDrawerJsonVisible && (
        <div className="drawer-json-overlay">
          <div className="card-json-topline">
            <strong>Product JSON</strong>
            <button type="button" className="ghost-button" onClick={() => setIsDrawerJsonVisible(false)}>
              Close
            </button>
          </div>
          <pre>{toJsonPreview(selectedProduct.raw ?? selectedProduct)}</pre>
        </div>
      )}
      {isDrawerTraceVisible && activeTrace && (
        <div className="drawer-json-overlay">
          <div className="card-json-topline">
            <strong>Trace JSON</strong>
            <button type="button" className="ghost-button" onClick={() => setIsDrawerTraceVisible(false)}>
              Close
            </button>
          </div>
          <pre>{toJsonPreview(activeTrace)}</pre>
        </div>
      )}
    </aside>
  ) : null;

  if (isCustomExperience) {
    return (
      <main className="app-shell">
        <header className="custom-page-header">
          <div className="custom-header-brand">
            <img src="/logo_clean.png" alt="" className="brand-mark" />
            <div>
              <p className="eyebrow">Agentic commerce</p>
              <h1>Custom sandbox</h1>
            </div>
          </div>
          <div className="experience-switch custom-header-switch" aria-label="Workbench mode compact">
            <button type="button" onClick={() => navigateTo("demo")}>
              Home demo
            </button>
            <button type="button" className="active" onClick={() => navigateTo("custom")}>
              Custom sandbox
            </button>
            <button type="button" onClick={() => navigateTo("resources")}>
              Resources
            </button>
          </div>
          <div className="custom-header-auth">
            {authUser ? (
              <div className="profile-login-card">
                {authUser.photoURL ? <img src={authUser.photoURL} alt="" className="profile-avatar-image" /> : <span className="profile-avatar">G</span>}
                <div className="profile-login-copy">
                  <strong>{authUser.displayName ?? "Signed in"}</strong>
                  <button type="button" className="ghost-button" onClick={handleSignOut}>
                    Sign out
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="profile-login-button" onClick={handleGoogleLogin}>
                <span className="profile-avatar">G</span>
                <span>Google login</span>
              </button>
            )}
          </div>
        </header>

        <section className="workspace custom-workspace" aria-label="Agentic commerce simulator">
          {customWorkspace}
        </section>

        {cardCursor && <div className="cursor-tail" style={{ left: cardCursor.x, top: cardCursor.y }} />}
      </main>
    );
  }

  if (isResourcesExperience) {
    return (
      <main className="app-shell">
        <div className="auth-card global-auth">
          {authUser ? (
            <>
              <span>{authUser.displayName ?? authUser.email}</span>
              <button type="button" className="ghost-button" onClick={handleSignOut}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <span>{isFirebaseConfigured ? "Firebase ready" : "Local mode"}</span>
              <button type="button" className="ghost-button" onClick={handleGoogleLogin}>
                Google login
              </button>
            </>
          )}
        </div>

        <header className="page-hero">
          <div className="brand-lockup">
            <img src="/logo_clean.png" alt="" className="brand-mark" />
            <div>
              <h1>MRCHT</h1>
              <p className="eyebrow">Open-source agentic commerce workbench</p>
            </div>
          </div>
          <div className="experience-switch" aria-label="Workbench mode">
            <button type="button" onClick={() => navigateTo("demo")}>
              Home demo
            </button>
            <button type="button" onClick={() => navigateTo("custom")}>
              Custom sandbox
            </button>
            <button type="button" className="active" onClick={() => navigateTo("resources")}>
              Resources
            </button>
          </div>
        </header>

        <header className={`compact-dock ${isHeaderCompact ? "visible" : ""}`} aria-hidden={!isHeaderCompact}>
          <div className="brand-lockup">
            <img src="/logo_clean.png" alt="" className="brand-mark" />
            <div>
              <p className="eyebrow">Agentic commerce</p>
              <h1>Resources</h1>
            </div>
          </div>
          <div className="experience-switch" aria-label="Workbench mode compact">
            <button type="button" onClick={() => navigateTo("demo")}>
              Home demo
            </button>
            <button type="button" onClick={() => navigateTo("custom")}>
              Custom sandbox
            </button>
            <button type="button" className="active" onClick={() => navigateTo("resources")}>
              Resources
            </button>
          </div>
        </header>

        <section className="workspace home-workspace" aria-label="Agentic commerce resources">
          {resourcesWorkspace}
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div className="auth-card global-auth">
        {authUser ? (
          <>
            <span>{authUser.displayName ?? authUser.email}</span>
            <button type="button" className="ghost-button" onClick={handleSignOut}>
              Sign out
            </button>
          </>
        ) : (
          <>
            <span>{isFirebaseConfigured ? "Firebase ready" : "Local mode"}</span>
            <button type="button" className="ghost-button" onClick={handleGoogleLogin}>
              Google login
            </button>
          </>
        )}
      </div>

      {isDemoExperience && (
        <header className="page-hero">
          <div className="brand-lockup">
            <img src="/logo_clean.png" alt="" className="brand-mark" />
            <div>
              <h1>MRCHT</h1>
              <p className="eyebrow">Open-source agentic commerce workbench</p>
            </div>
          </div>
          <div className="experience-switch" aria-label="Workbench mode">
            <button type="button" className="active" onClick={() => navigateTo("demo")}>
              Home demo
            </button>
            <button type="button" onClick={() => navigateTo("custom")}>
              Custom sandbox
            </button>
            <button type="button" onClick={() => navigateTo("resources")}>
              Resources
            </button>
          </div>
        </header>
      )}

      <header className={`compact-dock ${isHeaderCompact || isCustomExperience ? "visible" : ""}`} aria-hidden={!(isHeaderCompact || isCustomExperience)}>
        <div className="brand-lockup">
          <img src="/logo_clean.png" alt="" className="brand-mark" />
          <div>
            <p className="eyebrow">Agentic commerce</p>
            <h1>{isCustomExperience ? "Custom sandbox" : isResourcesExperience ? "Resources" : "Home demo"}</h1>
          </div>
        </div>
        <div className="experience-switch" aria-label="Workbench mode compact">
          <button type="button" className={isDemoExperience ? "active" : ""} onClick={() => navigateTo("demo")}>
            Home demo
          </button>
          <button type="button" className={isCustomExperience ? "active" : ""} onClick={() => navigateTo("custom")}>
            Custom sandbox
          </button>
          <button type="button" className={isResourcesExperience ? "active" : ""} onClick={() => navigateTo("resources")}>
            Resources
          </button>
        </div>
      </header>

      <section className={`workspace ${isCustomExperience ? "custom-workspace" : "home-workspace"}`} aria-label="Agentic commerce simulator">
        {isCustomExperience && (
          <aside className="source-panel">
            <div className="panel-heading">
              <p className="eyebrow">1. Custom data</p>
              <h2>{hasConnectedData ? "Logs & data" : "Connect data"}</h2>
            </div>

            {needsGoogleLogin ? (
              <div className="login-gate">
                <strong>Google login required</strong>
                <p>Sign in to use the custom sandbox, save traces, and persist uploaded sources.</p>
                <button type="button" onClick={handleGoogleLogin}>
                  Continue with Google
                </button>
              </div>
            ) : (
              <>
                {!hasConnectedData && (
                  <>
                    <p className="source-intro">Connect your own CSV, JSON, localhost endpoint, or public catalog API. The chat unlocks after data is ready.</p>

                    <div className="source-actions single">
                      <label className="file-picker">
                        Upload CSV/JSON
                        <input type="file" accept=".csv,.json,.jsonl,application/json,text/csv,application/x-ndjson" onChange={(event) => void handleFileUpload(event.target.files?.[0] ?? null)} />
                      </label>
                    </div>

                    <div className="api-box">
                      <label htmlFor="apiEndpoint">Local or public API</label>
                      <input
                        id="apiEndpoint"
                        value={apiEndpoint}
                        onChange={(event) => setApiEndpoint(event.target.value)}
                        placeholder="http://localhost:8787/mock-api/products"
                      />
                      <button type="button" onClick={() => void connectApi()} disabled={isLoadingApi}>
                        {isLoadingApi ? "Connecting..." : "Connect API"}
                      </button>
                    </div>
                  </>
                )}

                <div className="source-status">
                  <span className={`status-dot ${dataSource.status}`} />
                  <div>
                    <strong>{dataSource.label}</strong>
                    <p>{dataSource.products.length} products ready</p>
                  </div>
                </div>

                {hasConnectedData && (
                <>
                  <div className="health-grid">
                    <div>
                      <strong>{catalogHealth.categories}</strong>
                      <span>Categories</span>
                    </div>
                    <div>
                      <strong>{catalogHealth.unknownAvailability}</strong>
                      <span>Unknown stock</span>
                    </div>
                    <div>
                      <strong>{catalogHealth.missingActions}</strong>
                      <span>Missing actions</span>
                    </div>
                  </div>

                  <button type="button" className="ghost-button reset-source" onClick={() => setDataSource(emptyCustomDataSource)}>
                    Connect another source
                  </button>

                  {dataSource.warnings.length > 0 && (
                    <div className="warning-list">
                      <strong>Readiness notes</strong>
                      {dataSource.warnings.slice(0, 4).map((warning) => (
                        <p key={warning}>{warning}</p>
                      ))}
                    </div>
                  )}

                  <div className="left-log-panel">
                    <div className="panel-heading compact">
                      <p className="eyebrow">2. Sandbox output</p>
                      <h2>{customSandboxProducts.length} preview cards</h2>
                    </div>

                    <section className="trace-block">
                      <span>Preview behavior</span>
                      <p>The custom sandbox now generates a gallery of up to ten products from the connected source.</p>
                      <p>Click any product on the right to see a sample ChatGPT-style response with that item rendered as the featured card.</p>
                    </section>

                    {selectedProduct ? (
                      <section className="trace-block">
                        <span>Selected product</span>
                        <strong>{selectedProduct.title}</strong>
                        <p>{productPrice(selectedProduct)} · {availabilityLabel(selectedProduct.availability)}</p>
                        <p>Primary action: {actionLabel(selectedProduct)}</p>
                      </section>
                    ) : (
                      <div className="empty-trace">
                        <strong>No product selected</strong>
                        <p>Connect a source, then pick a product from the gallery to open the sample chat preview.</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
          </aside>
        )}

        <section className={`chat-panel ${isCustomExperience ? "custom-chat-panel" : ""}`}>
          <div className="panel-heading">
            <p className="eyebrow">{isCustomExperience ? "2. Custom chat" : "2. Demo chat"}</p>
            <h2>{hasConnectedData ? (isCustomExperience ? "Product preview grid" : "Shopping flow") : "Waiting for data"}</h2>
          </div>

          {isCustomExperience ? (
            hasConnectedData ? (
              <>
                <section className="sandbox-grid-section" aria-label="Custom sandbox product gallery">
                  <div className="sandbox-grid-topline">
                    <h3>{resultHeading(customSandboxProducts)}</h3>
                    <p>Showing {customSandboxProducts.length} generated previews from the connected catalog. Click a card to load its sample chat.</p>
                  </div>
                  <div className="sandbox-product-grid">
                    {customSandboxProducts.map((product) => (
                      <button
                        type="button"
                        key={product.id}
                        className={`sandbox-product-card ${selectedProduct?.id === product.id ? "active" : ""}`}
                        onClick={() => setSelectedProduct(product)}
                        >
                        <div className="sandbox-product-image">
                          <img src={productImage(product)} alt="" />
                        </div>
                        <div className="sandbox-product-copy">
                          <strong>{product.title}</strong>
                          <p>
                            <strong>{productPrice(product)}</strong> · {product.description}
                          </p>
                        </div>
                        <div className="commerce-rating sandbox-rating">
                          <span>★ {productRating(product)}</span>
                        </div>
                        <div className="sandbox-product-meta">
                          <span>{availabilityLabel(product.availability)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="chatgpt-preview-shell" aria-label="Sample chat preview">
                  <div className="chatgpt-preview-header">
                    <div>
                      <p className="eyebrow">3. Sample chat</p>
                      <h3>{selectedProduct ? selectedProduct.title : "Select a product"}</h3>
                    </div>
                    <p>This is how the selected product can appear inside a chat-style shopping response.</p>
                  </div>

                  <div className="chatgpt-thread">
                    {customPreviewMessages.map((message) => (
                      <article key={message.id} className={`message ${message.role} preview-message`}>
                        {message.role === "assistant" && <span>ChatGPT</span>}
                        <p>{message.content}</p>
                        {message.products && message.products.length > 0 && (
                          <div className="chatgpt-product-card">
                            <div className="chatgpt-product-image">
                              <img src={productImage(message.products[0])} alt="" />
                            </div>
                            <div className="chatgpt-product-copy">
                              <div className="chatgpt-product-topline">
                                <strong>{message.products[0].title}</strong>
                                <span>{productPrice(message.products[0])}</span>
                              </div>
                              <p>{message.products[0].description}</p>
                              <div className="commerce-meta">
                                <span>{message.products[0].category}</span>
                                <span>›</span>
                                <span>{availabilityLabel(message.products[0].availability)}</span>
                              </div>
                              <div className="commerce-rating">
                                <span>★ {productRating(message.products[0])}</span>
                              </div>
                              <div className="chatgpt-product-footer">
                                <button type="button">{actionLabel(message.products[0])}</button>
                              </div>
                            </div>
                          </div>
                        )}
                      </article>
                    ))}
                  </div>

                  <div className="chatgpt-composer" aria-hidden="true">
                    <input value={selectedProduct ? samplePromptForProduct(selectedProduct) : ""} readOnly />
                    <button type="button" disabled>
                      Send
                    </button>
                  </div>
                </section>
              </>
            ) : (
              <div className="empty-trace custom-empty-state">
                <strong>Connect a product source to begin</strong>
                <p>Once data is loaded, the sandbox will generate a grid of up to ten products and open a sample chat preview when you click one.</p>
              </div>
            )
          ) : (
            <>
              <div className="prompt-strip">
                {examplePrompts.map((example) => (
                  <button
                    type="button"
                    key={example}
                    onClick={() => void sendPrompt(example)}
                    disabled={!hasConnectedData || needsGoogleLogin || isAgentThinking}
                  >
                    {example}
                  </button>
                ))}
              </div>

              <div className="conversation" aria-live="polite" ref={conversationRef}>
                {messages.map((message) => (
                  <article key={message.id} className={`message ${message.role}`}>
                    {message.role !== "user" && <span>{message.selectedTool ?? message.role}</span>}
                    <p>{message.content}</p>
                    {message.products && message.products.length > 0 && (
                      <div className="commerce-results" aria-label="Agentic commerce product results">
                        <div className="commerce-divider" />
                        <h3>{resultHeading(message.products)}</h3>
                        <div className="commerce-grid">
                          {message.products.map((product) => (
                            <article
                              key={product.id}
                              className="commerce-card"
                              onClick={() => {
                                setSelectedProduct(product);
                                setIsDrawerJsonVisible(false);
                                setIsDrawerTraceVisible(false);
                              }}
                              onMouseMove={(event) => setCardCursor({ x: event.clientX, y: event.clientY })}
                              onMouseLeave={() => setCardCursor(null)}
                            >
                              <div className="commerce-image">
                                <img src={productImage(product)} alt="" />
                              </div>
                              <div className="commerce-card-body">
                                <div className="commerce-card-topline">
                                  <strong>{product.title}</strong>
                                </div>
                                <p>
                                  <strong>{productPrice(product)}</strong> · {product.description}
                                </p>
                                <div className="commerce-rating">
                                  <span>★ {productRating(product)}</span>
                                </div>
                                <div className="commerce-meta subtle">
                                  <span>{availabilityLabel(product.availability)}</span>
                                </div>
                                <div className="commerce-actions">
                                  <button
                                    type="button"
                                    className="ghost-button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setSelectedProduct(product);
                                      setCompletedActionProductId(null);
                                      setIsDrawerTraceVisible(false);
                                      setIsDrawerJsonVisible(false);
                                    }}
                                  >
                                    {actionLabel(product)}
                                  </button>
                                </div>
                              </div>
                            </article>
                          ))}
                        </div>
                        <div className="commerce-summary">
                          <p>These are the strongest matches from the connected catalog.</p>
                          <ul>
                            <li>Best fit: {message.products[0]?.title}</li>
                            <li>Next action: {message.products[0] ? actionLabel(message.products[0]) : "Review mapping"}</li>
                          </ul>
                        </div>
                      </div>
                    )}
                  </article>
                ))}
                {isAgentThinking && (
                  <article className="message assistant thinking">
                    <span>agent</span>
                    <p>Searching the connected catalog and preparing commerce cards...</p>
                  </article>
                )}
              </div>

              <div className="composer composer-guided-bar" aria-label="Sample chat composer">
                <button
                  type="button"
                  className="composer-readout"
                  onClick={handleGenerateRandomPrompt}
                  disabled={!hasConnectedData || needsGoogleLogin}
                >
                  {prompt || "Generate a sample chat"}
                </button>
                <button
                  type="button"
                  onClick={() => void sendPrompt()}
                  disabled={!hasConnectedData || needsGoogleLogin || isAgentThinking || !prompt.trim()}
                >
                  {isAgentThinking ? "Working..." : "Send chat"}
                </button>
              </div>
            </>
          )}

          {authNotice && <p className="auth-notice">{authNotice}</p>}
        </section>
      </section>

      {productDrawer}

      {cardCursor && <div className="cursor-tail" style={{ left: cardCursor.x, top: cardCursor.y }} />}
    </main>
  );
}

export default App;
