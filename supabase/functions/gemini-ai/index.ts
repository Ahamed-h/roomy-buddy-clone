import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Models
const IMAGE_GEN_MODEL = "google/gemini-2.5-flash-image";
const VISION_MODEL = "google/gemini-2.5-flash";
const CHAT_MODEL = "google/gemini-3-flash-preview";

/** Helper to handle rate limit / payment errors */
function handleErrorResponse(status: number, errText: string, context: string) {
  console.error(`${context} error:`, status, errText);
  if (status === 429) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
      status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (status === 402) {
    return new Response(JSON.stringify({ error: "Payment required. Please add credits to your workspace." }), {
      status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ error: `${context} failed`, details: errText }), {
    status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, prompt, imageBase64, messages, systemPrompt } = body;

    // ── ACTION: generate-image ──
    if (action === "generate-image") {
      const contentParts: any[] = [
        { type: "text", text: prompt || "Generate an image" },
      ];

      if (imageBase64) {
        contentParts.push({
          type: "image_url",
          image_url: { url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}` },
        });
      }

      const resp = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: IMAGE_GEN_MODEL,
          messages: [{ role: "user", content: contentParts }],
          modalities: ["image", "text"],
        }),
      });

      if (!resp.ok) {
        return handleErrorResponse(resp.status, await resp.text(), "Image generation");
      }

      const data = await resp.json();
      const msg = data.choices?.[0]?.message;
      const description = msg?.content || "";

      // Extract image from the images array (Lovable AI Gateway format)
      const image_url = msg?.images?.[0]?.image_url?.url || null;

      return new Response(JSON.stringify({ image_url, description }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: vision (analyze image with text prompt) ──
    if (action === "vision") {
      if (!imageBase64) {
        return new Response(JSON.stringify({ error: "imageBase64 is required for vision" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const imageUrl = imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;

      const resp = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: VISION_MODEL,
          messages: [{
            role: "user",
            content: [
              { type: "text", text: prompt || "Describe this image" },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          }],
        }),
      });

      if (!resp.ok) {
        return handleErrorResponse(resp.status, await resp.text(), "Vision analysis");
      }

      const data = await resp.json();
      const text = data.choices?.[0]?.message?.content || "";

      return new Response(JSON.stringify({ text }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: chat ──
    if (action === "chat") {
      const chatMessages: any[] = [];

      if (systemPrompt) {
        chatMessages.push({ role: "system", content: systemPrompt });
      }

      for (const msg of (messages || [])) {
        chatMessages.push({
          role: msg.role === "assistant" ? "assistant" : "user",
          content: msg.content,
        });
      }

      const resp = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: CHAT_MODEL,
          messages: chatMessages,
        }),
      });

      if (!resp.ok) {
        return handleErrorResponse(resp.status, await resp.text(), "Chat");
      }

      const data = await resp.json();
      const text = data.choices?.[0]?.message?.content || "";

      return new Response(JSON.stringify({ text }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action. Use: generate-image, vision, or chat" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("gemini-ai error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
