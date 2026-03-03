import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { analysisResult, imageBase64 } = await req.json();
    const GEMINI_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GEMINI_KEY) throw new Error("GOOGLE_GEMINI_API_KEY is not configured");

    const systemPrompt = `You are an expert interior design AI verifier. You will receive:
1. A room photo
2. ML analysis results from local models

Your job is to cross-check and correct the analysis. Return ONLY valid JSON:
{
  "aesthetic_score": number (0-10),
  "lighting": { "brightness": number (0-100) },
  "objects": [{ "name": string, "confidence": number, "material": string, "distance_m": number, "source": string }],
  "style_match_scores": { "StyleName": number },
  "possible_styles": [string],
  "recommendations": [string],
  "corrections_summary": string
}`;

    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: `Verify these ML results:\n\n${JSON.stringify(analysisResult, null, 2)}\n\nExamine the photo and return corrected JSON.` },
              { type: "image_url", image_url: { url: imageBase64 } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("Gemini error:", response.status, errText);
      throw new Error(`Gemini error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    let correctedResult;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
      correctedResult = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(JSON.stringify({ error: "AI returned invalid JSON", rawResponse: content }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(correctedResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("verify-analysis error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
