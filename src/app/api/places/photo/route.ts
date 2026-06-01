import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const photoName = request.nextUrl.searchParams.get("name") ?? "";
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey || !photoName) {
    return Response.redirect("https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&h=420&fit=crop");
  }

  const url = `https://places.googleapis.com/v1/${photoName}/media?key=${apiKey}&maxHeightPx=600`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image from Google: ${response.statusText}`);
    }

    const blob = await response.blob();
    const headers = new Headers();
    headers.set("Content-Type", response.headers.get("Content-Type") || "image/jpeg");
    headers.set("Cache-Control", "public, max-age=86400"); // Cache for 1 day

    return new Response(blob, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Error proxying Google Photo:", error);
    return Response.redirect("https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&h=420&fit=crop");
  }
}
