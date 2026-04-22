import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
const loadEnvFile = (filePath) => {
    if (!fs.existsSync(filePath))
        return;
    const raw = fs.readFileSync(filePath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#"))
            continue;
        const eqIndex = trimmed.indexOf("=");
        if (eqIndex <= 0)
            continue;
        const key = trimmed.slice(0, eqIndex).trim();
        if (!key || process.env[key] !== undefined)
            continue;
        let value = trimmed.slice(eqIndex + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        process.env[key] = value;
    }
};
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, "..");
loadEnvFile(path.join(projectRoot, ".env"));
loadEnvFile(path.join(projectRoot, ".env.local"));
const DEMO_FEED_ID = "feed_mrcht_city_commuter_v2";
const DEMO_ACCOUNT_ID = "acct_mrcht_demo";
const DEMO_MERCHANT = "MRCHT";
const DEMO_COUNTRY = "US";
const makeRow = (seed) => ({
    feed_id: DEMO_FEED_ID,
    account_id: DEMO_ACCOUNT_ID,
    target_merchant: DEMO_MERCHANT,
    target_country: DEMO_COUNTRY,
    id: seed.id,
    title: seed.title,
    description_plain: seed.description,
    url: `https://example.com/products/${seed.slug}`,
    product_media_url: seed.imageUrl,
    product_media_alt_text: seed.imageAlt,
    variant_id: seed.variantId,
    variant_title: seed.variantTitle,
    variant_description_plain: seed.variantDescription,
    variant_url: `https://example.com/products/${seed.slug}?variant=${encodeURIComponent(seed.variantTitle.toLowerCase().replace(/\s+/g, "-"))}`,
    variant_media_url: seed.imageUrl,
    variant_media_alt_text: seed.imageAlt,
    variant_barcode_type: "gtin",
    variant_barcode_value: seed.barcode,
    price_amount: seed.priceAmount,
    price_currency: "USD",
    list_price_amount: seed.listPriceAmount,
    list_price_currency: "USD",
    unit_price_amount: seed.unitPrice?.amount,
    unit_price_currency: seed.unitPrice?.currency,
    unit_price_measure_value: seed.unitPrice?.measureValue,
    unit_price_measure_unit: seed.unitPrice?.measureUnit,
    unit_price_reference_value: seed.unitPrice?.referenceValue,
    unit_price_reference_unit: seed.unitPrice?.referenceUnit,
    availability_available: seed.availabilityAvailable,
    availability_status: seed.availabilityStatus,
    category_value: seed.category,
    category_taxonomy: "merchant",
    condition: "new",
    option_color: seed.color,
    option_size: seed.size,
    seller_name: DEMO_MERCHANT,
    seller_link_type: seed.sellerLinkType ?? "faq",
    seller_link_title: seed.sellerLinkTitle ?? "Commuter FAQ",
    seller_link_url: seed.sellerLinkUrl ?? "https://example.com/help/commuter-faq",
    tags: seed.tags,
    action: seed.action
});
const productRows = [
    makeRow({
        id: "SKU-MRCHT-BACKPACK-METRO-20",
        title: "Metro Commuter Backpack 20L",
        description: "Water-resistant commuter backpack with suspended laptop sleeve, trolley pass-through, and hidden passport pocket.",
        slug: "metro-commuter-backpack-20l",
        imageUrl: "https://images.pexels.com/photos/2905238/pexels-photo-2905238.jpeg?auto=compress&cs=tinysrgb&w=1200",
        imageAlt: "Commuter backpack on a train seat",
        variantId: "SKU-MRCHT-BACKPACK-METRO-20-BLK",
        variantTitle: "Black / 20L",
        variantDescription: "Compact 20L commuter backpack for daily transit.",
        barcode: "00012345679901",
        priceAmount: 12900,
        listPriceAmount: 15900,
        availabilityAvailable: true,
        availabilityStatus: "in_stock",
        category: "Luggage & Bags > Backpacks",
        color: "black",
        size: "20L",
        tags: "commute;backpack;laptop;travel",
        action: "checkout"
    }),
    makeRow({
        id: "SKU-MRCHT-SLING-TRANSIT-5",
        title: "Transit Sling 5L",
        description: "Crossbody sling with quick-draw front pocket and tablet compartment for city movement.",
        slug: "transit-sling-5l",
        imageUrl: "https://images.pexels.com/photos/1545743/pexels-photo-1545743.jpeg?auto=compress&cs=tinysrgb&w=1200",
        imageAlt: "Compact sling bag worn crossbody",
        variantId: "SKU-MRCHT-SLING-TRANSIT-5-GRY",
        variantTitle: "Graphite / 5L",
        variantDescription: "Hands-free commuter sling for small essentials.",
        barcode: "00012345679918",
        priceAmount: 6900,
        listPriceAmount: 8900,
        availabilityAvailable: true,
        availabilityStatus: "in_stock",
        category: "Luggage & Bags > Backpacks & Sling Bags",
        color: "graphite",
        size: "5L",
        tags: "commute;sling;edc;city",
        action: "checkout"
    }),
    makeRow({
        id: "SKU-MRCHT-ORGANIZER-CABLE-TECH",
        title: "Tech Cable Organizer Pouch",
        description: "Structured organizer with elastic loops and mesh sleeves for chargers, cables, and adapters.",
        slug: "tech-cable-organizer-pouch",
        imageUrl: "https://images.pexels.com/photos/4219862/pexels-photo-4219862.jpeg?auto=compress&cs=tinysrgb&w=1200",
        imageAlt: "Tech organizer with cables and adapters",
        variantId: "SKU-MRCHT-ORGANIZER-CABLE-TECH-STD",
        variantTitle: "Standard",
        variantDescription: "Slim travel organizer for commute tech gear.",
        barcode: "00012345679925",
        priceAmount: 3900,
        listPriceAmount: 5200,
        availabilityAvailable: true,
        availabilityStatus: "in_stock",
        category: "Electronics > Computer Accessories",
        color: "charcoal",
        size: "Standard",
        tags: "organizer;cables;tech;travel",
        action: "checkout"
    }),
    makeRow({
        id: "SKU-MRCHT-MUG-COMMUTE-16",
        title: "Commuter Insulated Mug 16oz",
        description: "Leak-resistant travel mug with ceramic-lined interior and one-handed flip lid.",
        slug: "commuter-insulated-mug-16oz",
        imageUrl: "https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress&cs=tinysrgb&w=1200",
        imageAlt: "Insulated mug on office desk",
        variantId: "SKU-MRCHT-MUG-COMMUTE-16-SAND",
        variantTitle: "Sand / 16oz",
        variantDescription: "Daily commuter mug that keeps drinks warm through morning transit.",
        barcode: "00012345679932",
        priceAmount: 3400,
        listPriceAmount: 4400,
        availabilityAvailable: true,
        availabilityStatus: "in_stock",
        category: "Home & Garden > Kitchen & Dining > Drinkware",
        color: "sand",
        size: "16oz",
        tags: "mug;coffee;commute;insulated",
        action: "checkout",
        sellerLinkType: "shipping_policy",
        sellerLinkTitle: "Shipping Policy",
        sellerLinkUrl: "https://example.com/policies/shipping",
        unitPrice: {
            amount: 212,
            currency: "USD",
            measureValue: 1,
            measureUnit: "oz",
            referenceValue: 1,
            referenceUnit: "oz"
        }
    }),
    makeRow({
        id: "SKU-MRCHT-UMBRELLA-QUICKDRY",
        title: "QuickDry Compact Umbrella",
        description: "Wind-resistant compact umbrella with auto-open button and reflective edge trim.",
        slug: "quickdry-compact-umbrella",
        imageUrl: "https://images.pexels.com/photos/163255/schirm-regenschirm-rain-protection-163255.jpeg?auto=compress&cs=tinysrgb&w=1200",
        imageAlt: "Compact umbrella for rainy commute",
        variantId: "SKU-MRCHT-UMBRELLA-QUICKDRY-NAVY",
        variantTitle: "Navy / One Size",
        variantDescription: "Pocketable commuter umbrella for sudden rain.",
        barcode: "00012345679949",
        priceAmount: 2800,
        listPriceAmount: 3600,
        availabilityAvailable: true,
        availabilityStatus: "limited",
        category: "Home & Garden > Umbrellas",
        color: "navy",
        size: "One Size",
        tags: "umbrella;rain;commute;weather",
        action: "checkout"
    }),
    makeRow({
        id: "SKU-MRCHT-TEE-MERINO-CITY",
        title: "City Merino Commuter Tee",
        description: "Odor-resistant merino blend tee designed for all-day wear and active commuting.",
        slug: "city-merino-commuter-tee",
        imageUrl: "https://images.pexels.com/photos/6311613/pexels-photo-6311613.jpeg?auto=compress&cs=tinysrgb&w=1200",
        imageAlt: "Minimal merino t-shirt",
        variantId: "SKU-MRCHT-TEE-MERINO-CITY-M",
        variantTitle: "Slate / M",
        variantDescription: "Breathable merino tee for office and post-work movement.",
        barcode: "00012345679956",
        priceAmount: 5200,
        listPriceAmount: 6800,
        availabilityAvailable: true,
        availabilityStatus: "in_stock",
        category: "Apparel & Accessories > Clothing > Shirts & Tops",
        color: "slate",
        size: "M",
        tags: "apparel;merino;commute;everyday",
        action: "checkout"
    }),
    makeRow({
        id: "SKU-MRCHT-SHELL-PACKABLE",
        title: "Packable Rain Shell",
        description: "Lightweight waterproof shell that packs into its own pocket for unpredictable weather.",
        slug: "packable-rain-shell",
        imageUrl: "https://images.pexels.com/photos/936094/pexels-photo-936094.jpeg?auto=compress&cs=tinysrgb&w=1200",
        imageAlt: "Packable rain shell jacket",
        variantId: "SKU-MRCHT-SHELL-PACKABLE-L",
        variantTitle: "Black / L",
        variantDescription: "Weatherproof outer layer sized for commuting backpacks.",
        barcode: "00012345679963",
        priceAmount: 11900,
        listPriceAmount: 14900,
        availabilityAvailable: true,
        availabilityStatus: "backorder",
        category: "Apparel & Accessories > Clothing > Outerwear",
        color: "black",
        size: "L",
        tags: "rain shell;outerwear;commute;travel",
        action: "lead_form",
        sellerLinkType: "faq",
        sellerLinkTitle: "Restock FAQ",
        sellerLinkUrl: "https://example.com/help/restocks"
    }),
    makeRow({
        id: "SKU-MRCHT-EARBUDS-CITY-ANC",
        title: "City ANC Earbuds",
        description: "Noise-canceling earbuds with transparency mode tuned for transit announcements.",
        slug: "city-anc-earbuds",
        imageUrl: "https://images.pexels.com/photos/3780681/pexels-photo-3780681.jpeg?auto=compress&cs=tinysrgb&w=1200",
        imageAlt: "Wireless earbuds and charging case",
        variantId: "SKU-MRCHT-EARBUDS-CITY-ANC-BLK",
        variantTitle: "Black",
        variantDescription: "Compact ANC earbuds for subway and office transitions.",
        barcode: "00012345679970",
        priceAmount: 14900,
        listPriceAmount: 18900,
        availabilityAvailable: true,
        availabilityStatus: "in_stock",
        category: "Electronics > Headphones",
        color: "black",
        size: "Standard",
        tags: "audio;earbuds;anc;commute",
        action: "test_drive",
        sellerLinkType: "terms_of_service",
        sellerLinkTitle: "Device Terms",
        sellerLinkUrl: "https://example.com/policies/terms"
    }),
    makeRow({
        id: "SKU-MRCHT-POWERBANK-10000",
        title: "FastCharge Power Bank 10000mAh",
        description: "Slim USB-C power bank with pass-through charging and cable indicator lights.",
        slug: "fastcharge-power-bank-10000mah",
        imageUrl: "https://images.pexels.com/photos/4526407/pexels-photo-4526407.jpeg?auto=compress&cs=tinysrgb&w=1200",
        imageAlt: "Portable power bank on work table",
        variantId: "SKU-MRCHT-POWERBANK-10000-BLK",
        variantTitle: "Black / 10000mAh",
        variantDescription: "All-day backup battery for phone and earbuds.",
        barcode: "00012345679987",
        priceAmount: 4900,
        listPriceAmount: 6500,
        availabilityAvailable: true,
        availabilityStatus: "in_stock",
        category: "Electronics > Batteries & Power",
        color: "black",
        size: "10000mAh",
        tags: "power bank;charging;travel;electronics",
        action: "checkout"
    }),
    makeRow({
        id: "SKU-MRCHT-CABLEKIT-TRAVEL",
        title: "Travel Cable Kit",
        description: "Compact cable kit with USB-C, Lightning, and mini adapter set for commuter bags.",
        slug: "travel-cable-kit",
        imageUrl: "https://images.pexels.com/photos/7580521/pexels-photo-7580521.jpeg?auto=compress&cs=tinysrgb&w=1200",
        imageAlt: "Small travel cable set in case",
        variantId: "SKU-MRCHT-CABLEKIT-TRAVEL-STD",
        variantTitle: "Standard",
        variantDescription: "Core travel cables and adapters in one pocket-sized kit.",
        barcode: "00012345679994",
        priceAmount: 2600,
        listPriceAmount: 3400,
        availabilityAvailable: true,
        availabilityStatus: "in_stock",
        category: "Electronics > Cables & Adapters",
        color: "graphite",
        size: "Standard",
        tags: "cables;adapters;travel;tech",
        action: "checkout"
    }),
    makeRow({
        id: "SKU-MRCHT-SLEEVE-LAPTOP-14",
        title: "Transit Laptop Sleeve 14in",
        description: "Padded laptop sleeve with magnetic flap and front document pocket for commute-ready carry.",
        slug: "transit-laptop-sleeve-14in",
        imageUrl: "https://images.pexels.com/photos/1714208/pexels-photo-1714208.jpeg?auto=compress&cs=tinysrgb&w=1200",
        imageAlt: "Laptop sleeve and notebook on desk",
        variantId: "SKU-MRCHT-SLEEVE-LAPTOP-14-GRY",
        variantTitle: "Graphite / 14in",
        variantDescription: "Protective sleeve sized for modern 14-inch laptops.",
        barcode: "00012345680007",
        priceAmount: 4200,
        listPriceAmount: 5600,
        availabilityAvailable: true,
        availabilityStatus: "limited",
        category: "Electronics > Laptop Accessories",
        color: "graphite",
        size: "14in",
        tags: "laptop;sleeve;work;commute",
        action: "checkout"
    }),
    makeRow({
        id: "SKU-MRCHT-CUBES-COMPRESS-3",
        title: "Compression Packing Cubes Set",
        description: "Three-piece compression cube set to organize gym gear and spare layers for longer days.",
        slug: "compression-packing-cubes-set",
        imageUrl: "https://images.pexels.com/photos/2064344/pexels-photo-2064344.jpeg?auto=compress&cs=tinysrgb&w=1200",
        imageAlt: "Packing cubes arranged in travel bag",
        variantId: "SKU-MRCHT-CUBES-COMPRESS-3-NAVY",
        variantTitle: "Navy / 3-piece",
        variantDescription: "Lightweight cube set that maximizes bag space for daily carry.",
        barcode: "00012345680014",
        priceAmount: 3800,
        listPriceAmount: 5000,
        availabilityAvailable: false,
        availabilityStatus: "out_of_stock",
        category: "Luggage & Bags > Travel Organizers",
        color: "navy",
        size: "3-piece",
        tags: "packing cubes;organizer;travel;commute",
        action: "lead_form",
        sellerLinkType: "faq",
        sellerLinkTitle: "Restock FAQ",
        sellerLinkUrl: "https://example.com/help/restocks"
    })
];
const searchableText = (row) => [
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
const isRecord = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
const extractResponseText = (payload) => {
    if (!isRecord(payload))
        return "";
    if (typeof payload.output_text === "string")
        return payload.output_text;
    const output = payload.output;
    if (!Array.isArray(output))
        return "";
    const textParts = [];
    for (const item of output) {
        if (!isRecord(item))
            continue;
        const content = item.content;
        if (!Array.isArray(content))
            continue;
        for (const part of content) {
            if (!isRecord(part))
                continue;
            const text = part.text;
            if (typeof text === "string")
                textParts.push(text);
        }
    }
    return textParts.join("\n").trim();
};
const parseAutofillFromText = (text) => {
    const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start)
        return {};
    try {
        const parsed = JSON.parse(cleaned.slice(start, end + 1));
        return isRecord(parsed) ? parsed : {};
    }
    catch {
        return {};
    }
};
const normalizeAutofillResult = (value, fallback) => {
    const availability = value.availability;
    const action = value.action;
    const normalizedPrice = Number(value.price);
    return {
        title: typeof value.title === "string" && value.title.trim() ? value.title.trim() : fallback?.title?.trim() || "Custom item",
        description: typeof value.description === "string" && value.description.trim() ? value.description.trim() : fallback?.description?.trim() || "No description provided.",
        category: typeof value.category === "string" && value.category.trim() ? value.category.trim() : fallback?.category?.trim() || "Custom > Featured Item",
        tags: Array.isArray(value.tags) ? value.tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
        price: Number.isFinite(normalizedPrice) && normalizedPrice > 0 ? normalizedPrice : Math.max(1, Number(fallback?.price) || 49),
        currency: typeof value.currency === "string" && value.currency.trim() ? value.currency.trim().toUpperCase() : (fallback?.currency?.trim().toUpperCase() || "USD"),
        availability: availability === "in_stock" || availability === "limited" || availability === "out_of_stock" || availability === "unknown" ? availability : "in_stock",
        action: action === "checkout" || action === "test_drive" || action === "lead_form" || action === "none" ? action : "checkout"
    };
};
const nowIso = () => new Date().toISOString();
const toSpecMedia = (url, altText) => url
    ? [
        {
            type: "image",
            url,
            alt_text: altText || undefined
        }
    ]
    : [];
const rowToSpecProduct = (row) => ({
    id: row.id,
    title: row.title,
    description: { plain: row.description_plain },
    url: row.url,
    media: toSpecMedia(row.product_media_url, row.product_media_alt_text),
    variants: [
        {
            id: row.variant_id,
            title: row.variant_title,
            description: { plain: row.variant_description_plain },
            url: row.variant_url,
            barcodes: [{ type: row.variant_barcode_type, value: row.variant_barcode_value }],
            price: { amount: row.price_amount, currency: row.price_currency },
            list_price: { amount: row.list_price_amount, currency: row.list_price_currency },
            unit_price: row.unit_price_amount && row.unit_price_currency && row.unit_price_measure_value && row.unit_price_measure_unit && row.unit_price_reference_value && row.unit_price_reference_unit
                ? {
                    amount: row.unit_price_amount,
                    currency: row.unit_price_currency,
                    measure: { value: row.unit_price_measure_value, unit: row.unit_price_measure_unit },
                    reference: { value: row.unit_price_reference_value, unit: row.unit_price_reference_unit }
                }
                : undefined,
            availability: {
                available: row.availability_available,
                status: row.availability_status
            },
            categories: [{ value: row.category_value, taxonomy: row.category_taxonomy }],
            condition: [row.condition],
            variant_options: [
                { name: "color", value: row.option_color },
                { name: "size", value: row.option_size }
            ],
            media: toSpecMedia(row.variant_media_url, row.variant_media_alt_text),
            seller: {
                name: row.seller_name,
                links: [
                    {
                        type: row.seller_link_type,
                        title: row.seller_link_title,
                        url: row.seller_link_url
                    }
                ]
            }
        }
    ]
});
const catalogById = new Map(productRows.map((row) => [row.id, row]));
const defaultFeed = {
    id: DEMO_FEED_ID,
    target_country: DEMO_COUNTRY,
    updated_at: nowIso(),
    products: productRows.map(rowToSpecProduct)
};
const feedStore = new Map([[defaultFeed.id, defaultFeed]]);
const isObject = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
const deepMerge = (base, incoming) => {
    if (!isObject(base))
        return incoming;
    if (!isObject(incoming))
        return incoming;
    const result = { ...base };
    for (const [key, value] of Object.entries(incoming)) {
        if (value === undefined)
            continue;
        if (Array.isArray(value)) {
            result[key] = value;
            continue;
        }
        result[key] = key in result ? deepMerge(result[key], value) : value;
    }
    return result;
};
const validCountryCode = (value) => {
    if (typeof value !== "string")
        return undefined;
    const code = value.trim().toUpperCase();
    return /^[A-Z]{2}$/.test(code) ? code : undefined;
};
const app = express();
const port = Number(process.env.PORT ?? 8787);
app.use(cors());
app.use(express.json({ limit: "8mb" }));
app.get("/health", (_request, response) => {
    response.json({ ok: true, service: "agentic-commerce-workbench-api" });
});
app.get("/product_feeds/:id", (request, response) => {
    const feed = feedStore.get(request.params.id);
    if (!feed) {
        response.status(404).json({ error: "Feed not found" });
        return;
    }
    response.json({
        id: feed.id,
        target_country: feed.target_country,
        updated_at: feed.updated_at
    });
});
app.post("/product_feeds", (request, response) => {
    const requestedCountry = validCountryCode(request.body?.target_country);
    if (request.body?.target_country !== undefined && !requestedCountry) {
        response.status(400).json({ error: "target_country must be a two-letter ISO 3166 country code." });
        return;
    }
    const id = `feed_${Math.random().toString(36).slice(2, 10)}`;
    const feed = {
        id,
        target_country: requestedCountry,
        updated_at: nowIso(),
        products: []
    };
    feedStore.set(id, feed);
    response.json({
        id: feed.id,
        target_country: feed.target_country,
        updated_at: feed.updated_at
    });
});
app.get("/product_feeds/:id/products", (request, response) => {
    const feed = feedStore.get(request.params.id);
    if (!feed) {
        response.status(404).json({ error: "Feed not found" });
        return;
    }
    response.json({
        target_country: feed.target_country,
        products: feed.products
    });
});
app.patch("/product_feeds/:id/products", (request, response) => {
    const feed = feedStore.get(request.params.id);
    if (!feed) {
        response.status(404).json({ error: "Feed not found" });
        return;
    }
    const body = (request.body ?? {});
    if (!Array.isArray(body.products) || body.products.length === 0) {
        response.status(400).json({ error: "products must be a non-empty array." });
        return;
    }
    const requestedCountry = body.target_country === undefined ? undefined : validCountryCode(body.target_country);
    if (body.target_country !== undefined && !requestedCountry) {
        response.status(400).json({ error: "target_country must be a two-letter ISO 3166 country code." });
        return;
    }
    const byId = new Map(feed.products.map((item) => [item.id, item]));
    for (const partial of body.products) {
        const id = typeof partial.id === "string" ? partial.id.trim() : "";
        if (!id) {
            response.status(400).json({ error: "Each product must include a non-empty id." });
            return;
        }
        const existing = byId.get(id);
        const next = existing ? deepMerge(existing, partial) : { id, variants: [], ...partial };
        byId.set(id, next);
    }
    feed.products = Array.from(byId.values());
    feed.target_country = requestedCountry ?? feed.target_country;
    feed.updated_at = nowIso();
    feedStore.set(feed.id, feed);
    response.json({
        id: feed.id,
        accepted: true
    });
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
app.post("/mock-api/autofill-item", async (request, response) => {
    const body = (request.body ?? {});
    const imageUrl = String(body.imageUrl ?? "").trim();
    if (!imageUrl) {
        response.status(400).json({ error: "imageUrl is required." });
        return;
    }
    if (imageUrl.startsWith("data:image/") && Buffer.byteLength(imageUrl, "utf8") > 2_000_000) {
        response.status(413).json({ error: "Image payload is too large. Upload a smaller image and try again." });
        return;
    }
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        response.status(503).json({ error: "OPENAI_API_KEY is not configured on the backend." });
        return;
    }
    try {
        const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
        const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                input: [
                    {
                        role: "system",
                        content: [
                            {
                                type: "input_text",
                                text: 'You are filling commerce product fields from an image. Return ONLY JSON with keys: title, description, category, tags (array of strings), price (number in dollars), currency, availability (in_stock|limited|out_of_stock|unknown), action (checkout|test_drive|lead_form|none). Keep values realistic and concise.'
                            }
                        ]
                    },
                    {
                        role: "user",
                        content: [
                            {
                                type: "input_text",
                                text: "Analyze this product photo and infer sensible catalog fields."
                            },
                            {
                                type: "input_image",
                                image_url: imageUrl
                            }
                        ]
                    }
                ]
            })
        });
        if (!openAiResponse.ok) {
            const errorText = await openAiResponse.text();
            response.status(502).json({ error: `OpenAI request failed: ${errorText}` });
            return;
        }
        const payload = (await openAiResponse.json());
        const text = extractResponseText(payload);
        const parsed = parseAutofillFromText(text);
        const normalized = normalizeAutofillResult(parsed, body.fields);
        response.json(normalized);
    }
    catch (error) {
        response.status(500).json({ error: error instanceof Error ? error.message : "Autofill failed." });
    }
});
app.listen(port, () => {
    console.log(`Mock commerce API running on http://localhost:${port}`);
});
