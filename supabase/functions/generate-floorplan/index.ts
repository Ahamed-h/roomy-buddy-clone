import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
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

    const contentParts: any[] = [{ type: "text", text: prompt }];

    if (imageBase64) {
      const imageUrl = imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;
      contentParts.push({ type: "image_url", image_url: { url: imageUrl } });
    }

    const resp = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: contentParts }],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Lovable AI floorplan gen error:", resp.status, errText);
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Failed to generate floor plan image");
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || "";

    let image_url: string | null = null;
    let description = "";

    if (typeof content === "string") {
      description = content;
    } else if (Array.isArray(content)) {
      for (const part of content) {
        if (part.type === "image_url" && part.image_url?.url) {
          image_url = part.image_url.url;
        } else if (part.type === "text") {
          description += part.text;
        }
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
