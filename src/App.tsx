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

const demoQuickPrompts = [
  "I want to buy a blue shirt",
  "Compare giftable travel bags under $200",
  "Can I buy the coffee grinder now?",
  "Show me an office chair I can follow up on in chat"
];

const demoRandomPrompts = [
  ...demoQuickPrompts,
  "Compare three travel picks under $200: a duffel, carry-on, and sling bag",
  "Show me three coffee essentials for home brewing under $300",
  "I need a work-from-home setup: desk, chair, and one accessory",
  "Compare two apparel options for daily wear and one for rain",
  "Find two giftable products I can checkout right now",
  "Show one product with checkout and one that needs follow-up",
  "Compare limited-stock products so I can decide quickly",
  "Give me a travel kit: carry-on spinner, duffel, and sling pack",
  "Show me two fitness options and one wearable to track workouts",
  "Recommend a compact audio item and a coffee accessory",
  "Compare kitchen products in horizontal layout",
  "Show travel products in horizontal format and include prices"
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

type MakerAutofillResponse = {
  title?: string;
  description?: string;
  category?: string;
  tags?: string[] | string;
  price?: number | string;
  currency?: string;
  availability?: Product["availability"];
  action?: Product["action"];
};

const makerAutofillEndpoint = import.meta.env.VITE_AUTOFILL_API_URL || "http://localhost:8787/mock-api/autofill-item";
const makerAutofillMaxImageBytes = 350_000;
const makerAutofillMaxDimension = 1024;

const getRouteExperience = () => {
  const hash = window.location.hash;
  const pathname = window.location.pathname.replace(/\/+$/, "") || "/";

  if (hash === "#/custom" || pathname === "/custom") return "custom";
  if (hash === "#/make-my-own-item" || pathname === "/make-my-own-item") return "maker";
  if (hash === "#/resources" || pathname === "/resources") return "resources";
  if (hash === "#/profile" || pathname === "/profile") return "profile";
  return "demo";
};

function App() {
  type TutorialStep = {
    target: "source" | "chat" | "previews" | "terminal";
    title: string;
    description: string;
  };

  type ApiActivityEntry = {
    id: string;
    level: "info" | "ok" | "error";
    line: string;
  };

  const [cardView, setCardView] = useState<"vertical" | "horizontal">("vertical");
  const [experience, setExperience] = useState<"demo" | "custom" | "maker" | "resources" | "profile">(() => getRouteExperience());
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const savedTheme = window.localStorage.getItem("mrcht-theme");
    return savedTheme === "light" ? "light" : "dark";
  });
  const [dataSource, setDataSource] = useState<DataSourceState>(() => (getRouteExperience() === "custom" ? emptyCustomDataSource : defaultDataSource));
  const [messages, setMessages] = useState<ChatMessage[]>(() => (getRouteExperience() === "custom" ? customStarterMessages : starterMessages));
  const [prompt, setPrompt] = useState("");
  const [apiEndpoint, setApiEndpoint] = useState("http://localhost:8787/mock-api/products");
  const [traces, setTraces] = useState<TraceEvent[]>([]);
  const [activeTraceId, setActiveTraceId] = useState<string | null>(null);
  const [isLoadingApi, setIsLoadingApi] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authNotice, setAuthNotice] = useState("");
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
  const [makerTitle, setMakerTitle] = useState("My custom product");
  const [makerDescription, setMakerDescription] = useState("Add your own product copy here so it can render in a chat response.");
  const [makerCategory, setMakerCategory] = useState("Custom > Featured Item");
  const [makerPrice, setMakerPrice] = useState("49.00");
  const [makerCurrency, setMakerCurrency] = useState("USD");
  const [makerAvailability, setMakerAvailability] = useState<Product["availability"]>("in_stock");
  const [makerAction, setMakerAction] = useState<Product["action"]>("checkout");
  const [makerCardView, setMakerCardView] = useState<"vertical" | "horizontal">("horizontal");
  const [makerTags, setMakerTags] = useState("custom, handmade, new");
  const [makerImageUrl, setMakerImageUrl] = useState("");
  const [makerPhotoObjectUrl, setMakerPhotoObjectUrl] = useState<string | null>(null);
  const [isMakerAutofilling, setIsMakerAutofilling] = useState(false);
  const [makerAutofillNotice, setMakerAutofillNotice] = useState("");
  const [makerLastAutofillSource, setMakerLastAutofillSource] = useState("");
  const [apiActivity, setApiActivity] = useState<ApiActivityEntry[]>([]);
  const [isLowLevelExpanded, setIsLowLevelExpanded] = useState(false);
  const [isTerminalExpanded, setIsTerminalExpanded] = useState(false);
  const [isTutorialActive, setIsTutorialActive] = useState(false);
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0);
  const conversationRef = useRef<HTMLDivElement | null>(null);
  const customPreviewChatRef = useRef<HTMLElement | null>(null);
  const customPreviewGridRef = useRef<HTMLElement | null>(null);

  const appendApiActivity = (line: string, level: ApiActivityEntry["level"] = "info") => {
    const now = new Date();
    const timestamp = now.toLocaleTimeString([], { hour12: false });
    const formatted = `[${timestamp}] ${line}`;
    setApiActivity((current) => [...current, { id: crypto.randomUUID(), level, line: formatted }].slice(-60));
    if (level === "error") {
      console.error(`[sandbox api] ${formatted}`);
    } else if (level === "ok") {
      console.info(`[sandbox api] ${formatted}`);
    } else {
      console.log(`[sandbox api] ${formatted}`);
    }
  };

  const logPseudoActionCall = (product: Product) => {
    if (dataSource.kind !== "api") return;

    const actionPath =
      product.action === "test_drive"
        ? "/mock-api/actions/test-drive"
        : product.action === "lead_form"
          ? "/mock-api/actions/lead-form"
          : "/mock-api/actions/checkout";

    let actionUrl = actionPath;
    try {
      const base = dataSource.endpoint || apiEndpoint;
      if (base) actionUrl = `${new URL(base).origin}${actionPath}`;
    } catch {
      actionUrl = actionPath;
    }

    appendApiActivity(`[pseudo] POST ${actionUrl}`);
    appendApiActivity(
      `[pseudo] body: ${JSON.stringify({ id: product.id, variant_id: product.variants[0]?.id ?? null, action: product.action })}`
    );
    appendApiActivity("[pseudo] 200 OK (simulated only, no network request)", "ok");
  };

  useEffect(() => {
    const firebase = getFirebaseServices();
    if (!firebase) return undefined;

    return onAuthStateChanged(firebase.auth, setAuthUser);
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
      setApiActivity([]);
      setIsLowLevelExpanded(false);
      setIsTerminalExpanded(false);
      setIsTutorialActive(false);
      setTutorialStepIndex(0);
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
  const isMakerExperience = experience === "maker";
  const isResourcesExperience = experience === "resources";
  const isProfileExperience = experience === "profile";
  const isDemoExperience = experience === "demo";
  const needsGoogleLogin = (isCustomExperience || isMakerExperience) && isFirebaseConfigured && !authUser;
  const hasConnectedData = dataSource.products.length > 0 && dataSource.status === "ready";
  const hasDemoChat = !isCustomExperience && messages.some((message) => message.role === "user");

  const tutorialSteps = useMemo<TutorialStep[]>(() => {
    const steps: TutorialStep[] = [
      {
        target: "source",
        title: "Connect data",
        description: "Use this box to connect a CSV, JSON, or API source. The sandbox preview and chat are driven by the products loaded here."
      },
      {
        target: "chat",
        title: "Sample chat",
        description: "This box shows how selected products render in a ChatGPT-style response, including action buttons like checkout or contact."
      }
    ];

    if (hasConnectedData) {
      steps.push({
        target: "previews",
        title: "Product previews",
        description: "Pick product cards here to control what appears in the sample chat. You can compare up to three products at a time."
      });
    }

    if (hasConnectedData && dataSource.kind === "api") {
      steps.push({
        target: "terminal",
        title: "Pseudo terminal",
        description: "This panel shows simulated API requests and responses so you can follow the integration flow without firing real action calls."
      });
    }

    return steps;
  }, [dataSource.kind, hasConnectedData]);

  useEffect(() => {
    if (!isTutorialActive) return;
    if (tutorialSteps.length === 0) {
      setIsTutorialActive(false);
      setTutorialStepIndex(0);
      return;
    }
    if (tutorialStepIndex > tutorialSteps.length - 1) {
      setTutorialStepIndex(tutorialSteps.length - 1);
    }
  }, [isTutorialActive, tutorialStepIndex, tutorialSteps]);

  const activeTutorialStep = isTutorialActive ? tutorialSteps[tutorialStepIndex] : null;
  const currentTutorialTarget = activeTutorialStep?.target ?? null;

  const startTutorial = () => {
    if (tutorialSteps.length === 0) return;
    setTutorialStepIndex(0);
    setIsTutorialActive(true);
  };

  const closeTutorial = () => {
    setIsTutorialActive(false);
    setTutorialStepIndex(0);
  };

  const goToNextTutorialStep = () => {
    if (!isTutorialActive) return;
    if (tutorialStepIndex >= tutorialSteps.length - 1) {
      closeTutorial();
      return;
    }
    setTutorialStepIndex((current) => current + 1);
  };

  const goToPrevTutorialStep = () => {
    if (!isTutorialActive) return;
    setTutorialStepIndex((current) => Math.max(0, current - 1));
  };
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
      return validProducts.slice(0, MAX_PREVIEW_PRODUCTS);
    });
  }, [customSandboxProducts, hasConnectedData, isCustomExperience]);

  useEffect(() => {
    if (!isCustomExperience) return;
    setSelectedProduct(selectedPreviewProducts[0] ?? null);
  }, [isCustomExperience, selectedPreviewProducts]);

  useEffect(() => {
    return () => {
      if (makerPhotoObjectUrl) URL.revokeObjectURL(makerPhotoObjectUrl);
    };
  }, [makerPhotoObjectUrl]);

  useEffect(() => {
    if (!isMakerExperience) return;
    const imageUrl = makerImageUrl.trim();
    if (!/^https?:\/\//i.test(imageUrl)) return;
    if (imageUrl === makerLastAutofillSource || isMakerAutofilling) return;

    const timeoutId = window.setTimeout(() => {
      void autofillMakerFieldsFromImage(imageUrl);
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [isMakerAutofilling, isMakerExperience, makerImageUrl, makerLastAutofillSource]);

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

  useEffect(() => {
    if (!isCustomExperience || cardView !== "vertical") return;
    const previewRoot = customPreviewChatRef.current;
    if (!previewRoot) return;

    const verticalLists = previewRoot.querySelectorAll<HTMLElement>(".chatgpt-product-card-list.is-vertical");
    verticalLists.forEach((list) => {
      list.scrollTo({ left: 0, behavior: "auto" });
    });
  }, [isCustomExperience, cardView, selectedPreviewProducts, checkoutProduct]);

  useEffect(() => {
    window.localStorage.setItem("mrcht-theme", theme);
    document.body.classList.toggle("theme-light", theme === "light");
    return () => {
      document.body.classList.remove("theme-light");
    };
  }, [theme]);

  const handleFileUpload = async (file: File | null) => {
    if (!file) return;
    setApiActivity([]);
    setDataSource((current) => ({ ...current, kind: "file", status: "loading", label: file.name }));

    try {
      const rows = await readUploadedFile(file);
      const mapped = mapProductRows(rows);
      let uploadWarning: string | null = null;
      try {
        await uploadSourceFile(authUser, file);
      } catch (uploadError) {
        uploadWarning = uploadError instanceof Error ? uploadError.message : "File loaded locally, but cloud upload failed.";
      }

      setDataSource({
        kind: "file",
        label: file.name,
        status: "ready",
        products: mapped.products,
        warnings: uploadWarning ? [...mapped.warnings, `Cloud upload skipped: ${uploadWarning}`] : mapped.warnings
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

    setApiActivity([]);
    appendApiActivity(`GET ${endpoint}`);
    setIsLoadingApi(true);
    setDataSource((current) => ({ ...current, kind: "api", status: "loading", endpoint, label: endpoint }));

    try {
      const fetchJsonWithLog = async (url: string) => {
        const startedAt = performance.now();
        const response = await fetch(url);
        const durationMs = Math.round(performance.now() - startedAt);
        appendApiActivity(`< ${response.status} ${response.statusText || "OK"} ${url} (${durationMs} ms)`, response.ok ? "ok" : "error");
        if (!response.ok) throw new Error(`API responded with ${response.status} for ${url}`);
        return (await response.json()) as unknown;
      };

      let payload = await fetchJsonWithLog(endpoint);
      const endpointUrl = new URL(endpoint);
      const endpointPath = endpointUrl.pathname.replace(/\/+$/, "");
      const feedMatch = endpointPath.match(/\/product_feeds\/([^/]+)$/);
      const isProductsPath = /\/product_feeds\/[^/]+\/products$/.test(endpointPath);

      if (feedMatch && !isProductsPath) {
        const feedId = decodeURIComponent(feedMatch[1]);
        const productsUrl = `${endpointUrl.origin}/product_feeds/${encodeURIComponent(feedId)}/products`;
        appendApiActivity(`GET ${productsUrl}`);
        payload = await fetchJsonWithLog(productsUrl);
      }

      const rows = extractRowsFromApiResponse(payload);
      appendApiActivity(`Parsed ${rows.length} rows from API payload.`, rows.length > 0 ? "ok" : "error");
      if (rows.length === 0) throw new Error("Could not find a products/items/results/data array in the response.");
      const mapped = mapProductRows(rows);
      appendApiActivity(`Mapped ${mapped.products.length} products for the sandbox.`, "ok");

      setDataSource({
        kind: "api",
        label: endpoint,
        status: "ready",
        products: mapped.products,
        endpoint,
        warnings: mapped.warnings
      });
    } catch (error) {
      appendApiActivity(error instanceof Error ? error.message : "Could not connect to API.", "error");
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
      const followupMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: "Thanks!"
      };

      setMessages((current) => [...current, assistantMessage, followupMessage]);
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

  const dataUrlByteSize = (value: string) => {
    const commaIndex = value.indexOf(",");
    if (commaIndex === -1) return value.length;
    const base64 = value.slice(commaIndex + 1);
    const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
    return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
  };

  const loadImageElement = (source: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Could not load the uploaded image."));
      image.src = source;
    });

  const optimizeImageDataUrlForAutofill = async (dataUrl: string) => {
    const image = await loadImageElement(dataUrl);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not initialize image optimization.");

    const maxSide = Math.max(image.width, image.height) || 1;
    const scale = Math.min(1, makerAutofillMaxDimension / maxSide);
    const targetWidth = Math.max(1, Math.round(image.width * scale));
    const targetHeight = Math.max(1, Math.round(image.height * scale));
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    const qualities = [0.72, 0.62, 0.52, 0.44, 0.34, 0.26];
    for (const quality of qualities) {
      const candidate = canvas.toDataURL("image/jpeg", quality);
      if (dataUrlByteSize(candidate) <= makerAutofillMaxImageBytes) {
        return candidate;
      }
    }

    return canvas.toDataURL("image/jpeg", 0.22);
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

  const navigateTo = (nextExperience: "demo" | "custom" | "maker" | "resources" | "profile") => {
    if (nextExperience === "demo") {
      setSelectedProduct(null);
      setCompletedActionProductId(null);
      setIsDrawerJsonVisible(false);
      setIsDrawerTraceVisible(false);
    }
    if (nextExperience === "custom") {
      setDataSource(emptyCustomDataSource);
      setMessages(customStarterMessages);
      setTraces([]);
      setActiveTraceId(null);
      setSelectedProduct(null);
      setSelectedPreviewProducts([]);
      setIsCustomPreviewLoading(false);
      setCheckoutProduct(null);
      setCompletedActionProductId(null);
      setIsDrawerJsonVisible(false);
      setIsDrawerTraceVisible(false);
      setApiActivity([]);
      setPrompt("");
    }

    const nextPath =
      nextExperience === "custom"
        ? "/custom"
        : nextExperience === "maker"
          ? "/make-my-own-item"
          : nextExperience === "resources"
            ? "/resources"
            : nextExperience === "profile"
              ? "/profile"
            : "/";
    if (window.location.pathname === nextPath) return;
    setExperience(nextExperience);
    window.history.pushState({}, "", nextPath);
  };
  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== "string") {
          reject(new Error("Could not read the uploaded image."));
          return;
        }
        resolve(result);
      };
      reader.onerror = () => reject(new Error("Could not read the uploaded image."));
      reader.readAsDataURL(file);
    });

  const applyMakerAutofill = (payload: MakerAutofillResponse) => {
    const nextTitle = payload.title?.trim();
    const nextDescription = payload.description?.trim();
    const nextCategory = payload.category?.trim();
    const nextCurrency = payload.currency?.trim().toUpperCase();
    const rawPrice = Number(payload.price);
    const nextPrice = Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice.toFixed(2) : "";
    const nextAvailability = payload.availability;
    const nextAction = payload.action;
    const nextTags =
      Array.isArray(payload.tags)
        ? payload.tags.map((tag) => String(tag).trim()).filter(Boolean).join(", ")
        : typeof payload.tags === "string"
          ? payload.tags
          : "";

    if (nextTitle) setMakerTitle(nextTitle);
    if (nextDescription) setMakerDescription(nextDescription);
    if (nextCategory) setMakerCategory(nextCategory);
    if (nextCurrency) setMakerCurrency(nextCurrency);
    if (nextPrice) setMakerPrice(nextPrice);
    if (nextTags) setMakerTags(nextTags);
    if (nextAvailability && ["in_stock", "limited", "out_of_stock", "unknown"].includes(nextAvailability)) {
      setMakerAvailability(nextAvailability);
    }
    if (nextAction && ["checkout", "test_drive", "lead_form", "none"].includes(nextAction)) {
      setMakerAction(nextAction);
    }
  };

  const autofillMakerFieldsFromImage = async (imageSource: string) => {
    if (!imageSource || imageSource === makerLastAutofillSource) return;

    setIsMakerAutofilling(true);
    setMakerAutofillNotice("Analyzing image with ChatGPT and filling fields...");
    try {
      let optimizedImageSource = imageSource;
      if (/^data:image\//i.test(imageSource)) {
        optimizedImageSource = await optimizeImageDataUrlForAutofill(imageSource);
      }

      if (/^data:image\//i.test(optimizedImageSource) && dataUrlByteSize(optimizedImageSource) > makerAutofillMaxImageBytes * 1.35) {
        throw new Error("Image is still too large after optimization. Try a smaller photo.");
      }

      const response = await fetch(makerAutofillEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: optimizedImageSource,
          fields: {
            title: makerTitle,
            description: makerDescription,
            category: makerCategory,
            tags: makerTags,
            price: makerPrice,
            currency: makerCurrency,
            availability: makerAvailability,
            action: makerAction
          }
        })
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(errorPayload.error || `Autofill failed with ${response.status}.`);
      }

      const payload = (await response.json()) as MakerAutofillResponse;
      applyMakerAutofill(payload);
      setMakerLastAutofillSource(imageSource);
      setMakerAutofillNotice("Fields updated from the image.");
    } catch (error) {
      setMakerAutofillNotice(error instanceof Error ? error.message : "Could not autofill from image.");
    } finally {
      setIsMakerAutofilling(false);
    }
  };

  const handleMakerPhotoUpload = async (file: File | null) => {
    if (!file) return;
    if (makerPhotoObjectUrl) URL.revokeObjectURL(makerPhotoObjectUrl);
    const objectUrl = URL.createObjectURL(file);
    setMakerPhotoObjectUrl(objectUrl);
    setMakerImageUrl("");
    try {
      const dataUrl = await readFileAsDataUrl(file);
      await autofillMakerFieldsFromImage(dataUrl);
    } catch (error) {
      setMakerAutofillNotice(error instanceof Error ? error.message : "Could not read uploaded image.");
    }
  };
  const makerResolvedImage = makerImageUrl.trim() || makerPhotoObjectUrl || "/logo_clean.png";
  const isMakerUsingPlaceholderImage = !makerImageUrl.trim() && !makerPhotoObjectUrl;
  const makerPrompt = `Can you show "${makerTitle}" in chat and explain the next action?`;
  const makerItemRecord = {
    id: "SKU-CUSTOM-ITEM-001",
    title: makerTitle.trim() || "Custom item",
    description_plain: makerDescription.trim() || "",
    category_value: makerCategory.trim() || "Custom > Featured Item",
    price_amount: Math.round(Math.max(0, Number(makerPrice) || 0) * 100),
    price_currency: makerCurrency.trim().toUpperCase() || "USD",
    availability_status: makerAvailability,
    action: makerAction,
    tags: makerTags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .join(";"),
    product_media_url: makerResolvedImage
  };
  const downloadMakerJson = () => {
    const blob = new Blob([`${JSON.stringify(makerItemRecord, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "my-custom-item.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };
  const downloadMakerCsv = () => {
    const csv = Papa.unparse([makerItemRecord]);
    const blob = new Blob([`${csv}\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "my-custom-item.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
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

    if (isAddingSelection && dataSource.kind === "api") {
      let detailsUrl = `/mock-api/products/${encodeURIComponent(product.id)}`;
      try {
        const base = dataSource.endpoint || apiEndpoint;
        if (base) detailsUrl = `${new URL(base).origin}/mock-api/products/${encodeURIComponent(product.id)}`;
      } catch {
        detailsUrl = `/mock-api/products/${encodeURIComponent(product.id)}`;
      }

      appendApiActivity(`[pseudo] GET ${detailsUrl}`);
      appendApiActivity(`[pseudo] selecting product ${product.id} for sample chat`);
      appendApiActivity("[pseudo] 200 OK (simulated only, no network request)", "ok");
    }

    if (isAddingSelection && nextSelectionCount === MAX_PREVIEW_PRODUCTS) {
      window.requestAnimationFrame(() => {
        scrollToCustomPreviewChat();
      });
    }
  };
  const handleGenerateRandomPrompt = () => {
    const nextPrompt = demoRandomPrompts[Math.floor(Math.random() * demoRandomPrompts.length)] ?? "";
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
        <button
          type="button"
          onClick={() => {
            logPseudoActionCall(checkoutProduct);
            setCompletedActionProductId(checkoutProduct.id);
          }}
        >
          {actionLabel(checkoutProduct)}
        </button>
      )}
    </aside>
  ) : null;

  const demoCheckoutDetail = (() => {
    if (!selectedProduct) return null;
    const product = selectedProduct;

    return (
      <aside className="chatgpt-inline-detail" aria-label="Checkout preview">
        <div className="chatgpt-inline-detail-topline">
          <p className="eyebrow">Product detail</p>
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              setSelectedProduct(null);
              setCompletedActionProductId(null);
            }}
          >
            Close
          </button>
        </div>
        <div className="chatgpt-inline-detail-image">
          <img src={productImage(product)} alt="" />
        </div>
        <h3>{product.title}</h3>
        <p className="drawer-price">{productPrice(product)}</p>
        <p>{product.description}</p>
        <div className="chatgpt-inline-detail-meta">
          <span>{product.category}</span>
          <span>{availabilityLabel(product.availability)}</span>
        </div>
        {completedActionProductId === product.id && (
          <div className="purchase-complete">
            <strong>{product.action === "checkout" ? "Purchase complete" : "Action complete"}</strong>
            <p>
              {product.action === "test_drive"
                ? "Test drive request created."
                : product.action === "lead_form"
                  ? "Follow-up request sent."
                  : "Simulated checkout completed successfully."}
            </p>
          </div>
        )}
        {completedActionProductId !== product.id && (
          <button
            type="button"
            onClick={() => {
              logPseudoActionCall(product);
              setCompletedActionProductId(product.id);
            }}
          >
            {actionLabel(product)}
          </button>
        )}
      </aside>
    );
  })();

  const authControl = authUser ? (
    <button type="button" className="profile-avatar-button" aria-label="Open profile" onClick={() => navigateTo("profile")}>
      {authUser.photoURL ? <img src={authUser.photoURL} alt="Profile" className="profile-avatar-image" /> : <span className="profile-avatar">G</span>}
    </button>
  ) : (
    <button type="button" className="profile-login-button" onClick={handleGoogleLogin}>
      <span className="profile-avatar">G</span>
      <span>Log in with Google</span>
    </button>
  );

  const customWorkspace = (
    <>
      <div className={`custom-top-row ${hasConnectedData ? "chat-active" : ""}`}>
        <section
          className={`chat-panel custom-chat-panel tutorial-target ${currentTutorialTarget === "chat" ? "tutorial-highlight" : ""} ${isCustomPreviewLoading ? "is-loading-fields" : ""}`}
        >
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

          {!needsGoogleLogin && hasConnectedData ? (
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
          ) : needsGoogleLogin ? (
            <div className="empty-trace custom-empty-state">
              <strong>Google login required</strong>
              <p>Sign in to view sandbox products and sample chat previews.</p>
            </div>
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

        <aside
          className={`source-panel custom-source-panel tutorial-target ${currentTutorialTarget === "source" ? "tutorial-highlight" : ""} ${isLowLevelExpanded ? "low-level-column-focus" : ""}`}
        >
          <div className="panel-heading">
            <p className="eyebrow">1. Custom data</p>
            <h2>{hasConnectedData ? "Logs & data" : "Connect data"}</h2>
          </div>

          {needsGoogleLogin ? (
            <div className="login-gate">
              <strong>Google login required</strong>
              <p>Sign in to use the sandbox, save traces, and persist uploaded sources.</p>
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

                  <div className={`left-log-panel ${isLowLevelExpanded ? "low-level-focus" : ""}`}>
                    <div className="panel-heading compact">
                      <p className="eyebrow">3. Selection</p>
                      <h2>{customSandboxProducts.length} Product lab cards</h2>
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
                      <span>Sample chat preview</span>
                      <p>The product grid stays below this panel so you can review items while keeping the chat visible.</p>
                      <p>Select up to {MAX_PREVIEW_PRODUCTS} products to render them together in the sample chat.</p>
                    </section>

                    {selectedProduct ? (
                      <>
                        <section
                          className="trace-block selected-products-block"
                          onMouseEnter={() => setIsSelectedProductsHovered(true)}
                          onMouseLeave={() => setIsSelectedProductsHovered(false)}
                        >
                          <span>Current selection</span>
                          <strong>{selectedPreviewProducts.length === 1 ? selectedProduct.title : `${selectedPreviewProducts.length} products selected`}</strong>
                          <p>{productPrice(selectedProduct)} · {availabilityLabel(selectedProduct.availability)}</p>
                          <p>Up to {MAX_PREVIEW_PRODUCTS} selected products can appear together in one sample chat response.</p>
                        </section>

                        <section className={`trace-block low-level-data-block ${isLowLevelExpanded ? "is-expanded" : ""}`}>
                          <div className="panel-expand-header">
                            <span>Low-level data</span>
                            <button type="button" className="ghost-button panel-expand-button" onClick={() => setIsLowLevelExpanded((current) => !current)}>
                              {isLowLevelExpanded ? "⤡ Collapse" : "⤢ Expand"}
                            </button>
                          </div>
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

      {!needsGoogleLogin && hasConnectedData ? (
        <section
          className={`custom-grid-panel tutorial-target ${currentTutorialTarget === "previews" ? "tutorial-highlight" : ""} ${isTerminalExpanded ? "terminal-column-focus" : ""}`}
          ref={customPreviewGridRef}
        >
          {dataSource.warnings.length > 0 && (
            <div className="warning-list">
              <strong>Readiness notes</strong>
              {dataSource.warnings.slice(0, 4).map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          )}
          {dataSource.kind === "api" && (
            <section
              className={`api-activity-terminal tutorial-target ${currentTutorialTarget === "terminal" ? "tutorial-highlight" : ""} ${isTerminalExpanded ? "is-expanded" : ""}`}
              aria-label="API activity"
            >
              <div className="api-activity-terminal-header">
                <span>Pseudo terminal</span>
                {dataSource.endpoint ? <code>{dataSource.endpoint}</code> : null}
                <button type="button" className="ghost-button panel-expand-button" onClick={() => setIsTerminalExpanded((current) => !current)}>
                  {isTerminalExpanded ? "⤡ Collapse" : "⤢ Expand"}
                </button>
              </div>
              <div className="api-activity-terminal-body" aria-live="polite">
                {apiActivity.length > 0 ? (
                  apiActivity.map((entry) => (
                    <p key={entry.id} className={`api-log-line ${entry.level}`}>
                      {entry.line}
                    </p>
                  ))
                ) : (
                  <p className="api-log-line muted">No API calls yet.</p>
                )}
              </div>
            </section>
          )}
          <section className="sandbox-grid-section" aria-label="Sandbox product gallery">
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
                <p>Showing {customSandboxProducts.length} Product lab items from the connected catalog. Select up to {MAX_PREVIEW_PRODUCTS} cards to load them into the sample chat.</p>
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
      {activeTutorialStep && (
        <aside className="tutorial-overlay-card" aria-live="polite">
          <p className="eyebrow">Sandbox tutorial</p>
          <h3>{activeTutorialStep.title}</h3>
          <p>{activeTutorialStep.description}</p>
          <p className="tutorial-step-count">
            Step {tutorialStepIndex + 1} of {tutorialSteps.length}
          </p>
          <div className="tutorial-actions">
            <button type="button" className="ghost-button" onClick={closeTutorial}>
              Close
            </button>
            <button type="button" className="ghost-button" onClick={goToPrevTutorialStep} disabled={tutorialStepIndex === 0}>
              Back
            </button>
            <button type="button" onClick={goToNextTutorialStep}>
              {tutorialStepIndex === tutorialSteps.length - 1 ? "Done" : "Next"}
            </button>
          </div>
        </aside>
      )}
    </>
  );

  const demoWorkspace = (
    <section className={`chat-panel ${isAgentThinking ? "is-loading-fields" : ""}`}>
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
        {demoQuickPrompts.map((example) => (
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
        <p>Start in Home demo to see the simulated shopping flow, then move to Sandbox to upload your own CSV, JSON, JSONL, or connect a local API.</p>
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

  const makerWorkspace = (
    <section className="chat-panel maker-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Product lab</p>
          <h2>Create item + preview in chat (and let ChatGPT summarize it for you!)</h2>
        </div>
      </div>

      {needsGoogleLogin ? (
        <div className="login-gate">
          <strong>Google login required</strong>
          <p>Sign in to use Product lab, generate image-based item fields, and export your custom product.</p>
          <button type="button" onClick={handleGoogleLogin}>
            Continue with Google
          </button>
        </div>
      ) : (
        <>
      <div className="maker-grid">
        <section className={`trace-block maker-form-block maker-form-block-primary ${isMakerAutofilling ? "is-loading-fields" : ""}`}>
          <span>1. Add photo first</span>
          <strong>Photo-forward item setup</strong>
          <p>Use a phone or webcam capture, or upload an image file. Then fill in item details.</p>
          <div className="source-actions single">
            <label className="file-picker">
              Take / upload photo *
              <input type="file" accept="image/*" capture="environment" onChange={(event) => handleMakerPhotoUpload(event.target.files?.[0] ?? null)} />
            </label>
          </div>
          <div className="api-box">
            <label htmlFor="makerImageUrl">Or paste image URL *</label>
            <input
              id="makerImageUrl"
              value={makerImageUrl}
              onChange={(event) => setMakerImageUrl(event.target.value)}
              onBlur={() => {
                const imageUrl = makerImageUrl.trim();
                if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) return;
                void autofillMakerFieldsFromImage(imageUrl);
              }}
              placeholder="https://..."
            />
          </div>
          <div className={`maker-photo-preview ${isMakerUsingPlaceholderImage ? "is-placeholder" : ""}`}>
            <img src={makerResolvedImage} alt="" />
          </div>
          {makerAutofillNotice && <p className={`maker-notice ${isMakerAutofilling ? "is-loading" : ""}`}>{makerAutofillNotice}</p>}
        </section>

        <section className={`trace-block maker-form-block maker-form-block-secondary ${isMakerAutofilling ? "is-loading-fields" : ""}`}>
          <span>2. Item details</span>
          <strong>Describe your item</strong>
          <div className="api-box">
            <label htmlFor="makerTitle">Title *</label>
            <input id="makerTitle" value={makerTitle} onChange={(event) => setMakerTitle(event.target.value)} required />
            <label htmlFor="makerDescription">Description *</label>
            <input id="makerDescription" value={makerDescription} onChange={(event) => setMakerDescription(event.target.value)} required />
            <label htmlFor="makerCategory">Category *</label>
            <input id="makerCategory" value={makerCategory} onChange={(event) => setMakerCategory(event.target.value)} required />
            <label htmlFor="makerTags">Tags (comma-separated)</label>
            <input id="makerTags" value={makerTags} onChange={(event) => setMakerTags(event.target.value)} />
            <label htmlFor="makerPrice">Price *</label>
            <input id="makerPrice" value={makerPrice} onChange={(event) => setMakerPrice(event.target.value)} required />
            <label htmlFor="makerCurrency">Currency *</label>
            <input id="makerCurrency" value={makerCurrency} onChange={(event) => setMakerCurrency(event.target.value)} required />
            <label htmlFor="makerAvailability">Availability *</label>
            <select id="makerAvailability" value={makerAvailability} onChange={(event) => setMakerAvailability(event.target.value as Product["availability"])} required>
              <option value="in_stock">in_stock</option>
              <option value="limited">limited</option>
              <option value="out_of_stock">out_of_stock</option>
              <option value="unknown">unknown</option>
            </select>
            <label htmlFor="makerAction">Action *</label>
            <select id="makerAction" value={makerAction} onChange={(event) => setMakerAction(event.target.value as Product["action"])} required>
              <option value="checkout">checkout</option>
              <option value="test_drive">test_drive</option>
              <option value="lead_form">lead_form</option>
              <option value="none">none</option>
            </select>
          </div>
        </section>

        <section className="chatgpt-preview-shell maker-preview-shell" aria-label="Custom item chat preview">
        <div className="chatgpt-preview-header">
          <div>
            <p className="eyebrow">3. Chat preview</p>
            <h3>{makerItemRecord.title}</h3>
          </div>
          <div className="maker-preview-controls">
            <div className="card-view-toggle" aria-label="Product lab card layout">
              <button type="button" className={makerCardView === "vertical" ? "active" : ""} onClick={() => setMakerCardView("vertical")}>
                Vertical
              </button>
              <button type="button" className={makerCardView === "horizontal" ? "active" : ""} onClick={() => setMakerCardView("horizontal")}>
                Horizontal
              </button>
            </div>
            <p>Preview how your own item appears inside a chat response.</p>
          </div>
        </div>
        <div className="chatgpt-thread">
          <article className="message user preview-message">
            <p>{makerPrompt}</p>
          </article>
          <article className="message assistant preview-message">
            <span>ChatGPT</span>
            <p>I can show this custom item in chat and route the user to the right next step.</p>
            <div className={`chatgpt-product-card-list ${makerCardView === "horizontal" ? "is-horizontal" : "is-vertical"}`}>
              <div className={`chatgpt-product-card ${makerCardView === "horizontal" ? "is-horizontal" : ""}`}>
                <div className="chatgpt-product-category">{makerItemRecord.category_value}</div>
                <div className="chatgpt-product-image">
                  <img src={makerResolvedImage} alt="" />
                </div>
                <div className="chatgpt-product-copy">
                  <div className="chatgpt-product-topline">
                    <strong>{makerItemRecord.title}</strong>
                    <span>{new Intl.NumberFormat("en-US", { style: "currency", currency: makerItemRecord.price_currency || "USD" }).format((makerItemRecord.price_amount || 0) / 100)}</span>
                  </div>
                  <p>{makerItemRecord.description_plain || "No description provided."}</p>
                  <div className="commerce-meta">
                    <span>{makerItemRecord.availability_status}</span>
                  </div>
                  <div className="chatgpt-product-footer">
                    <button type="button">{makerItemRecord.action === "none" ? "No action mapped" : makerItemRecord.action.replaceAll("_", " ")}</button>
                  </div>
                </div>
              </div>
            </div>
          </article>
          <article className="message user preview-message">
            <p>Thanks!</p>
          </article>
        </div>
        </section>
      </div>

      <section className="trace-block">
        <span>4. Save file</span>
        <strong>Export your item</strong>
        <p>Save your custom item as JSON or CSV, then upload it in the sandbox.</p>
        <div className="empty-state-actions">
          <button type="button" className="ghost-button" onClick={downloadMakerJson}>
            Save JSON
          </button>
          <button type="button" className="ghost-button" onClick={downloadMakerCsv}>
            Save CSV
          </button>
        </div>
      </section>
        </>
      )}
    </section>
  );

  const profileWorkspace = (
    <section className="chat-panel profile-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Profile</p>
          <h2>Account & appearance</h2>
        </div>
      </div>

      {!authUser ? (
        <div className="login-gate">
          <strong>Google login required</strong>
          <p>Sign in to access profile settings and theme controls.</p>
          <button type="button" onClick={handleGoogleLogin}>
            Continue with Google
          </button>
        </div>
      ) : (
        <div className="profile-settings-grid">
          <section className="trace-block profile-account-card">
            <span>Account</span>
            <strong>{authUser.displayName ?? "Signed in"}</strong>
            <p>{authUser.email ?? "Google account"}</p>
            <button type="button" className="ghost-button" onClick={handleSignOut}>
              Log out
            </button>
          </section>

          <section className="trace-block profile-theme-card">
            <span>Appearance</span>
            <strong>Theme mode</strong>
            <p>Pick your default UI theme for MRCHT.</p>
            <div className="card-view-toggle profile-theme-toggle" aria-label="Theme mode">
              <button type="button" className={theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")}>
                Dark
              </button>
              <button type="button" className={theme === "light" ? "active" : ""} onClick={() => setTheme("light")}>
                Light
              </button>
            </div>
          </section>
        </div>
      )}
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
        <button
          type="button"
          onClick={() => {
            logPseudoActionCall(selectedProduct);
            setCompletedActionProductId(selectedProduct.id);
          }}
        >
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

  const sharedHeader = (title: string, activeExperience: "demo" | "custom" | "maker" | "resources" | "profile") => (
    <header className="custom-page-header unified-page-header">
      <div className="custom-header-brand">
        <img src="/logo_clean.png" alt="" className="brand-mark" />
        <div>
          <p className="eyebrow">Agentic commerce</p>
          <h1>{title}</h1>
        </div>
      </div>
      <div className="experience-switch custom-header-switch" aria-label="Workbench mode">
        <button type="button" className={activeExperience === "demo" ? "active" : ""} onClick={() => navigateTo("demo")}>
          Home
        </button>
        <button type="button" className={activeExperience === "custom" ? "active" : ""} onClick={() => navigateTo("custom")}>
          Sandbox
        </button>
        <button type="button" className={activeExperience === "maker" ? "active" : ""} onClick={() => navigateTo("maker")}>
          Product lab
        </button>
        <button type="button" className={activeExperience === "resources" ? "active" : ""} onClick={() => navigateTo("resources")}>
          Resources
        </button>
        <button type="button" className={activeExperience === "profile" ? "active" : ""} onClick={() => navigateTo("profile")}>
          Profile
        </button>
      </div>
      <div className="custom-header-auth">
        {activeExperience === "custom" && (
          <button type="button" className="ghost-button tutorial-toggle-button" onClick={() => (isTutorialActive ? closeTutorial() : startTutorial())}>
            {isTutorialActive ? "Exit tutorial" : "Tutorial"}
          </button>
        )}
        {authControl}
      </div>
    </header>
  );

  if (isCustomExperience) {
    return (
      <main className={`app-shell app-shell-custom ${theme === "light" ? "theme-light" : ""}`}>
        {sharedHeader("Sandbox", "custom")}

        <section className={`workspace custom-workspace ${isTutorialActive ? "tutorial-active" : ""}`} aria-label="Agentic commerce simulator">
          {customWorkspace}
        </section>

        {cardCursor && <div className="cursor-tail" style={{ left: cardCursor.x, top: cardCursor.y }} />}
      </main>
    );
  }

  if (isResourcesExperience) {
    return (
      <main className={`app-shell app-shell-resources ${theme === "light" ? "theme-light" : ""}`}>
        {sharedHeader("Resources", "resources")}

        <section className="workspace home-workspace" aria-label="Agentic commerce resources">
          {resourcesWorkspace}
        </section>
      </main>
    );
  }

  if (isMakerExperience) {
    return (
      <main className={`app-shell app-shell-maker ${theme === "light" ? "theme-light" : ""}`}>
        {sharedHeader("Product lab", "maker")}

        <section className="workspace home-workspace" aria-label="Product lab">
          {makerWorkspace}
        </section>
      </main>
    );
  }

  if (isProfileExperience) {
    return (
      <main className={`app-shell app-shell-profile ${theme === "light" ? "theme-light" : ""}`}>
        {sharedHeader("Profile", "profile")}

        <section className="workspace home-workspace" aria-label="Profile settings">
          {profileWorkspace}
        </section>
      </main>
    );
  }

  return (
    <main className={`app-shell app-shell-demo ${theme === "light" ? "theme-light" : ""}`}>
      {sharedHeader("Home demo", "demo")}
      <section className="demo-hero-inline" aria-label="Demo intro">
        <img src="/logo_clean.png" alt="" className="brand-mark" />
        <h1>MRCHT</h1>
        <p>Open-source agentic commerce workbench</p>
      </section>

      {isDemoExperience && (
        <>
          <p className="demo-prelude-header demo-prelude-kicker">About MRCHT</p>
          <section className="demo-prelude" aria-label="Demo pitch">
            <div className="demo-pitch-block">
            <p>MRCHT helps teams make their product catalog and checkout flows ready for AI-native commerce.</p>
            <p>
              In 2025, OpenAI and Stripe introduced the Agentic Commerce Protocol (ACP), an open standard that enables agents to handle discovery, checkout, payments, and real-time updates while merchants keep their existing systems.
            </p>
            <p>
              The platform provides tools to structure product data, connect APIs, and simulate real shopping experiences before launch. Teams can validate catalog quality, action mapping, and checkout readiness so customers see accurate products and clear next steps in chat.
            </p>
            </div>
          </section>
        </>
      )}

      <p className="demo-prelude-header demo-try-kicker">Try it out!</p>

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
                <p>Sign in to use the sandbox, save traces, and persist uploaded sources.</p>
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
                      <h2>{customSandboxProducts.length} Product lab cards</h2>
                    </div>

                    <section className="trace-block">
                      <span>Preview behavior</span>
                      <p>The sandbox now generates a gallery of up to ten products from the connected source.</p>
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
            <h2>{hasConnectedData ? (isCustomExperience ? "Product lab" : "Shopping flow") : "Waiting for data"}</h2>
          </div>

          {isCustomExperience ? (
            hasConnectedData ? (
              <>
                <section className="sandbox-grid-section" aria-label="Sandbox product gallery">
                  <div className="sandbox-grid-topline">
                    <h3>{resultHeading(customSandboxProducts)}</h3>
                    <p>Showing {customSandboxProducts.length} Product lab items from the connected catalog. Click a card to load its sample chat.</p>
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
                {demoQuickPrompts.map((example) => (
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

              <div className={`demo-chat-body ${selectedProduct ? "has-inline-detail" : ""}`}>
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
                {demoCheckoutDetail}
              </div>

              <div className="composer composer-guided-bar" aria-label="Sample chat composer">
                <button
                  type="button"
                  className={`composer-readout ${prompt.trim() ? "is-prepped" : ""}`}
                  onClick={() => {
                    if (!prompt.trim()) {
                      handleGenerateRandomPrompt();
                      return;
                    }
                    void sendPrompt();
                  }}
                  disabled={!hasConnectedData || needsGoogleLogin || isAgentThinking}
                >
                  {prompt || "Generate a sample chat"}
                </button>
              </div>
            </>
          )}

          {authNotice && <p className="auth-notice">{authNotice}</p>}
        </section>
      </section>

      {cardCursor && <div className="cursor-tail" style={{ left: cardCursor.x, top: cardCursor.y }} />}
    </main>
  );
}

export default App;
