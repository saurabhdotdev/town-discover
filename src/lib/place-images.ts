import { PlaceCategory } from "@/types";
import { SupportedCityName } from "@/lib/pune-location";

const W = 500;

/** Verified Wikimedia / Wikipedia image URLs (India-local). */
export const PLACE_IMAGE_URLS: Record<string, string> = {
  "pune-shaniwar-wada": `https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Front_view_of_Shaniwar_Wada_illuminated.jpg/${W}px-Front_view_of_Shaniwar_Wada_illuminated.jpg`,
  "pune-aga-khan-palace": `https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Aga_Khan_Palace%2C_Pune.jpg/${W}px-Aga_Khan_Palace%2C_Pune.jpg`,
  "pune-sarasbaug-parvati-plan": `https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Saras_Bagh%2CPune%2CIndia.JPG/${W}px-Saras_Bagh%2CPune%2CIndia.JPG`,
  "pune-pu-la-deshpande-garden": `https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Saras_Bagh%2CPune%2CIndia.JPG/${W}px-Saras_Bagh%2CPune%2CIndia.JPG`,
  "pune-misal-jm-road": `https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Misal_maharashtran_specialty.jpg/${W}px-Misal_maharashtran_specialty.jpg`,
  "pune-fc-road-street-food": `https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Vada_pav.jpg/${W}px-Vada_pav.jpg`,
  "pune-free-walking-tour": `https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Front_view_of_Shaniwar_Wada_illuminated.jpg/${W}px-Front_view_of_Shaniwar_Wada_illuminated.jpg`,
  "pune-sinhagad-fort-trek": `https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Sinhagad_Fort.jpg/${W}px-Sinhagad_Fort.jpg`,
  "mumbai-marine-drive": `https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Mumbai_03-2016_27_skyline_at_Marine_Drive.jpg/${W}px-Mumbai_03-2016_27_skyline_at_Marine_Drive.jpg`,
  "mumbai-elephanta-ferry": `https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Mumbai_03-2016_27_skyline_at_Marine_Drive.jpg/${W}px-Mumbai_03-2016_27_skyline_at_Marine_Drive.jpg`,
  "kolhapur-mahalaxmi-temple": `https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Mahalaxmi_Temple%2C_Kolhapur.jpg/${W}px-Mahalaxmi_Temple%2C_Kolhapur.jpg`,
  "kolhapur-rankala-lake": `https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Rankala_Lake_Kolhapur.png/${W}px-Rankala_Lake_Kolhapur.png`,
  "kolhapur-phadatare-misal": `https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Misal_maharashtran_specialty.jpg/${W}px-Misal_maharashtran_specialty.jpg`,
  "nashik-sula-vineyards": `https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Sula-Logo.jpg/${W}px-Sula-Logo.jpg`,
  "nashik-panchavati-walk": `https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Trimbakeshwar_Temple-Nashik-Maharashtra-1.jpg/${W}px-Trimbakeshwar_Temple-Nashik-Maharashtra-1.jpg`,
  "nashik-trimbakeshwar-day": `https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Trimbakeshwar_Temple-Nashik-Maharashtra-1.jpg/${W}px-Trimbakeshwar_Temple-Nashik-Maharashtra-1.jpg`,
  "town-nashik-godavari-aarti": `https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Trimbakeshwar_Temple-Nashik-Maharashtra-1.jpg/${W}px-Trimbakeshwar_Temple-Nashik-Maharashtra-1.jpg`,
};

/** Wikipedia page titles to try when no curated URL exists. */
export const WIKIPEDIA_QUERIES_BY_ID: Record<string, string[]> = {
  "pune-pataleshwar-short-visit": ["Pataleshwar", "Pataleshwar Cave Temple", "Pune"],
  "pune-kelkar-museum": ["Raja Dinkar Kelkar Museum", "Kelkar Museum Pune"],
  "pune-dagdusheth-tulshibaug-loop": ["Shreemant Dagdusheth Halwai Ganapati Mandir", "Dagdusheth Ganpati Pune"],
  "pune-baner-hill": ["Sinhagad", "Baner Pune"],
  "pune-osho-meditation-garden": ["Osho International Meditation Resort", "Pune"],
  "pune-vaishali": ["Vaishali (restaurant)", "South Indian breakfast"],
  "pune-goodluck-cafe": ["Goodluck Cafe Pune", "Irani cafe Pune"],
  "mumbai-leopold-cafe": ["Leopold Cafe", "Colaba Mumbai"],
  "mumbai-prithvi-cafe": ["Prithvi Theatre", "Juhu Mumbai"],
  "mumbai-bademiya": ["Mohammed Ali Road", "Bademiya Mumbai"],
  "mumbai-powai-lake-walk": ["Powai Lake", "Mumbai"],
  "kolhapur-dehaati": ["Kolhapur", "Kolhapuri cuisine"],
  "kolhapur-pantry-museum": ["New Palace, Kolhapur", "Kolhapur"],
  "nashik-curry-leaves": ["Nashik", "College Road Nashik"],
  "town-pune-open-mic-koregaon": ["Koregaon Park", "Pune"],
  "town-mumbai-art-walk": ["Kala Ghoda", "Mumbai"],
  "town-mumbai-street-food-crawl": ["Mohammed Ali Road", "Mumbai street food"],
  "town-kolhapur-wrestling-akharas": ["Kolhapur", "Kushti"],
  "town-kolhapur-handicraft-bazaar": ["Kolhapur chappal", "Kolhapur"],
};



const TITLE_IMAGE_KEYWORDS: { pattern: RegExp; url: string }[] = [
  {
    pattern: /shaniwar|wada/i,
    url: PLACE_IMAGE_URLS["pune-shaniwar-wada"],
  },
  {
    pattern: /pataleshwar|cave/i,
    url: `https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Pataleshwar_cave_temple_Pune.jpg/${W}px-Pataleshwar_cave_temple_Pune.jpg`,
  },
  {
    pattern: /aga khan/i,
    url: PLACE_IMAGE_URLS["pune-aga-khan-palace"],
  },
  {
    pattern: /marine drive/i,
    url: PLACE_IMAGE_URLS["mumbai-marine-drive"],
  },
  {
    pattern: /mahalaxmi|mahalakshmi/i,
    url: PLACE_IMAGE_URLS["kolhapur-mahalaxmi-temple"],
  },
  {
    pattern: /rankala/i,
    url: PLACE_IMAGE_URLS["kolhapur-rankala-lake"],
  },
  {
    pattern: /sula|vineyard/i,
    url: PLACE_IMAGE_URLS["nashik-sula-vineyards"],
  },
  {
    pattern: /trimbak|trimbakeshwar/i,
    url: PLACE_IMAGE_URLS["nashik-trimbakeshwar-day"],
  },
  {
    pattern: /godavari|ramkund|ghat/i,
    url: PLACE_IMAGE_URLS["town-nashik-godavari-aarti"],
  },
  {
    pattern: /misal/i,
    url: PLACE_IMAGE_URLS["pune-misal-jm-road"],
  },
  {
    pattern: /sinhagad|fort/i,
    url: PLACE_IMAGE_URLS["pune-sinhagad-fort-trek"],
  },
];

const getDeterministicIndex = (str: string, length: number): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % length;
};

const BEAUTIFUL_FALLBACK_IMAGES = [
  {
    keywords: ["pizza", "pizzeria"],
    urls: [
      "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1590947132387-155cc02f3212?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=640&q=80"
    ]
  },
  {
    keywords: ["burger", "sandwich", "subway", "club"],
    urls: [
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=640&q=80"
    ]
  },
  {
    keywords: ["coffee", "cafe", "espresso", "roaster", "starbucks", "chai", "tea", "bakery", "bake", "breakfast"],
    urls: [
      "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=640&q=80"
    ]
  },
  {
    keywords: ["beer", "brewery", "pub", "bar", "cocktail", "lounge", "wine", "spirit", "martini", "liquor", "club", "disco"],
    urls: [
      "https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1574096079513-d8259312b785?auto=format&fit=crop&w=640&q=80"
    ]
  },
  {
    keywords: ["ice cream", "gelato", "waffle", "dessert", "cake", "sweet", "pastry", "chocolate", "donut", "crepe"],
    urls: [
      "https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1501443762994-82bd5dace89a?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=640&q=80"
    ]
  },
  {
    keywords: ["biryani", "curry", "kebab", "tandoori", "dhaba", "indian", "masala", "roti", "paneer", "misal", "pav", "thali"],
    urls: [
      "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=640&q=80"
    ]
  },
  {
    keywords: ["chinese", "momo", "noodle", "ramen", "sushi", "japanese", "asian", "thai", "dim sum", "korean", "wok"],
    urls: [
      "https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1583623025817-d180a2221d0a?auto=format&fit=crop&w=640&q=80"
    ]
  },
  {
    keywords: ["park", "garden", "lake", "hill", "trek", "outdoor", "nature", "forest", "zoo", "fort", "heritage", "walk"],
    urls: [
      "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=640&q=80"
    ]
  },
  {
    keywords: ["museum", "art", "theatre", "cinema", "gallery", "exhibition", "cultural", "monument", "temple", "church", "historic"],
    urls: [
      "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1508919801845-fc2ae1bc2a28?auto=format&fit=crop&w=640&q=80"
    ]
  },
  {
    keywords: ["mall", "plaza", "market", "bazaar", "shop", "store", "boutique", "fashion"],
    urls: [
      "https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=640&q=80"
    ]
  }
];

const CATEGORY_POOLS: Record<PlaceCategory, string[]> = {
  cafe: [
    "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=640&q=80"
  ],
  restaurant: [
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=640&q=80"
  ],
  bar: [
    "https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1574096079513-d8259312b785?auto=format&fit=crop&w=640&q=80"
  ],
  nightlife: [
    "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=640&q=80"
  ],
  event: [
    "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=640&q=80"
  ],
  "food-stall": [
    "https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=640&q=80"
  ],
  dessert: [
    "https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1501443762994-82bd5dace89a?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=640&q=80"
  ],
  "ice-cream": [
    "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1570197788417-0e82375c9be7?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1501443762994-82bd5dace89a?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=640&q=80"
  ],
  "street-food": [
    "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=640&q=80"
  ]
};

export const getCategoryFallbackImage = (
  city: SupportedCityName,
  category: PlaceCategory,
  title?: string
): string => {
  if (!title) {
    const pool = CATEGORY_POOLS[category] || CATEGORY_POOLS.event;
    return pool[0];
  }

  const lowercaseTitle = title.toLowerCase();

  // Try matching keywords first
  for (const group of BEAUTIFUL_FALLBACK_IMAGES) {
    if (group.keywords.some((kw) => lowercaseTitle.includes(kw))) {
      const idx = getDeterministicIndex(title, group.urls.length);
      return group.urls[idx];
    }
  }

  // Fallback to category pool
  const pool = CATEGORY_POOLS[category] || CATEGORY_POOLS.event;
  const idx = getDeterministicIndex(title, pool.length);
  return pool[idx];
};

export const resolveImageFromOsmTags = (tags: Record<string, string>): string | null => {
  const direct = tags.image?.trim() || tags["image:url"]?.trim();
  if (direct?.startsWith("http")) return direct;

  const commonsRaw = tags.wikimedia_commons || tags["wikimedia_commons:image"];
  if (commonsRaw) {
    const fileName = commonsRaw.replace(/^File:/i, "").replace(/^Image:/i, "").trim();
    if (fileName) {
      return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=${W}`;
    }
  }

  return null;
};

const resolveImageFromTitle = (title: string): string | null => {
  for (const { pattern, url } of TITLE_IMAGE_KEYWORDS) {
    if (pattern.test(title)) return url;
  }
  return null;
};

export const resolvePlaceImage = (options: {
  id: string;
  title: string;
  category: PlaceCategory;
  city: SupportedCityName;
  osmTags?: Record<string, string>;
}): string => {
  if (PLACE_IMAGE_URLS[options.id]) {
    return PLACE_IMAGE_URLS[options.id];
  }

  const fromOsm = options.osmTags ? resolveImageFromOsmTags(options.osmTags) : null;
  if (fromOsm) return fromOsm;

  const fromTitle = resolveImageFromTitle(options.title);
  if (fromTitle) return fromTitle;

  return getCategoryFallbackImage(options.city, options.category, options.title);
};
