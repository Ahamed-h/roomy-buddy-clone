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
    const { messages, roomContext } = await req.json();

    // Build grounded system prompt
    let systemPrompt = `You are RoomBot, an expert AI interior design assistant inside the aivo Design Studio.

CAPABILITIES:
- Give layout advice and furniture placement suggestions
- Recommend color schemes, materials, and styles  
- Help with lighting decisions
- Suggest furniture pieces that match the room's style

RULES:
1. If room analysis data is provided, you MUST reference specific data points in your answers:
   - Mention at least 2 detected objects by name and material
   - Reference at least 1 design metric with its value
   - Mention the detected style
2. All suggestions MUST tie back to the analysis data when available
   - Example: "Since your clutter_control is 0.3, I'd recommend decluttering the desk area"
   - Example: "Your sofa(fabric) pairs well with the lamp(metal) — adding a wooden side table would balance materials"
3. If user asks to redesign/makeover, suggest specific themes based on the detected style
4. Keep responses concise, friendly, and actionable
5. Use markdown formatting for readability`;

    if (roomContext) {
      // Extract key facts for grounding
      const objects = roomContext.objects || [];
      const objStr = objects.slice(0, 5).map((o: any) => 
        `${o.name || o.label}(${o.material || 'unknown'})`
      ).join(", ") || "none detected";

      const metrics = roomContext.design_metrics || {};
      const metricEntries = Object.entries(metrics).slice(0, 5);
      const metricStr = metricEntries.length > 0 
        ? metricEntries.map(([k, v]) => `${k}: ${typeof v === 'number' ? (v as number).toFixed(2) : v}`).join(", ")
        : "N/A";

      const styles = roomContext.possible_styles || [];
      const styleStr = styles.slice(0, 3).join(", ") || "unknown";

      const styleScores = roomContext.style_match_scores || {};
      const topStyleScore = styles[0] && styleScores[styles[0]] 
        ? `${(styleScores[styles[0]] * 100).toFixed(0)}%` 
        : "N/A";

      const aesthetic = roomContext.aesthetic_score ?? "N/A";
      const brightness = roomContext.lighting?.brightness ?? roomContext.brightness ?? "N/A";
      const recommendations = roomContext.recommendations || [];

      systemPrompt += `

═══ ROOM ANALYSIS DATA (REFERENCE THESE IN YOUR ANSWERS) ═══
🎯 Aesthetic Score: ${aesthetic}/10
💡 Brightness: ${brightness}%
🪑 Detected Objects: ${objStr}
📊 Design Metrics: ${metricStr}
🎨 Detected Styles: ${styleStr} (top: ${topStyleScore} confidence)
💡 Current Recommendations: ${recommendations.slice(0, 3).join("; ") || "none"}

IMPORTANT: Your response MUST mention at least 2 of the detected objects and 1 metric above.
DO NOT make up objects or metrics that aren't listed above.`;
    }

    const allMessages = [{ role: "system", content: systemPrompt }, ...messages];

    // Try Lovable AI Gateway first (most reliable)
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (LOVABLE_API_KEY) {
      try {
        console.log("Trying Lovable AI Gateway for chat...");
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: allMessages,
            stream: true,
          }),
        });

        if (response.ok) {
          console.log("Lovable AI streaming started");
          return new Response(response.body, {
            headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
          });
        }

        if (response.status === 429) {
          console.warn("Lovable AI rate limited, falling back...");
        } else if (response.status === 402) {
          console.warn("Lovable AI payment required, falling back...");
        } else {
          console.error("Lovable AI failed:", response.status);
        }
      } catch (err) {
        console.error("Lovable AI error:", err);
      }
    }

    // Fallback: Gemini / OpenAI direct
    const providers: Array<{ url: string; key: string; model: string; name: string }> = [];
    
    const geminiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (geminiKey) {
      providers.push({ url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", key: geminiKey, model: "gemini-2.5-flash", name: "Gemini" });
    }
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (openaiKey) {
      providers.push({ url: "https://api.openai.com/v1/chat/completions", key: openaiKey, model: "gpt-4o-mini", name: "OpenAI" });
    }

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
      } catch (err) {
        console.error(`${provider.name} error:`, err);
      }
    }

    return new Response(JSON.stringify({ error: "All AI providers failed. Please try again." }), {
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
