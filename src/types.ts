export type Availability = "in_stock" | "limited" | "out_of_stock" | "unknown";

export type CommerceAction = "checkout" | "test_drive" | "lead_form" | "none";

export type ProductPrice = {
  amount: number;
  currency: string;
};

export type ProductLink = {
  type: string;
  title?: string;
  url: string;
};

export type ProductBarcode = {
  type: string;
  value: string;
};

export type ProductMedia = {
  url: string;
  alt?: string;
};

export type ProductMeasure = {
  value: number;
  unit: string;
};

export type ProductSeller = {
  name?: string;
  link?: string;
  links?: ProductLink[];
};

export type ProductUnitPrice = {
  amount?: number;
  currency?: string;
  measure?: string;
  reference?: string;
  measureDetail?: ProductMeasure;
  referenceDetail?: ProductMeasure;
};

export type ProductHeader = {
  id: string;
  title: string;
};

export type ProductVariant = {
  id: string;
  title: string;
  sku?: string;
  barcode?: string;
  barcodes?: ProductBarcode[];
  price?: ProductPrice;
  listPrice?: ProductPrice;
  media?: ProductMedia[];
  availability: Availability;
  condition?: string;
  attributes: string[];
  seller?: ProductSeller;
  unitPrice?: ProductUnitPrice;
  raw?: Record<string, unknown>;
};

export type Product = {
  id: string;
  title: string;
  category: string;
  price: number;
  currency: string;
  availability: Availability;
  tags: string[];
  description: string;
  action: CommerceAction;
  image?: string;
  header: ProductHeader;
  variants: ProductVariant[];
  media?: ProductMedia[];
  barcode?: string;
  barcodes?: ProductBarcode[];
  seller?: ProductSeller;
  unitPrice?: ProductUnitPrice;
  condition?: string;
  raw?: Record<string, unknown>;
};

export type DataSourceKind = "demo" | "file" | "api";

export type DataSourceState = {
  kind: DataSourceKind;
  label: string;
  status: "ready" | "empty" | "loading" | "error";
  products: Product[];
  endpoint?: string;
  warnings: string[];
};

export type ToolName = "discover_products" | "search" | "get_product" | "check_availability" | "initiate_action";

export type TraceEvent = {
  id: string;
  timestamp: string;
  selectedTool: ToolName;
  requestPayload: Record<string, unknown>;
  responsePayload: Record<string, unknown>;
  fieldMappings: Record<string, string>;
  warnings: string[];
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  products?: Product[];
  selectedTool?: ToolName;
  traceId?: string;
};
