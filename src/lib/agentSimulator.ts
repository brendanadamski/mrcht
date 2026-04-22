import type { ChatMessage, Product, TraceEvent, ToolName } from "../types";

const money = (product: Product) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: product.currency || "USD" }).format(product.price);

const actionCopy = (product: Product) => {
  if (product.action === "checkout") return "Start checkout";
  if (product.action === "test_drive") return "Book test drive";
  if (product.action === "lead_form") return "Request follow-up";
  return "No action mapped";
};

const tokenize = (value: string) =>
  value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);

const scoreProduct = (prompt: string, product: Product) => {
  const tokens = tokenize(prompt);
  const haystack = [product.title, product.category, product.description, ...product.tags].join(" ").toLowerCase();
  let score = tokens.reduce((total, token) => total + (haystack.includes(token) ? 2 : 0), 0);

  if (prompt.toLowerCase().includes("available") && product.availability === "in_stock") score += 2;
  if (prompt.toLowerCase().includes("gift") && product.tags.includes("gift")) score += 2;
  if (prompt.toLowerCase().includes("cheap") || prompt.toLowerCase().includes("under")) score += Math.max(0, 3 - product.price / 100);

  return score;
};

const inferTool = (prompt: string, product?: Product): ToolName => {
  const normalized = prompt.toLowerCase();

  if (normalized.includes("buy") || normalized.includes("checkout") || normalized.includes("book") || normalized.includes("test drive")) {
    return "initiate_action";
  }
  if (normalized.includes("available") || normalized.includes("stock")) return "check_availability";
  if (normalized.includes("detail") || normalized.includes("compare")) return "get_product";
  if (product) return "search";
  return "discover_products";
};

export const simulateAgentTurn = (prompt: string, products: Product[]) => {
  const scored = products
    .map((product) => ({ product, score: scoreProduct(prompt, product) }))
    .sort((a, b) => b.score - a.score || a.product.price - b.product.price);

  const matches = scored.filter((item) => item.score > 0).slice(0, 3).map((item) => item.product);
  const fallbackMatches = products.slice(0, 3);
  const selected = matches[0] ?? products[0];
  const selectedTool = inferTool(prompt, selected);
  const visibleMatches = matches.length > 0 ? matches : fallbackMatches;
  const warnings: string[] = [];

  if (matches.length === 0) warnings.push("No strong semantic match found; returning default catalog candidates.");
  if (selected?.availability === "unknown") warnings.push("Selected product has unknown availability.");
  if (selected?.action === "none" && selectedTool === "initiate_action") warnings.push("No transaction action is mapped for this item.");

  const responseText = selected
    ? [
        `I found ${visibleMatches.length === 1 ? "one strong option" : `${visibleMatches.length} options`} from the connected catalog.`,
        `${selected.title} looks like the best fit because it matches the request and has ${selected.availability.replaceAll("_", " ")} availability.`,
        selected.action !== "none" ? `I would offer "${actionCopy(selected)}" as the next step.` : "I would flag this item because no transaction action is mapped yet.",
        `Tool path: ${selectedTool.replaceAll("_", " ")}.`
      ]
        .filter(Boolean)
        .join(" ")
    : "I need product data before I can simulate a commerce flow.";

  const trace: TraceEvent = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    selectedTool,
    requestPayload: {
      user_prompt: prompt,
      filters: {
        tokens: tokenize(prompt),
        result_limit: 3
      },
      selected_product_id: selected?.id ?? null
    },
    responsePayload: {
      matches: visibleMatches,
      recommended: selected ?? null,
      action: selected?.action ?? "none"
    },
    fieldMappings: {
      product_id: "id",
      product_name: "title",
      product_category: "category",
      product_price: "price + currency",
      availability: "availability",
      action_target: "action"
    },
    warnings
  };

  const assistantMessage: ChatMessage = {
    id: crypto.randomUUID(),
    role: "assistant",
    content: responseText,
    products: visibleMatches,
    selectedTool,
    traceId: trace.id
  };

  return { assistantMessage, trace };
};
