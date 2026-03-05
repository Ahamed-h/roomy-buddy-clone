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
          model: "google/gemini-2.5-flash-image",
          messages: [{ role: "user", content: contentParts }],
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        console.error("Lovable AI image gen error:", resp.status, errText);
        if (resp.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (resp.status === 402) {
          return new Response(JSON.stringify({ error: "Payment required. Please add credits to your workspace." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: "Image generation failed", details: errText }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await resp.json();
      const content = data.choices?.[0]?.message?.content || "";

      // The Lovable AI gateway returns text content; for image generation model
      // it may return inline base64 image data or a text description
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
          model: "google/gemini-2.5-flash",
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
        const errText = await resp.text();
        console.error("Lovable AI vision error:", resp.status, errText);
        if (resp.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (resp.status === 402) {
          return new Response(JSON.stringify({ error: "Payment required. Please add credits." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: "Vision analysis failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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
          model: "google/gemini-2.5-flash",
          messages: chatMessages,
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        console.error("Lovable AI chat error:", resp.status, errText);
        if (resp.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (resp.status === 402) {
          return new Response(JSON.stringify({ error: "Payment required. Please add credits." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: "Chat failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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
