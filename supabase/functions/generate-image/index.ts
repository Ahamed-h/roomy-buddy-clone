import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, imageBase64 } = await req.json();

    // For image generation, try Gemini first (image gen model), then OpenAI (DALL-E), then Lovable
    const geminiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    

    // Try Gemini image generation
    if (geminiKey) {
      try {
        console.log("Trying Gemini for image generation...");
        const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${geminiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gemini-2.0-flash-exp-image-generation",
            messages: [{
              role: "user",
              content: [
                { type: "text", text: `Redesign this room with the following style: ${prompt}. Keep the same room layout but transform the style, furniture, colors, and materials. Make it photorealistic.` },
                ...(imageBase64 ? [{ type: "image_url", image_url: { url: imageBase64 } }] : []),
              ],
            }],
            modalities: ["image", "text"],
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
          const textContent = data.choices?.[0]?.message?.content || "";
          if (imageUrl) {
            return new Response(JSON.stringify({ image_url: imageUrl, description: textContent }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
        console.error("Gemini image gen failed:", response.status);
      } catch (err) {
        console.error("Gemini error:", err);
      }
    }

    // Try OpenAI DALL-E
    if (openaiKey) {
      try {
        console.log("Trying OpenAI DALL-E...");
        const response = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "dall-e-3",
            prompt: `Interior design: ${prompt}. Photorealistic room redesign.`,
            n: 1,
            size: "1024x1024",
            response_format: "b64_json",
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const b64 = data.data?.[0]?.b64_json;
          if (b64) {
            return new Response(JSON.stringify({ image_url: `data:image/png;base64,${b64}`, description: "Generated with DALL-E 3" }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
        console.error("OpenAI DALL-E failed:", response.status);
      } catch (err) {
        console.error("OpenAI error:", err);
      }
    }

    // Try Lovable AI Gateway with Gemini image model
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (lovableKey) {
      try {
        console.log("Trying Lovable AI Gateway for image generation...");
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image",
            messages: [{
              role: "user",
              content: [
                { type: "text", text: `Generate a photorealistic interior design image: ${prompt}. Transform the style, furniture, colors, and materials while keeping the same room layout.` },
                ...(imageBase64 ? [{ type: "image_url", image_url: { url: imageBase64 } }] : []),
              ],
            }],
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content || "";
          // Check for inline base64 image in response
          const imgMatch = content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/);
          if (imgMatch) {
            return new Response(JSON.stringify({ image_url: imgMatch[0], description: "Generated with Lovable AI" }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          // Return text description as fallback
          if (content) {
            return new Response(JSON.stringify({ description: content }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } else {
          const errText = await response.text();
          console.error("Lovable AI image gen failed:", response.status, errText);
        }
      } catch (err) {
        console.error("Lovable AI error:", err);
      }
    }

    return new Response(JSON.stringify({ error: "All image generation providers failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-image error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
