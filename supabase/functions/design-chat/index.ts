import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AIProvider {
  url: string;
  key: string;
  model: string;
  name: string;
}

function getProviders(): AIProvider[] {
  const providers: AIProvider[] = [];
  const geminiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
  if (geminiKey) {
    providers.push({ url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", key: geminiKey, model: "gemini-2.5-flash", name: "Gemini" });
  }
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (openaiKey) {
    providers.push({ url: "https://api.openai.com/v1/chat/completions", key: openaiKey, model: "gpt-4o-mini", name: "OpenAI" });
  }
  return providers;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, roomContext } = await req.json();
    const providers = getProviders();
    if (providers.length === 0) throw new Error("No AI API keys configured");

    let systemPrompt = `You are RoomBot, an expert AI interior design assistant inside the aivo Design Studio. You help users design and furnish their rooms.

Your capabilities:
- Give layout advice and furniture placement suggestions
- Recommend color schemes, materials, and styles
- Help with lighting decisions
- Suggest furniture pieces that match the room's style

When a user asks to add furniture, respond naturally and include a JSON block:
\`\`\`furniture
{"name": "Item Name", "width": 120, "height": 80, "depth": 60, "color": "#hexcolor", "material": "wood|fabric|metal|glass"}
\`\`\`

Keep responses concise, friendly, and actionable.`;

    if (roomContext) {
      systemPrompt += `\n\nCurrent room context:
- Aesthetic score: ${roomContext.aesthetic_score || "N/A"}/10
- Brightness: ${roomContext.brightness || "N/A"}%
- Objects: ${roomContext.objects?.map((o: any) => o.label).join(", ") || "none"}
- Styles: ${roomContext.top_styles?.map((s: any) => `${s.style} (${Math.round(s.score * 100)}%)`).join(", ") || "unknown"}
- Recommendations: ${roomContext.recommendations?.join("; ") || "none"}`;
    }

    const allMessages = [{ role: "system", content: systemPrompt }, ...messages];

    // Try providers with streaming
    for (const provider of providers) {
      try {
        console.log(`Trying ${provider.name} for chat...`);
        const response = await fetch(provider.url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${provider.key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ model: provider.model, messages: allMessages, stream: true }),
        });

        if (response.ok) {
          console.log(`${provider.name} streaming started`);
          return new Response(response.body, {
            headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
          });
        }
        console.error(`${provider.name} failed: ${response.status}`);
        continue;
      } catch (err) {
        console.error(`${provider.name} error:`, err);
        continue;
      }
    }

    return new Response(JSON.stringify({ error: "All AI providers failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("design-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
