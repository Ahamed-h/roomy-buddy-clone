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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build system prompt with room context
    let systemPrompt = `You are RoomBot, an expert AI interior design assistant inside the aivo Design Studio. You help users design and furnish their rooms.

Your capabilities:
- Give layout advice and furniture placement suggestions
- Recommend color schemes, materials, and styles
- Help with lighting decisions
- Suggest furniture pieces that match the room's style
- Answer questions about interior design principles

When a user asks to add furniture, respond naturally and include a JSON block that the frontend will parse to add furniture. Format:
\`\`\`furniture
{"name": "Item Name", "width": 120, "height": 80, "depth": 60, "color": "#hexcolor", "material": "wood|fabric|metal|glass"}
\`\`\`

Keep responses concise, friendly, and actionable. Use emoji sparingly.`;

    if (roomContext) {
      systemPrompt += `\n\nCurrent room context from AI evaluation:
- Aesthetic score: ${roomContext.aesthetic_score || "N/A"}/10
- Brightness: ${roomContext.brightness || "N/A"}%
- Objects detected: ${roomContext.objects?.map((o: any) => o.label).join(", ") || "none"}
- Top styles: ${roomContext.top_styles?.map((s: any) => `${s.style} (${Math.round(s.score * 100)}%)`).join(", ") || "unknown"}
- Recommendations: ${roomContext.recommendations?.join("; ") || "none"}

Use this context to give personalized advice.`;
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits in Lovable settings." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("design-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
