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
    const GEMINI_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GEMINI_KEY) {
      return new Response(JSON.stringify({ error: "GOOGLE_GEMINI_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, prompt, imageBase64, messages, systemPrompt } = body;

    // ── ACTION: generate-image ──
    // Uses gemini-2.0-flash-exp-image-generation with responseModalities: TEXT + IMAGE
    if (action === "generate-image") {
      const parts: any[] = [{ text: prompt || "Generate an image" }];

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
        return new Response(JSON.stringify({ error: "Image generation failed", details: errText }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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
    }

    // ── ACTION: vision (analyze image with text prompt) ──
    if (action === "vision") {
      if (!imageBase64) {
        return new Response(JSON.stringify({ error: "imageBase64 is required for vision" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const mimeMatch = imageBase64.match(/^data:(image\/[^;]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
      const rawBase64 = imageBase64.replace(/^data:image\/[^;]+;base64,/, "");

      const resp = await fetch(
        `${GEMINI_BASE}/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt || "Describe this image" },
                { inline_data: { mime_type: mimeType, data: rawBase64 } },
              ],
            }],
          }),
        }
      );

      if (!resp.ok) {
        const errText = await resp.text();
        console.error("Gemini vision error:", resp.status, errText);
        if (resp.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: "Vision analysis failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await resp.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

      return new Response(JSON.stringify({ text }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: chat ──
    if (action === "chat") {
      const contents: any[] = [];

      if (systemPrompt) {
        contents.push({ role: "user", parts: [{ text: systemPrompt }] });
        contents.push({ role: "model", parts: [{ text: "Understood." }] });
      }

      for (const msg of (messages || [])) {
        contents.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }],
        });
      }

      const resp = await fetch(
        `${GEMINI_BASE}/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents }),
        }
      );

      if (!resp.ok) {
        const errText = await resp.text();
        console.error("Gemini chat error:", resp.status, errText);
        if (resp.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: "Chat failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await resp.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

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
