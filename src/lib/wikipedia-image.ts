import { getCache, setCache } from "@/lib/redis";

const upscaleWikiThumb = (url: string, width = 500) =>
  url.replace(/\/\d+px-/, `/${width}px-`).replace(/\/thumb\//, "/thumb/");

interface WikiCacheEntry {
  image: string | null;
}

export const fetchWikipediaThumbnail = async (searchTitle: string): Promise<string | null> => {
  const key = searchTitle.trim().toLowerCase();
  if (!key) return null;

  const cacheKey = `wiki:thumb:${key}`;
  const cached = await getCache<WikiCacheEntry>(cacheKey);
  if (cached) {
    return cached.image;
  }

  try {
    const response = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(searchTitle.trim())}`,
      { next: { revalidate: 60 * 60 * 24 * 7 } }
    );

    if (!response.ok) {
      await setCache<WikiCacheEntry>(cacheKey, { image: null }, 60 * 60 * 24 * 7);
      return null;
    }

    const data = (await response.json()) as { thumbnail?: { source?: string } };
    const source = data.thumbnail?.source;
    const image = source ? upscaleWikiThumb(source) : null;
    await setCache<WikiCacheEntry>(cacheKey, { image }, 60 * 60 * 24 * 7);
    return image;
  } catch {
    await setCache<WikiCacheEntry>(cacheKey, { image: null }, 60 * 60 * 24 * 7);
    return null;
  }
};

export const fetchWikipediaThumbnailWithFallbacks = async (titles: string[]) => {
  for (const title of titles) {
    const image = await fetchWikipediaThumbnail(title);
    if (image) return image;
  }
  return null;
};
