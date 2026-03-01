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
    const { analysisResult, imageBase64 } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are an expert interior design AI verifier. You will receive:
1. A room photo
2. ML analysis results from local models (object detection, style classification, aesthetic scoring)

Your job is to cross-check and correct the analysis by examining the actual photo. Return a JSON object with your corrections.

Rules:
- Compare detected objects against what you actually see in the photo. Add any missed objects, remove false positives.
- Verify the style classifications make sense for what you see.
- Adjust the aesthetic score if the ML model seems off (justify briefly).
- Improve recommendations based on what you actually observe.
- Keep the same JSON structure as the input analysis.

Return ONLY a valid JSON object with these fields:
{
  "aesthetic_score": number (0-10),
  "lighting": { "brightness": number (0-100) },
  "objects": [{ "name": string, "confidence": number, "material": string, "distance_m": number, "source": string }],
  "style_match_scores": { "StyleName": number },
  "possible_styles": [string],
  "recommendations": [string],
  "corrections_summary": string (brief description of what you changed and why)
}`;

    const userContent = [
      {
        type: "text",
        text: `Here are the ML analysis results to verify:\n\n${JSON.stringify(analysisResult, null, 2)}\n\nPlease examine the photo below and cross-check these results. Return corrected JSON.`,
      },
      {
        type: "image_url",
        image_url: { url: imageBase64 },
      },
    ];

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI verification service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Extract JSON from the response (handle markdown code blocks)
    let correctedResult;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
      correctedResult = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response as JSON:", content);
      return new Response(
        JSON.stringify({ error: "AI returned invalid JSON", rawResponse: content }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
