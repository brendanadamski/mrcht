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
  }
];
