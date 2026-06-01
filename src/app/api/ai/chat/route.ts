import { NextRequest } from "next/server";
import { getFallbackPlacesForCity } from "@/lib/server/fallback-places";
import { SupportedCityName } from "@/lib/pune-location";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, city } = body as {
      messages: { role: "user" | "model"; content: string }[];
      city: SupportedCityName;
    };

    if (!city) {
      return Response.json({ error: "City is required" }, { status: 400 });
    }

    // Retrieve the API Key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "Gemini API key is not configured" }, { status: 500 });
    }

    // Fetch places for the city to supply as context
    const places = await getFallbackPlacesForCity(city);
    
    // Slice places to top 60 to keep prompt size optimized
    const compactPlaces = places.slice(0, 60).map((p) => ({
      id: p.id,
      title: p.title,
      category: p.category,
      description: p.description,
      tags: p.tags,
      rating: p.rating,
      priceRange: p.priceRange || "unknown",
      locality: p.locality || "unknown",
    }));

    // Formulate system instruction
    const systemInstruction = `You are "Sheher AI Guide", a cinematic, vibe-focused, local-expert assistant for discovery, community hangouts, and mood matching.
Your mission is to help users feel the pulse of their city and find the perfect experiences.

The user is exploring the city of ${city}.
Here is a list of real places available in ${city} for this session:
${JSON.stringify(compactPlaces)}

When answering, you must:
1. Provide a beautiful, conversational, cinematic response tailored to their request. Keep it friendly, slightly poetic, and matching the Netflix/Airbnb vibe (enthusiastic about local culture, street food, and hidden corners).
2. Recommend real places from the list above whenever relevant. Match their mood, budget, and context.
3. If they ask for something that isn't directly in the list, recommend the closest match from the list, or explain the local vibe of the city.
4. Output your response ONLY as a JSON object matching this structure:
   {
     "text": "Your markdown formatted reply here. You can highlight place names in bold like **Cafe Goodluck**. Keep formatting elegant.",
     "placeIds": ["pune-cafe-goodluck", ...] // Array of matching place IDs from the list above (top 2-5 places). Only include IDs that are present in the provided list. Do not make up IDs.
   }
`;

    // Map history to Gemini API format
    const apiMessages = messages.map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    }));

    // Gemini API Request
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: apiMessages,
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.7,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error status:", response.status, errorText);
      return Response.json({ error: "Failed to communicate with Gemini API" }, { status: 500 });
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      return Response.json({ error: "Empty response from AI" }, { status: 500 });
    }

    // Parse the JSON returned by Gemini
    let result;
    try {
      result = JSON.parse(candidateText);
    } catch (e) {
      console.warn("Failed to parse Gemini JSON output, falling back to raw text:", candidateText);
      result = {
        text: candidateText,
        placeIds: [],
      };
    }

    return Response.json(result);
  } catch (error: any) {
    console.error("Error in AI chat route:", error);
    return Response.json({ error: error.message || "An unexpected error occurred" }, { status: 500 });
  }
}
