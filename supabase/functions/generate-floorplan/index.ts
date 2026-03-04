import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { analysisData, aiSuggestions, userSuggestions, imageBase64 } = await req.json();

    if (!analysisData) {
      return new Response(JSON.stringify({ error: "analysisData is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GEMINI_KEY) {
      throw new Error("GOOGLE_GEMINI_API_KEY is not configured");
    }

    const rooms = analysisData.rooms || [];
    const roomDescriptions = rooms.map((r: any) =>
      `${r.label || r.type} (${r.estimatedSqFt || 0} sq ft)`
    ).join(", ");

    const aiRecsList = (aiSuggestions || []).map((s: string) => `- ${s}`).join("\n");
    const userReqs = userSuggestions || "";

    const prompt = `You are an expert architectural floor plan designer. Redesign this floor plan as a clean, professional architectural drawing.

CURRENT ROOMS: ${roomDescriptions}
TOTAL AREA: ${analysisData.totalArea || "unknown"} sq ft
LAYOUT SCORE: ${analysisData.score || "N/A"}/10

AI RECOMMENDATIONS TO APPLY:
${aiRecsList || "None"}

USER REQUIREMENTS:
${userReqs || "None specified"}

Generate a clean, professional 2D architectural floor plan drawing showing the redesigned layout. Include room labels, dimensions, doors, and windows. Top-down view, architectural style.`;

    // Build parts
    const parts: any[] = [{ text: prompt }];

    if (imageBase64) {
      const mimeMatch = imageBase64.match(/^data:(image\/[^;]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
      const rawBase64 = imageBase64.replace(/^data:image\/[^;]+;base64,/, "");
      parts.push({ inline_data: { mime_type: mimeType, data: rawBase64 } });
    }

    const resp = await fetch(
      `${GEMINI_BASE}/gemini-2.0-flash-exp-image-generation:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
      }
    );

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Gemini image gen error:", resp.status, errText);
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Failed to generate floor plan image");
    }

    const data = await resp.json();
    const resParts = data.candidates?.[0]?.content?.parts || [];

    let image_url: string | null = null;
    let description = "";

    for (const part of resParts) {
      if (part.inline_data) {
        image_url = `data:${part.inline_data.mime_type};base64,${part.inline_data.data}`;
      } else if (part.text) {
        description += part.text;
      }
    }

    return new Response(JSON.stringify({ image_url, description }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("generate-floorplan error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
