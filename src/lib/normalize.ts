import type {
  Availability,
  CommerceAction,
  Product,
  ProductBarcode,
  ProductHeader,
  ProductLink,
  ProductMedia,
  ProductPrice,
  ProductSeller,
  ProductUnitPrice,
  ProductVariant
} from "../types";

const idKeys = ["id", "sku", "product_id", "productId"];
const titleKeys = ["title", "name", "product_name", "productName"];
const categoryKeys = ["category", "type", "department", "category_value"];
const priceKeys = ["price", "amount", "unit_price", "unitPrice"];
const descriptionKeys = ["description", "summary", "details"];
const availabilityKeys = ["availability", "inventory", "stock", "status"];
const tagsKeys = ["tags", "keywords", "attributes"];
const actionKeys = ["action", "next_action", "nextAction", "cta"];

const headerIdKeys = ["header_id", "headerId", "group_id", "groupId", "collection_id", "feed_id"];
const headerTitleKeys = ["header", "header_title", "headerTitle", "group", "collection", "target_merchant"];
const variantIdKeys = ["variant_id", "variantId", "sku", "variant_sku"];
const variantTitleKeys = ["variant_title", "variantTitle", "option_label", "variant_name"];
const barcodeKeys = ["barcode", "gtin", "upc", "ean"];
const mediaKeys = ["image", "image_url", "imageUrl", "media", "media_url", "mediaUrl"];
const sellerNameKeys = ["seller", "seller_name", "sellerName", "merchant"];
const sellerLinkKeys = ["seller_link", "sellerLink", "merchant_link", "merchantLink", "link", "url"];
const unitMeasureKeys = ["unit_measure", "unitMeasure", "measure"];
const unitReferenceKeys = ["unit_reference", "unitReference", "reference"];
const conditionKeys = ["condition", "item_condition"];

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));

const firstValue = (row: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return row[key];
    }
  }

  return undefined;
};

const firstRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (Array.isArray(value) && isRecord(value[0])) return value[0];
  if (isRecord(value)) return value;
  return undefined;
};

const normalizeText = (value: unknown) => String(value ?? "").trim();

const parseStructured = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return value;

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const parseBoolean = (value: unknown) => {
  if (typeof value === "boolean") return value;
  const normalized = normalizeText(value).toLowerCase();
  if (["true", "1", "yes"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;
  return undefined;
};

const descriptionText = (value: unknown) => {
  const parsed = parseStructured(value);
  if (isRecord(parsed)) {
    return String(parsed.plain ?? parsed.markdown ?? parsed.html ?? "");
  }

  return normalizeText(parsed);
};

const categoryText = (value: unknown) => {
  const parsed = parseStructured(value);
  const category = firstRecord(parsed);
  if (category) return String(category.value ?? category.name ?? "Uncategorized");
  return normalizeText(parsed);
};

const priceFromValue = (value: unknown) => {
  const parsed = parseStructured(value);
  if (isRecord(parsed)) {
    const amount = Number(parsed.amount ?? 0);
    return Number.isFinite(amount) ? amount / 100 : 0;
  }

  const amount = Number(parsed ?? 0);
  return Number.isFinite(amount) ? amount : 0;
};

const currencyFromValue = (value: unknown, fallback = "USD") => {
  const parsed = parseStructured(value);
  if (isRecord(parsed) && parsed.currency) return String(parsed.currency);
  return fallback;
};

const priceObject = (amountMinor: unknown, currency: unknown, fallbackCurrency = "USD") => {
  if (amountMinor === undefined || amountMinor === null || amountMinor === "") return undefined;
  const parsedAmount = Number(amountMinor);
  if (!Number.isFinite(parsedAmount)) return undefined;

  return {
    amount: parsedAmount / 100,
    currency: normalizeText(currency) || fallbackCurrency
  } satisfies ProductPrice;
};

const normalizeAvailability = (value: unknown): Availability => {
  const parsed = parseStructured(value);
  if (isRecord(parsed)) {
    if (parsed.status) return normalizeAvailability(parsed.status);
    if (parsed.available === true) return "in_stock";
    if (parsed.available === false) return "out_of_stock";
  }

  const normalized = normalizeText(parsed).toLowerCase();

  if (["in_stock", "in stock", "available", "true", "yes", "backorder", "preorder"].includes(normalized)) return "in_stock";
  if (["limited", "low", "few"].includes(normalized)) return "limited";
  if (["out_of_stock", "out of stock", "sold out", "false", "no", "discontinued"].includes(normalized)) return "out_of_stock";

  return "unknown";
};

const normalizeAction = (value: unknown): CommerceAction => {
  const normalized = normalizeText(value).toLowerCase();

  if (normalized.includes("test")) return "test_drive";
  if (normalized.includes("lead")) return "lead_form";
  if (normalized.includes("checkout") || normalized.includes("buy") || normalized.includes("cart")) return "checkout";

  return "none";
};

const normalizeTags = (value: unknown): string[] => {
  const parsed = parseStructured(value);
  if (Array.isArray(parsed)) {
    return parsed
      .map((item) => {
        if (isRecord(item)) return String(item.value ?? item.name ?? "");
        return String(item);
      })
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof parsed === "string") {
    return parsed
      .split(/[;,|]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return [];
};

const normalizeMedia = (value: unknown): ProductMedia[] => {
  const parsed = parseStructured(value);

  if (Array.isArray(parsed)) {
    return parsed
      .map((item) => {
        if (isRecord(item)) {
          const url = normalizeText(item.url ?? item.src ?? item.image);
          if (!url) return null;
          return { url, alt: normalizeText(item.alt_text ?? item.alt ?? item.label) || undefined };
        }

        const url = normalizeText(item);
        return url ? { url } : null;
      })
      .filter((item): item is ProductMedia => Boolean(item));
  }

  if (isRecord(parsed)) {
    const url = normalizeText(parsed.url ?? parsed.src ?? parsed.image);
    return url ? [{ url, alt: normalizeText(parsed.alt_text ?? parsed.alt ?? parsed.label) || undefined }] : [];
  }

  const url = normalizeText(parsed);
  return url ? [{ url }] : [];
};

const barcodeObjects = (type: unknown, value: unknown): ProductBarcode[] => {
  const parsed = parseStructured(value);
  if (Array.isArray(parsed)) {
    return parsed
      .filter(isRecord)
      .map((item) => ({
        type: normalizeText(item.type),
        value: normalizeText(item.value)
      }))
      .filter((item) => item.type && item.value);
  }

  const barcodeType = normalizeText(type);
  const barcodeValue = normalizeText(value);
  return barcodeType && barcodeValue ? [{ type: barcodeType, value: barcodeValue }] : [];
};

const sellerLinks = (row: Record<string, unknown>): ProductLink[] => {
  const structured = parseStructured(row.seller_links);
  if (Array.isArray(structured)) {
    return structured
      .filter(isRecord)
      .map((item) => ({
        type: normalizeText(item.type),
        title: normalizeText(item.title) || undefined,
        url: normalizeText(item.url)
      }))
      .filter((item) => item.type && item.url);
  }

  const directUrl = normalizeText(firstValue(row, ["seller_link_url", ...sellerLinkKeys]));
  const directType = normalizeText(firstValue(row, ["seller_link_type"])) || "faq";
  const directTitle = normalizeText(firstValue(row, ["seller_link_title"]));

  return directUrl
    ? [
        {
          type: directType,
          title: directTitle || undefined,
          url: directUrl
        }
      ]
    : [];
};

const createSeller = (row: Record<string, unknown>) => {
  const name = normalizeText(firstValue(row, ["seller_name", ...sellerNameKeys]));
  const links = sellerLinks(row);
  const link = links[0]?.url ?? (normalizeText(firstValue(row, sellerLinkKeys)) || undefined);

  if (!name && links.length === 0 && !link) return undefined;

  return {
    name: name || undefined,
    link,
    links: links.length > 0 ? links : undefined
  } satisfies ProductSeller;
};

const createLegacyUnitPrice = (row: Record<string, unknown>) => {
  const measure = normalizeText(firstValue(row, unitMeasureKeys));
  const reference = normalizeText(firstValue(row, unitReferenceKeys));

  if (!measure && !reference) return undefined;

  return {
    measure: measure || undefined,
    reference: reference || undefined
  } satisfies ProductUnitPrice;
};

const createSpecUnitPrice = (row: Record<string, unknown>) => {
  const amount = row.unit_price_amount;
  const currency = normalizeText(row.unit_price_currency) || "USD";
  const measureValue = Number(row.unit_price_measure_value);
  const measureUnit = normalizeText(row.unit_price_measure_unit);
  const referenceValue = Number(row.unit_price_reference_value);
  const referenceUnit = normalizeText(row.unit_price_reference_unit);

  if ([amount, measureUnit, referenceUnit].every((item) => item === undefined || item === null || item === "")) {
    return undefined;
  }

  return {
    amount: Number.isFinite(Number(amount)) ? Number(amount) / 100 : undefined,
    currency,
    measure: Number.isFinite(measureValue) && measureUnit ? `${measureValue} ${measureUnit}` : undefined,
    reference: Number.isFinite(referenceValue) && referenceUnit ? `${referenceValue} ${referenceUnit}` : undefined,
    measureDetail: Number.isFinite(measureValue) && measureUnit ? { value: measureValue, unit: measureUnit } : undefined,
    referenceDetail: Number.isFinite(referenceValue) && referenceUnit ? { value: referenceValue, unit: referenceUnit } : undefined
  } satisfies ProductUnitPrice;
};

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

const isOfficialCommerceRow = (row: Record<string, unknown>) =>
  ["feed_id", "account_id", "target_merchant", "target_country"].some((key) => key in row) ||
  ["price_amount", "variant_id", "variant_title", "availability_status", "category_value"].some((key) => key in row);

const productIdFromRow = (row: Record<string, unknown>, index: number) => {
  const explicitId = firstValue(row, idKeys);
  if (explicitId) return String(explicitId);

  const title = firstValue(row, titleKeys);
  if (title) return String(title).toLowerCase().replace(/[^a-z0-9]+/g, "-");

  const headerId = firstValue(row, headerIdKeys);
  const variantId = firstValue(row, variantIdKeys);
  if (headerId || variantId) return [headerId, variantId].filter(Boolean).join("-");

  return `product-${index + 1}`;
};

const headerFromLegacyRow = (row: Record<string, unknown>, fallbackId: string, productTitle: string): ProductHeader => {
  const id = normalizeText(firstValue(row, headerIdKeys)) || `header-${fallbackId}`;
  const title = normalizeText(firstValue(row, headerTitleKeys)) || `${productTitle} Header`;

  return { id, title };
};

const headerFromOfficialRow = (row: Record<string, unknown>): ProductHeader => {
  const feedId = normalizeText(row.feed_id) || "feed-demo";
  const merchant = normalizeText(row.target_merchant) || "merchant";
  const country = normalizeText(row.target_country) || "US";
  return {
    id: feedId,
    title: `${merchant.toUpperCase()} ${country}`
  };
};

const variantOptionsFromOfficialRow = (row: Record<string, unknown>) => {
  const structured = parseStructured(row.variant_options);
  if (Array.isArray(structured)) {
    return structured
      .filter(isRecord)
      .map((item) => `${normalizeText(item.name)}:${normalizeText(item.value)}`)
      .filter((item) => !item.endsWith(":"));
  }

  return Object.entries(row)
    .filter(([key, value]) => key.startsWith("option_") && normalizeText(value))
    .map(([key, value]) => `${key.replace(/^option_/, "")}:${normalizeText(value)}`);
};

const variantMediaFromOfficialRow = (row: Record<string, unknown>) => {
  const structured = normalizeMedia(row.variant_media ?? row.media);
  if (structured.length > 0) return structured;

  const direct = normalizeText(row.variant_media_url);
  return direct
    ? [
        {
          url: direct,
          alt: normalizeText(row.variant_media_alt_text) || undefined
        }
      ]
    : [];
};

const productMediaFromOfficialRow = (row: Record<string, unknown>) => {
  const structured = normalizeMedia(row.product_media);
  if (structured.length > 0) return structured;

  const direct = normalizeText(row.product_media_url);
  return direct
    ? [
        {
          url: direct,
          alt: normalizeText(row.product_media_alt_text) || undefined
        }
      ]
    : [];
};

const legacyVariantFromRow = (
  row: Record<string, unknown>,
  index: number,
  productId: string,
  productTitle: string
): ProductVariant => {
  const priceSource = firstValue(row, priceKeys);
  const price =
    isRecord(parseStructured(priceSource))
      ? ({
          amount: priceFromValue(priceSource),
          currency: currencyFromValue(priceSource, String(row.currency ?? row.Currency ?? "USD"))
        } satisfies ProductPrice)
      : priceSource !== undefined && priceSource !== null && priceSource !== ""
        ? ({
            amount: Number(priceSource),
            currency: String(row.currency ?? row.Currency ?? "USD")
          } satisfies ProductPrice)
        : undefined;

  const attributes = unique(normalizeTags(firstValue(row, tagsKeys)));
  const media = normalizeMedia(firstValue(row, mediaKeys));
  const title = normalizeText(firstValue(row, variantTitleKeys)) || normalizeText(firstValue(row, titleKeys)) || `${productTitle} Default`;
  const seller = createSeller(row);
  const unitPrice = createLegacyUnitPrice(row);
  const barcodes = barcodeObjects("gtin", firstValue(row, barcodeKeys));

  return {
    id: normalizeText(firstValue(row, variantIdKeys)) || `${productId}-variant-${index + 1}`,
    title,
    sku: normalizeText(firstValue(row, ["sku"])) || undefined,
    barcode: normalizeText(firstValue(row, barcodeKeys)) || undefined,
    barcodes: barcodes.length > 0 ? barcodes : undefined,
    price,
    media: media.length > 0 ? media : undefined,
    availability: normalizeAvailability(firstValue(row, availabilityKeys)),
    condition: normalizeText(firstValue(row, conditionKeys)) || undefined,
    attributes,
    seller,
    unitPrice,
    raw: row
  };
};

const officialVariantFromRow = (
  row: Record<string, unknown>,
  index: number,
  productId: string,
  productTitle: string
): ProductVariant => {
  const title = normalizeText(row.variant_title) || `${productTitle} Default`;
  const barcodes = barcodeObjects(row.variant_barcode_type, row.variant_barcode_value);
  const seller = createSeller(row);
  const unitPrice = createSpecUnitPrice(row);
  const media = variantMediaFromOfficialRow(row);
  const price = priceObject(row.price_amount, row.price_currency);
  const listPrice = priceObject(row.list_price_amount, row.list_price_currency, normalizeText(row.price_currency) || "USD");
  const availability = normalizeAvailability({
    available: parseBoolean(row.availability_available),
    status: row.availability_status
  });

  return {
    id: normalizeText(row.variant_id) || `${productId}-variant-${index + 1}`,
    title,
    sku: normalizeText(row.variant_sku) || normalizeText(row.sku) || undefined,
    barcode: barcodes[0]?.value,
    barcodes: barcodes.length > 0 ? barcodes : undefined,
    price,
    listPrice,
    media: media.length > 0 ? media : undefined,
    availability,
    condition: normalizeText(row.condition) || undefined,
    attributes: unique([...variantOptionsFromOfficialRow(row), ...normalizeTags(row.tags)]),
    seller,
    unitPrice,
    raw: row
  };
};

type ProductAccumulator = {
  rows: Record<string, unknown>[];
  header: ProductHeader;
  productId: string;
  title: string;
  category: string;
  description: string;
  productUrl?: string;
  actionValue: unknown;
  tags: string[];
  media: ProductMedia[];
  barcode?: string;
  barcodes?: ProductBarcode[];
  seller?: ProductSeller;
  unitPrice?: ProductUnitPrice;
  condition?: string;
  variants: ProductVariant[];
};

const appendVariant = (accumulator: ProductAccumulator, variant: ProductVariant) => {
  const nextIndex = accumulator.variants.findIndex((item) => item.id === variant.id);
  if (nextIndex >= 0) {
    accumulator.variants[nextIndex] = variant;
    return;
  }

  accumulator.variants.push(variant);
};

const mapOfficialCommerceRows = (rows: Record<string, unknown>[]) => {
  const warnings: string[] = [];
  const grouped = new Map<string, ProductAccumulator>();

  rows.forEach((row, index) => {
    const title = normalizeText(row.title) || `Untitled product ${index + 1}`;
    const productId = normalizeText(row.id) || `product-${index + 1}`;
    const header = headerFromOfficialRow(row);
    const key = `${header.id}::${productId}`;
    const description =
      descriptionText(
        row.description ??
          (row.description_plain
            ? {
                plain: row.description_plain,
                html: row.description_html,
                markdown: row.description_markdown
              }
            : undefined)
      ) || descriptionText(row.variant_description_plain);
    const category = normalizeText(row.category_value) || "Uncategorized";
    const tags = unique([...normalizeTags(row.tags), ...variantOptionsFromOfficialRow(row)]);
    const media = productMediaFromOfficialRow(row);
    const seller = createSeller(row);
    const unitPrice = createSpecUnitPrice(row);
    const barcodes = barcodeObjects(row.variant_barcode_type, row.variant_barcode_value);

    if (!grouped.has(key)) {
      grouped.set(key, {
        rows: [],
        header,
        productId,
        title,
        category,
        description,
        productUrl: normalizeText(row.url) || undefined,
        actionValue: row.action,
        tags,
        media,
        barcode: barcodes[0]?.value,
        barcodes: barcodes.length > 0 ? barcodes : undefined,
        seller,
        unitPrice,
        condition: normalizeText(row.condition) || undefined,
        variants: []
      });
    }

    const entry = grouped.get(key);
    if (!entry) return;

    entry.rows.push(row);
    entry.tags = unique([...entry.tags, ...tags]);
    entry.media = [...entry.media, ...media].filter((item, mediaIndex, collection) => collection.findIndex((candidate) => candidate.url === item.url) === mediaIndex);
    entry.seller ??= seller;
    entry.unitPrice ??= unitPrice;
    entry.condition ??= normalizeText(row.condition) || undefined;
    entry.barcodes ??= barcodes.length > 0 ? barcodes : undefined;
    entry.barcode ??= barcodes[0]?.value;

    appendVariant(entry, officialVariantFromRow(row, index, productId, title));
  });

  const products: Product[] = Array.from(grouped.values()).map((entry) => {
    const primaryVariant = entry.variants[0];
    const primaryPrice = primaryVariant?.price;
    const availability = primaryVariant?.availability ?? "unknown";
    const action = normalizeAction(entry.actionValue ?? (availability === "out_of_stock" ? "lead_form" : "checkout"));
    const description = entry.description || "No description provided.";

    if (!entry.header.id) warnings.push(`Product ${entry.productId} is missing required Header.feed_id.`);
    if (!entry.title) warnings.push(`Product ${entry.productId} is missing Product.title.`);
    if (entry.variants.length === 0) warnings.push(`Product ${entry.productId} is missing the required Variant record.`);
    if (!primaryPrice) warnings.push(`Product ${entry.productId} is missing Variant.price.`);

    return {
      id: entry.productId,
      title: entry.title,
      category: entry.category,
      price: primaryPrice?.amount ?? 0,
      currency: primaryPrice?.currency ?? "USD",
      availability,
      tags: unique([...entry.tags, ...entry.variants.flatMap((variant) => variant.attributes)]),
      description,
      action,
      image: primaryVariant?.media?.[0]?.url ?? entry.media[0]?.url,
      header: entry.header,
      variants: entry.variants,
      media: entry.media.length > 0 ? entry.media : undefined,
      barcode: entry.barcode,
      barcodes: entry.barcodes,
      seller: entry.seller,
      unitPrice: entry.unitPrice ?? primaryVariant?.unitPrice,
      condition: entry.condition ?? primaryVariant?.condition,
      raw: {
        header: {
          feed_id: entry.header.id,
          account_id: normalizeText(entry.rows[0]?.account_id),
          target_merchant: normalizeText(entry.rows[0]?.target_merchant),
          target_country: normalizeText(entry.rows[0]?.target_country)
        },
        product: {
          id: entry.productId,
          title: entry.title,
          description: {
            plain: description
          },
          url: entry.productUrl,
          media: entry.media,
          variants: entry.variants
        }
      }
    };
  });

  return {
    products,
    warnings,
    fieldMappings: {
      header: "feed_id + account_id + target_merchant + target_country",
      product: "id + title + description_plain + url + product_media_url",
      variant: "variant_id + variant_title + price_amount + price_currency",
      media: "product_media_url | variant_media_url | media",
      barcode: "variant_barcode_type + variant_barcode_value",
      category: "category_value + category_taxonomy",
      seller: "seller_name + seller_link_type + seller_link_url",
      unit_price: "unit_price_amount + unit_price_currency + unit_price_measure_* + unit_price_reference_*",
      description: "description_plain | description_html | description_markdown | variant_description_plain",
      availability: "availability_available + availability_status",
      condition: "condition",
      action: "action"
    }
  };
};

const mapLegacyRows = (rows: Record<string, unknown>[]) => {
  const warnings: string[] = [];
  const grouped = new Map<string, ProductAccumulator>();

  rows.forEach((row, index) => {
    const title = normalizeText(firstValue(row, titleKeys)) || `Untitled product ${index + 1}`;
    const productId = productIdFromRow(row, index);
    const header = headerFromLegacyRow(row, productId, title);
    const groupKey = `${header.id}::${productId}`;
    const description = descriptionText(firstValue(row, descriptionKeys));
    const category = categoryText(firstValue(row, categoryKeys)) || "Uncategorized";
    const tags = normalizeTags(firstValue(row, tagsKeys));
    const media = normalizeMedia(firstValue(row, mediaKeys));
    const seller = createSeller(row);
    const unitPrice = createLegacyUnitPrice(row);
    const condition = normalizeText(firstValue(row, conditionKeys)) || undefined;
    const barcodes = barcodeObjects("gtin", firstValue(row, barcodeKeys));

    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, {
        rows: [],
        header,
        productId,
        title,
        category,
        description,
        actionValue: firstValue(row, actionKeys),
        tags: [...tags],
        media: [...media],
        barcode: barcodes[0]?.value,
        barcodes: barcodes.length > 0 ? barcodes : undefined,
        seller,
        unitPrice,
        condition,
        variants: []
      });
    }

    const entry = grouped.get(groupKey);
    if (!entry) return;

    entry.rows.push(row);
    if (!entry.description && description) entry.description = description;
    if (entry.category === "Uncategorized" && category) entry.category = category;
    if (!entry.actionValue) entry.actionValue = firstValue(row, actionKeys);
    entry.tags = unique([...entry.tags, ...tags]);
    entry.media = [...entry.media, ...media].filter((item, mediaIndex, collection) => collection.findIndex((candidate) => candidate.url === item.url) === mediaIndex);
    entry.barcodes ??= barcodes.length > 0 ? barcodes : undefined;
    entry.barcode ??= barcodes[0]?.value;
    entry.seller ??= seller;
    entry.unitPrice ??= unitPrice;
    entry.condition ??= condition;

    appendVariant(entry, legacyVariantFromRow(row, index, productId, title));
  });

  const products: Product[] = Array.from(grouped.values()).map((entry) => {
    const primaryVariant = entry.variants[0];
    const primaryPrice = primaryVariant?.price;
    const availability = primaryVariant?.availability ?? "unknown";
    const action = normalizeAction(entry.actionValue ?? (availability === "out_of_stock" ? "lead_form" : "checkout"));
    const description = entry.description || primaryVariant?.attributes.join(", ") || "No description provided.";

    if (!entry.header.id || !entry.header.title) warnings.push(`Product ${entry.productId} is missing required Header information.`);
    if (!entry.title) warnings.push(`Product ${entry.productId} is missing required Product title information.`);
    if (entry.variants.length === 0) warnings.push(`Product ${entry.productId} is missing the required Variant record.`);
    if (!primaryPrice) warnings.push(`Product ${entry.productId} is missing structured price information on its primary variant.`);
    if (availability === "unknown") warnings.push(`Product ${entry.productId} has unknown availability; agent may need a check_availability tool.`);

    return {
      id: entry.productId,
      title: entry.title,
      category: entry.category,
      price: primaryPrice?.amount ?? 0,
      currency: primaryPrice?.currency ?? "USD",
      availability,
      tags: unique([...entry.tags, ...entry.variants.flatMap((variant) => variant.attributes)]),
      description,
      action,
      image: entry.media[0]?.url,
      header: entry.header,
      variants: entry.variants,
      media: entry.media.length > 0 ? entry.media : undefined,
      barcode: entry.barcode,
      barcodes: entry.barcodes,
      seller: entry.seller,
      unitPrice: entry.unitPrice,
      condition: entry.condition,
      raw: {
        header: entry.header,
        product: {
          id: entry.productId,
          title: entry.title,
          category: entry.category,
          description,
          action
        },
        variants: entry.variants,
        rows: entry.rows
      }
    };
  });

  return {
    products,
    warnings,
    fieldMappings: {
      header: `${headerIdKeys.join(" | ")} + ${headerTitleKeys.join(" | ")}`,
      product: `${idKeys.join(" | ")} + ${titleKeys.join(" | ")}`,
      variant: `${variantIdKeys.join(" | ")} + ${variantTitleKeys.join(" | ")}`,
      price: `${priceKeys.join(" | ")} + currency`,
      media: mediaKeys.join(" | "),
      barcode: barcodeKeys.join(" | "),
      category: categoryKeys.join(" | "),
      seller: `${sellerNameKeys.join(" | ")} + ${sellerLinkKeys.join(" | ")}`,
      unit_price: `${unitMeasureKeys.join(" | ")} + ${unitReferenceKeys.join(" | ")}`,
      description: descriptionKeys.join(" | "),
      availability: availabilityKeys.join(" | "),
      condition: conditionKeys.join(" | "),
      action: actionKeys.join(" | ")
    }
  };
};

export const mapProductRows = (rows: Record<string, unknown>[]) => {
  if (rows.some(isOfficialCommerceRow)) {
    return mapOfficialCommerceRows(rows);
  }

  return mapLegacyRows(rows);
};

export const extractRowsFromApiResponse = (payload: unknown): Record<string, unknown>[] => {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];

  if (payload && typeof payload === "object") {
    const objectPayload = payload as Record<string, unknown>;
    for (const key of ["products", "items", "results", "data"]) {
      const value = objectPayload[key];
      if (Array.isArray(value)) return value as Record<string, unknown>[];
    }
  }

  return [];
};
