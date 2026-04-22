import type { Product } from "../types";

export const demoProducts: Product[] = [
  {
    id: "SKU-MRCHT-TEE-BLUE",
    title: "MRCHT Blue Everyday Tee",
    category: "Apparel & Accessories > Clothing > Shirts & Tops",
    price: 25,
    currency: "USD",
    availability: "in_stock",
    tags: ["color:Blue", "size:M", "shirt", "tee"],
    description: "Soft cotton tee in a bright blue colorway for daily wear.",
    action: "checkout",
    image: "https://images.pexels.com/photos/20228403/pexels-photo-20228403.jpeg?auto=compress&cs=tinysrgb&w=1200",
    header: { id: "header-apparel", title: "Apparel" },
    variants: [
      {
        id: "SKU-MRCHT-TEE-BLUE-M",
        title: "Blue / Medium",
        sku: "SKU-MRCHT-TEE-BLUE-M",
        price: { amount: 25, currency: "USD" },
        media: [{ url: "https://images.pexels.com/photos/20228403/pexels-photo-20228403.jpeg?auto=compress&cs=tinysrgb&w=1200" }],
        availability: "in_stock",
        attributes: ["color:Blue", "size:M"]
      }
    ],
    media: [{ url: "https://images.pexels.com/photos/20228403/pexels-photo-20228403.jpeg?auto=compress&cs=tinysrgb&w=1200" }],
    condition: "new"
  },
  {
    id: "SKU-MRCHT-DUFFEL-ATLAS",
    title: "Atlas Weekender Duffel",
    category: "Luggage & Bags > Duffel Bags",
    price: 148,
    currency: "USD",
    availability: "limited",
    tags: ["carry-on", "water-resistant", "travel", "gift"],
    description: "Carry-on duffel with a shoe tunnel, laptop sleeve, recycled shell, and quick-access side pocket.",
    action: "checkout",
    image: "https://images.pexels.com/photos/13872590/pexels-photo-13872590.jpeg?auto=compress&cs=tinysrgb&w=1200",
    header: { id: "header-travel", title: "Travel" },
    variants: [
      {
        id: "SKU-MRCHT-DUFFEL-ATLAS-STD",
        title: "Standard",
        sku: "SKU-MRCHT-DUFFEL-ATLAS-STD",
        price: { amount: 148, currency: "USD" },
        media: [{ url: "https://images.pexels.com/photos/13872590/pexels-photo-13872590.jpeg?auto=compress&cs=tinysrgb&w=1200" }],
        availability: "limited",
        attributes: ["carry-on", "water-resistant"]
      }
    ],
    media: [{ url: "https://images.pexels.com/photos/13872590/pexels-photo-13872590.jpeg?auto=compress&cs=tinysrgb&w=1200" }],
    condition: "new"
  },
  {
    id: "SKU-MRCHT-GRINDER-DIAL",
    title: "Dial-In Burr Grinder",
    category: "Kitchen > Coffee Grinders",
    price: 229,
    currency: "USD",
    availability: "in_stock",
    tags: ["coffee", "espresso", "quiet", "gift"],
    description: "Compact grinder with 48 settings, low-retention dosing, and a removable anti-static cup.",
    action: "checkout",
    image: "https://images.pexels.com/photos/12859329/pexels-photo-12859329.jpeg?auto=compress&cs=tinysrgb&w=1200",
    header: { id: "header-kitchen", title: "Kitchen" },
    variants: [
      {
        id: "SKU-MRCHT-GRINDER-DIAL-STD",
        title: "Standard",
        sku: "SKU-MRCHT-GRINDER-DIAL-STD",
        price: { amount: 229, currency: "USD" },
        media: [{ url: "https://images.pexels.com/photos/12859329/pexels-photo-12859329.jpeg?auto=compress&cs=tinysrgb&w=1200" }],
        availability: "in_stock",
        attributes: ["coffee", "espresso", "quiet"]
      }
    ],
    media: [{ url: "https://images.pexels.com/photos/12859329/pexels-photo-12859329.jpeg?auto=compress&cs=tinysrgb&w=1200" }],
    condition: "new"
  },
  {
    id: "SKU-MRCHT-CHAIR-NORTHSTAR",
    title: "Northstar Task Chair",
    category: "Furniture > Office Chairs",
    price: 395,
    currency: "USD",
    availability: "out_of_stock",
    tags: ["ergonomic", "home office", "adjustable"],
    description: "Adjustable work chair with breathable mesh, lumbar support, and a narrow footprint.",
    action: "lead_form",
    image: "https://images.pexels.com/photos/4305707/pexels-photo-4305707.jpeg?auto=compress&cs=tinysrgb&w=1200",
    header: { id: "header-furniture", title: "Furniture" },
    variants: [
      {
        id: "SKU-MRCHT-CHAIR-NORTHSTAR-STD",
        title: "Standard",
        sku: "SKU-MRCHT-CHAIR-NORTHSTAR-STD",
        price: { amount: 395, currency: "USD" },
        media: [{ url: "https://images.pexels.com/photos/4305707/pexels-photo-4305707.jpeg?auto=compress&cs=tinysrgb&w=1200" }],
        availability: "out_of_stock",
        attributes: ["ergonomic", "home office", "adjustable"]
      }
    ],
    media: [{ url: "https://images.pexels.com/photos/4305707/pexels-photo-4305707.jpeg?auto=compress&cs=tinysrgb&w=1200" }],
    condition: "new"
  },
  {
    id: "SKU-MRCHT-JACKET-SUMMIT",
    title: "Summit Trail Jacket",
    category: "Apparel & Accessories > Clothing > Outerwear",
    price: 98,
    currency: "USD",
    availability: "limited",
    tags: ["jacket", "rain", "outerwear", "trail"],
    description: "Water-resistant shell jacket with vented back panel and packable hood.",
    action: "test_drive",
    image: "https://images.pexels.com/photos/7679720/pexels-photo-7679720.jpeg?auto=compress&cs=tinysrgb&w=1200",
    header: { id: "header-apparel", title: "Apparel" },
    variants: [
      {
        id: "SKU-MRCHT-JACKET-SUMMIT-OLIVE-L",
        title: "Olive / Large",
        sku: "SKU-MRCHT-JACKET-SUMMIT-OLIVE-L",
        price: { amount: 98, currency: "USD" },
        media: [{ url: "https://images.pexels.com/photos/7679720/pexels-photo-7679720.jpeg?auto=compress&cs=tinysrgb&w=1200" }],
        availability: "limited",
        attributes: ["jacket", "rain", "olive", "size:L"]
      }
    ],
    media: [{ url: "https://images.pexels.com/photos/7679720/pexels-photo-7679720.jpeg?auto=compress&cs=tinysrgb&w=1200" }],
    condition: "new"
  },
  {
    id: "SKU-MRCHT-SPINNER-AERO",
    title: "Aero Carry-On Spinner",
    category: "Luggage & Bags > Carry-On Luggage",
    price: 189,
    currency: "USD",
    availability: "in_stock",
    tags: ["travel", "carry-on", "luggage", "gift"],
    description: "Hard-shell carry-on with quiet wheels, compression panel, and TSA lock.",
    action: "checkout",
    image: "https://images.pexels.com/photos/1545743/pexels-photo-1545743.jpeg?auto=compress&cs=tinysrgb&w=1200",
    header: { id: "header-travel", title: "Travel" },
    variants: [
      {
        id: "SKU-MRCHT-SPINNER-AERO-22",
        title: "22 Inch",
        sku: "SKU-MRCHT-SPINNER-AERO-22",
        price: { amount: 189, currency: "USD" },
        media: [{ url: "https://images.pexels.com/photos/1545743/pexels-photo-1545743.jpeg?auto=compress&cs=tinysrgb&w=1200" }],
        availability: "in_stock",
        attributes: ["carry-on", "spinner", "22-inch"]
      }
    ],
    media: [{ url: "https://images.pexels.com/photos/1545743/pexels-photo-1545743.jpeg?auto=compress&cs=tinysrgb&w=1200" }],
    condition: "new"
  },
  {
    id: "SKU-MRCHT-MEALPREP-SLATE",
    title: "Slate Meal Prep Set",
    category: "Home & Garden > Kitchen & Dining > Food Storage",
    price: 42,
    currency: "USD",
    availability: "in_stock",
    tags: ["kitchen", "meal prep", "containers", "storage"],
    description: "Glass meal-prep containers with leak-resistant lids and stackable storage.",
    action: "checkout",
    image: "https://images.pexels.com/photos/1640774/pexels-photo-1640774.jpeg?auto=compress&cs=tinysrgb&w=1200",
    header: { id: "header-kitchen", title: "Kitchen" },
    variants: [
      {
        id: "SKU-MRCHT-MEALPREP-SLATE-10PC",
        title: "10 Piece",
        sku: "SKU-MRCHT-MEALPREP-SLATE-10PC",
        price: { amount: 42, currency: "USD" },
        media: [{ url: "https://images.pexels.com/photos/1640774/pexels-photo-1640774.jpeg?auto=compress&cs=tinysrgb&w=1200" }],
        availability: "in_stock",
        attributes: ["kitchen", "10-piece", "food storage"]
      }
    ],
    media: [{ url: "https://images.pexels.com/photos/1640774/pexels-photo-1640774.jpeg?auto=compress&cs=tinysrgb&w=1200" }],
    condition: "new"
  },
  {
    id: "SKU-MRCHT-KETTLE-GROVE",
    title: "Grove Pour-Over Kettle",
    category: "Kitchen > Coffee & Tea Accessories",
    price: 89,
    currency: "USD",
    availability: "in_stock",
    tags: ["coffee", "tea", "kettle", "espresso"],
    description: "Gooseneck kettle with precision spout and temperature hold for brewing.",
    action: "checkout",
    image: "https://images.pexels.com/photos/4226806/pexels-photo-4226806.jpeg?auto=compress&cs=tinysrgb&w=1200",
    header: { id: "header-kitchen", title: "Kitchen" },
    variants: [
      {
        id: "SKU-MRCHT-KETTLE-GROVE-STD",
        title: "Standard",
        sku: "SKU-MRCHT-KETTLE-GROVE-STD",
        price: { amount: 89, currency: "USD" },
        media: [{ url: "https://images.pexels.com/photos/4226806/pexels-photo-4226806.jpeg?auto=compress&cs=tinysrgb&w=1200" }],
        availability: "in_stock",
        attributes: ["gooseneck", "brew", "kitchen"]
      }
    ],
    media: [{ url: "https://images.pexels.com/photos/4226806/pexels-photo-4226806.jpeg?auto=compress&cs=tinysrgb&w=1200" }],
    condition: "new"
  },
  {
    id: "SKU-MRCHT-EARBUDS-DRIFT",
    title: "Drift Noise-Cancel Earbuds",
    category: "Electronics > Headphones",
    price: 159,
    currency: "USD",
    availability: "in_stock",
    tags: ["audio", "wireless", "earbuds", "gift"],
    description: "Wireless earbuds with adaptive noise canceling and a compact charging case.",
    action: "checkout",
    image: "https://images.pexels.com/photos/3780681/pexels-photo-3780681.jpeg?auto=compress&cs=tinysrgb&w=1200",
    header: { id: "header-electronics", title: "Electronics" },
    variants: [
      {
        id: "SKU-MRCHT-EARBUDS-DRIFT-BLK",
        title: "Black",
        sku: "SKU-MRCHT-EARBUDS-DRIFT-BLK",
        price: { amount: 159, currency: "USD" },
        media: [{ url: "https://images.pexels.com/photos/3780681/pexels-photo-3780681.jpeg?auto=compress&cs=tinysrgb&w=1200" }],
        availability: "in_stock",
        attributes: ["anc", "wireless", "black"]
      }
    ],
    media: [{ url: "https://images.pexels.com/photos/3780681/pexels-photo-3780681.jpeg?auto=compress&cs=tinysrgb&w=1200" }],
    condition: "new"
  },
  {
    id: "SKU-MRCHT-MAT-TERRA",
    title: "Terra Yoga Mat",
    category: "Sporting Goods > Exercise Mats",
    price: 54,
    currency: "USD",
    availability: "in_stock",
    tags: ["fitness", "yoga", "mat", "wellness"],
    description: "High-grip yoga mat with alignment markers and cushioned support.",
    action: "checkout",
    image: "https://images.pexels.com/photos/3822864/pexels-photo-3822864.jpeg?auto=compress&cs=tinysrgb&w=1200",
    header: { id: "header-fitness", title: "Fitness" },
    variants: [
      {
        id: "SKU-MRCHT-MAT-TERRA-6MM",
        title: "6mm",
        sku: "SKU-MRCHT-MAT-TERRA-6MM",
        price: { amount: 54, currency: "USD" },
        media: [{ url: "https://images.pexels.com/photos/3822864/pexels-photo-3822864.jpeg?auto=compress&cs=tinysrgb&w=1200" }],
        availability: "in_stock",
        attributes: ["6mm", "non-slip", "exercise"]
      }
    ],
    media: [{ url: "https://images.pexels.com/photos/3822864/pexels-photo-3822864.jpeg?auto=compress&cs=tinysrgb&w=1200" }],
    condition: "new"
  },
  {
    id: "SKU-MRCHT-WATCH-PULSE",
    title: "Pulse Smartwatch",
    category: "Electronics > Wearable Technology",
    price: 249,
    currency: "USD",
    availability: "limited",
    tags: ["smartwatch", "fitness", "wearable", "gps"],
    description: "GPS smartwatch with sleep insights, workout modes, and seven-day battery.",
    action: "test_drive",
    image: "https://images.pexels.com/photos/267394/pexels-photo-267394.jpeg?auto=compress&cs=tinysrgb&w=1200",
    header: { id: "header-electronics", title: "Electronics" },
    variants: [
      {
        id: "SKU-MRCHT-WATCH-PULSE-44",
        title: "44mm",
        sku: "SKU-MRCHT-WATCH-PULSE-44",
        price: { amount: 249, currency: "USD" },
        media: [{ url: "https://images.pexels.com/photos/267394/pexels-photo-267394.jpeg?auto=compress&cs=tinysrgb&w=1200" }],
        availability: "limited",
        attributes: ["44mm", "gps", "health tracking"]
      }
    ],
    media: [{ url: "https://images.pexels.com/photos/267394/pexels-photo-267394.jpeg?auto=compress&cs=tinysrgb&w=1200" }],
    condition: "new"
  },
  {
    id: "SKU-MRCHT-OVERSHIRT-EMBER",
    title: "Ember Wool Overshirt",
    category: "Apparel & Accessories > Clothing > Outerwear",
    price: 129,
    currency: "USD",
    availability: "limited",
    tags: ["overshirt", "wool", "layering", "fall"],
    description: "Warm overshirt with brushed wool blend and button-front utility pockets.",
    action: "lead_form",
    image: "https://images.pexels.com/photos/428338/pexels-photo-428338.jpeg?auto=compress&cs=tinysrgb&w=1200",
    header: { id: "header-apparel", title: "Apparel" },
    variants: [
      {
        id: "SKU-MRCHT-OVERSHIRT-EMBER-M",
        title: "Rust / Medium",
        sku: "SKU-MRCHT-OVERSHIRT-EMBER-M",
        price: { amount: 129, currency: "USD" },
        media: [{ url: "https://images.pexels.com/photos/428338/pexels-photo-428338.jpeg?auto=compress&cs=tinysrgb&w=1200" }],
        availability: "limited",
        attributes: ["rust", "size:M", "wool blend"]
      }
    ],
    media: [{ url: "https://images.pexels.com/photos/428338/pexels-photo-428338.jpeg?auto=compress&cs=tinysrgb&w=1200" }],
    condition: "new"
  },
  {
    id: "SKU-MRCHT-DESK-MERIDIAN",
    title: "Meridian Standing Desk",
    category: "Furniture > Desks",
    price: 599,
    currency: "USD",
    availability: "out_of_stock",
    tags: ["desk", "standing desk", "office", "workspace"],
    description: "Electric sit-stand desk with memory presets, cable tray, and solid top.",
    action: "lead_form",
    image: "https://images.pexels.com/photos/667838/pexels-photo-667838.jpeg?auto=compress&cs=tinysrgb&w=1200",
    header: { id: "header-furniture", title: "Furniture" },
    variants: [
      {
        id: "SKU-MRCHT-DESK-MERIDIAN-55",
        title: "55 Inch",
        sku: "SKU-MRCHT-DESK-MERIDIAN-55",
        price: { amount: 599, currency: "USD" },
        media: [{ url: "https://images.pexels.com/photos/667838/pexels-photo-667838.jpeg?auto=compress&cs=tinysrgb&w=1200" }],
        availability: "out_of_stock",
        attributes: ["sit-stand", "55-inch", "home office"]
      }
    ],
    media: [{ url: "https://images.pexels.com/photos/667838/pexels-photo-667838.jpeg?auto=compress&cs=tinysrgb&w=1200" }],
    condition: "new"
  },
  {
    id: "SKU-MRCHT-MUG-NOVA",
    title: "Nova Travel Mug",
    category: "Home & Garden > Kitchen & Dining > Drinkware",
    price: 32,
    currency: "USD",
    availability: "in_stock",
    tags: ["travel mug", "coffee", "insulated", "gift"],
    description: "Insulated stainless travel mug with lockable lid and ceramic-coated interior.",
    action: "checkout",
    image: "https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress&cs=tinysrgb&w=1200",
    header: { id: "header-kitchen", title: "Kitchen" },
    variants: [
      {
        id: "SKU-MRCHT-MUG-NOVA-16",
        title: "16 oz",
        sku: "SKU-MRCHT-MUG-NOVA-16",
        price: { amount: 32, currency: "USD" },
        media: [{ url: "https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress&cs=tinysrgb&w=1200" }],
        availability: "in_stock",
        attributes: ["16oz", "insulated", "leak resistant"]
      }
    ],
    media: [{ url: "https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress&cs=tinysrgb&w=1200" }],
    condition: "new"
  },
  {
    id: "SKU-MRCHT-SLING-HARBOR",
    title: "Harbor Sling Pack",
    category: "Luggage & Bags > Backpacks & Sling Bags",
    price: 68,
    currency: "USD",
    availability: "in_stock",
    tags: ["sling", "bag", "travel", "edc"],
    description: "Compact sling pack with quick-access front pocket and padded strap.",
    action: "checkout",
    image: "https://images.pexels.com/photos/1545746/pexels-photo-1545746.jpeg?auto=compress&cs=tinysrgb&w=1200",
    header: { id: "header-travel", title: "Travel" },
    variants: [
      {
        id: "SKU-MRCHT-SLING-HARBOR-STD",
        title: "Standard",
        sku: "SKU-MRCHT-SLING-HARBOR-STD",
        price: { amount: 68, currency: "USD" },
        media: [{ url: "https://images.pexels.com/photos/1545746/pexels-photo-1545746.jpeg?auto=compress&cs=tinysrgb&w=1200" }],
        availability: "in_stock",
        attributes: ["crossbody", "edc", "lightweight"]
      }
    ],
    media: [{ url: "https://images.pexels.com/photos/1545746/pexels-photo-1545746.jpeg?auto=compress&cs=tinysrgb&w=1200" }],
    condition: "new"
  }
];
