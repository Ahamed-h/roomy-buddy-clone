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
    providers.push({ url: "https://api.openai.com/v1/chat/completions", key: openaiKey, model: "gpt-4o", name: "OpenAI" });
  }
  return providers;
}

async function callAI(providers: AIProvider[], messages: any[]): Promise<any> {
  for (const provider of providers) {
    try {
      console.log(`Trying ${provider.name}...`);
      const response = await fetch(provider.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${provider.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: provider.model, messages }),
      });
      if (response.ok) {
        console.log(`${provider.name} succeeded`);
        return await response.json();
      }
      console.error(`${provider.name} failed: ${response.status}`);
    } catch (err) {
      console.error(`${provider.name} error:`, err);
    }
  }
  throw new Error("All AI providers failed");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { analysisResult, imageBase64 } = await req.json();
    const providers = getProviders();
    if (providers.length === 0) throw new Error("No AI API keys configured");

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

    const data = await callAI(providers, [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: `Verify these ML results:\n\n${JSON.stringify(analysisResult, null, 2)}\n\nExamine the photo and return corrected JSON.` },
          { type: "image_url", image_url: { url: imageBase64 } },
        ],
      },
    ]);

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
