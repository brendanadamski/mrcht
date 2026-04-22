import cors from "cors";
import express from "express";

type CommerceRow = {
  feed_id: string;
  account_id: string;
  target_merchant: string;
  target_country: string;
  id: string;
  title: string;
  description_plain: string;
  url: string;
  product_media_url: string;
  product_media_alt_text: string;
  variant_id: string;
  variant_title: string;
  variant_description_plain: string;
  variant_url: string;
  variant_media_url: string;
  variant_media_alt_text: string;
  variant_barcode_type: string;
  variant_barcode_value: string;
  price_amount: number;
  price_currency: string;
  list_price_amount: number;
  list_price_currency: string;
  unit_price_amount?: number;
  unit_price_currency?: string;
  unit_price_measure_value?: number;
  unit_price_measure_unit?: string;
  unit_price_reference_value?: number;
  unit_price_reference_unit?: string;
  availability_available: boolean;
  availability_status: string;
  category_value: string;
  category_taxonomy: string;
  condition: string;
  option_color: string;
  option_size: string;
  seller_name: string;
  seller_link_type: string;
  seller_link_title: string;
  seller_link_url: string;
  tags: string;
  action: "checkout" | "test_drive" | "lead_form";
};

const productRows: CommerceRow[] = [
  {
    feed_id: "feed_mrcht_demo_v1",
    account_id: "acct_mrcht_demo",
    target_merchant: "MRCHT",
    target_country: "US",
    id: "SKU-MRCHT-TEE-BLUE",
    title: "MRCHT Blue Everyday Tee",
    description_plain: "Soft cotton tee in a bright blue colorway for daily wear.",
    url: "https://example.com/products/sku-mrcht-tee-blue",
    product_media_url: "https://images.pexels.com/photos/20228403/pexels-photo-20228403.jpeg?auto=compress&cs=tinysrgb&w=1200",
    product_media_alt_text: "Blue everyday tee hero image",
    variant_id: "SKU-MRCHT-TEE-BLUE-M",
    variant_title: "Blue / Medium",
    variant_description_plain: "Blue cotton tee in size medium.",
    variant_url: "https://example.com/products/sku-mrcht-tee-blue?variant=medium",
    variant_media_url: "https://images.pexels.com/photos/20228403/pexels-photo-20228403.jpeg?auto=compress&cs=tinysrgb&w=1200",
    variant_media_alt_text: "Blue cotton t-shirt",
    variant_barcode_type: "gtin",
    variant_barcode_value: "00012345678905",
    price_amount: 2500,
    price_currency: "USD",
    list_price_amount: 3200,
    list_price_currency: "USD",
    unit_price_amount: 2500,
    unit_price_currency: "USD",
    unit_price_measure_value: 1,
    unit_price_measure_unit: "ea",
    unit_price_reference_value: 1,
    unit_price_reference_unit: "ea",
    availability_available: true,
    availability_status: "in_stock",
    category_value: "Apparel & Accessories > Clothing > Shirts & Tops",
    category_taxonomy: "merchant",
    condition: "new",
    option_color: "blue",
    option_size: "M",
    seller_name: "MRCHT",
    seller_link_type: "faq",
    seller_link_title: "Shopping FAQ",
    seller_link_url: "https://example.com/help/shopping-faq",
    tags: "shirt;tee;cotton;everyday",
    action: "checkout"
  },
  {
    feed_id: "feed_mrcht_demo_v1",
    account_id: "acct_mrcht_demo",
    target_merchant: "MRCHT",
    target_country: "US",
    id: "SKU-MRCHT-DUFFEL-ATLAS",
    title: "Atlas Weekender Duffel",
    description_plain: "Carry-on duffel with a shoe tunnel, laptop sleeve, recycled shell, and quick-access side pocket.",
    url: "https://example.com/products/atlas-weekender-duffel",
    product_media_url: "https://images.pexels.com/photos/13872590/pexels-photo-13872590.jpeg?auto=compress&cs=tinysrgb&w=1200",
    product_media_alt_text: "Atlas duffel bag hero image",
    variant_id: "SKU-MRCHT-DUFFEL-ATLAS-STD",
    variant_title: "Standard",
    variant_description_plain: "Travel-ready duffel with organized storage and carry-on dimensions.",
    variant_url: "https://example.com/products/atlas-weekender-duffel?variant=standard",
    variant_media_url: "https://images.pexels.com/photos/13872590/pexels-photo-13872590.jpeg?auto=compress&cs=tinysrgb&w=1200",
    variant_media_alt_text: "Blue and tan duffel bag",
    variant_barcode_type: "gtin",
    variant_barcode_value: "00012345678912",
    price_amount: 14800,
    price_currency: "USD",
    list_price_amount: 17500,
    list_price_currency: "USD",
    unit_price_amount: 14800,
    unit_price_currency: "USD",
    unit_price_measure_value: 1,
    unit_price_measure_unit: "ea",
    unit_price_reference_value: 1,
    unit_price_reference_unit: "ea",
    availability_available: true,
    availability_status: "backorder",
    category_value: "Luggage & Bags > Duffel Bags",
    category_taxonomy: "merchant",
    condition: "new",
    option_color: "navy",
    option_size: "One Size",
    seller_name: "MRCHT",
    seller_link_type: "shipping_policy",
    seller_link_title: "Shipping Policy",
    seller_link_url: "https://example.com/policies/shipping",
    tags: "travel;duffel;carry-on;weekender",
    action: "checkout"
  },
  {
    feed_id: "feed_mrcht_demo_v1",
    account_id: "acct_mrcht_demo",
    target_merchant: "MRCHT",
    target_country: "US",
    id: "SKU-MRCHT-GRINDER-DIAL",
    title: "Dial-In Burr Grinder",
    description_plain: "Compact grinder with 48 settings, low-retention dosing, and a removable anti-static cup.",
    url: "https://example.com/products/dial-in-burr-grinder",
    product_media_url: "https://images.pexels.com/photos/12859329/pexels-photo-12859329.jpeg?auto=compress&cs=tinysrgb&w=1200",
    product_media_alt_text: "Dial-In burr grinder hero image",
    variant_id: "SKU-MRCHT-GRINDER-DIAL-STD",
    variant_title: "Standard",
    variant_description_plain: "Precision coffee grinder tuned for espresso and filter brewing.",
    variant_url: "https://example.com/products/dial-in-burr-grinder?variant=standard",
    variant_media_url: "https://images.pexels.com/photos/12859329/pexels-photo-12859329.jpeg?auto=compress&cs=tinysrgb&w=1200",
    variant_media_alt_text: "Coffee grinder in use",
    variant_barcode_type: "gtin",
    variant_barcode_value: "00012345678929",
    price_amount: 22900,
    price_currency: "USD",
    list_price_amount: 24900,
    list_price_currency: "USD",
    unit_price_amount: 954,
    unit_price_currency: "USD",
    unit_price_measure_value: 12,
    unit_price_measure_unit: "oz",
    unit_price_reference_value: 12,
    unit_price_reference_unit: "oz",
    availability_available: true,
    availability_status: "in_stock",
    category_value: "Kitchen > Coffee Grinders",
    category_taxonomy: "merchant",
    condition: "new",
    option_color: "black",
    option_size: "Standard",
    seller_name: "MRCHT",
    seller_link_type: "refund_policy",
    seller_link_title: "Returns & Refunds",
    seller_link_url: "https://example.com/policies/refunds",
    tags: "coffee;espresso;grinder;kitchen",
    action: "checkout"
  },
  {
    feed_id: "feed_mrcht_demo_v1",
    account_id: "acct_mrcht_demo",
    target_merchant: "MRCHT",
    target_country: "US",
    id: "SKU-MRCHT-CHAIR-NORTHSTAR",
    title: "Northstar Task Chair",
    description_plain: "Adjustable work chair with breathable mesh, lumbar support, and a narrow footprint.",
    url: "https://example.com/products/northstar-task-chair",
    product_media_url: "https://images.pexels.com/photos/4305707/pexels-photo-4305707.jpeg?auto=compress&cs=tinysrgb&w=1200",
    product_media_alt_text: "Northstar task chair hero image",
    variant_id: "SKU-MRCHT-CHAIR-NORTHSTAR-STD",
    variant_title: "Standard",
    variant_description_plain: "Ergonomic office chair with mesh support and compact footprint.",
    variant_url: "https://example.com/products/northstar-task-chair?variant=standard",
    variant_media_url: "https://images.pexels.com/photos/4305707/pexels-photo-4305707.jpeg?auto=compress&cs=tinysrgb&w=1200",
    variant_media_alt_text: "Office chair near desk",
    variant_barcode_type: "gtin",
    variant_barcode_value: "00012345678936",
    price_amount: 39500,
    price_currency: "USD",
    list_price_amount: 44900,
    list_price_currency: "USD",
    availability_available: false,
    availability_status: "out_of_stock",
    category_value: "Furniture > Office Chairs",
    category_taxonomy: "merchant",
    condition: "new",
    option_color: "graphite",
    option_size: "Standard",
    seller_name: "MRCHT",
    seller_link_type: "faq",
    seller_link_title: "Restock FAQ",
    seller_link_url: "https://example.com/help/restocks",
    tags: "chair;ergonomic;office;home office",
    action: "lead_form"
  }
];

const searchableText = (row: CommerceRow) =>
  [
    row.title,
    row.category_value,
    row.description_plain,
    row.variant_title,
    row.variant_description_plain,
    row.tags,
    row.option_color,
    row.option_size
  ]
    .join(" ")
    .toLowerCase();

const app = express();
const port = Number(process.env.PORT ?? 8787);

app.use(cors());
app.use(express.json());

app.get("/health", (_request, response) => {
  response.json({ ok: true, service: "agentic-commerce-workbench-api" });
});

app.get("/mock-api/products", (request, response) => {
  const query = String(request.query.query ?? "").toLowerCase();
  const matches = query ? productRows.filter((row) => searchableText(row).includes(query)) : productRows;

  response.json({
    products: matches,
    count: matches.length,
    schema: "openai-commerce-flat-csv-compatible",
    source: "local-mock-api"
  });
});

app.get("/mock-api/products/:id", (request, response) => {
  const product = productRows.find((item) => item.id === request.params.id || item.variant_id === request.params.id);

  if (!product) {
    response.status(404).json({ error: "Product not found" });
    return;
  }

  response.json(product);
});

app.get("/mock-api/availability/:id", (request, response) => {
  const product = productRows.find((item) => item.id === request.params.id || item.variant_id === request.params.id);

  if (!product) {
    response.status(404).json({ error: "Product not found" });
    return;
  }

  response.json({
    id: product.id,
    variant_id: product.variant_id,
    availability: {
      available: product.availability_available,
      status: product.availability_status
    },
    next_action: product.action
  });
});

app.post("/mock-api/actions/checkout", (request, response) => {
  response.json({
    action: "checkout",
    status: "simulated",
    confirmationId: `chk_${Date.now()}`,
    request: request.body
  });
});

app.post("/mock-api/actions/test-drive", (request, response) => {
  response.json({
    action: "test_drive",
    status: "simulated",
    reservationId: `td_${Date.now()}`,
    request: request.body
  });
});

app.listen(port, () => {
  console.log(`Mock commerce API running on http://localhost:${port}`);
});
