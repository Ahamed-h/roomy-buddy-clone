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
    const { imageBase64 } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "imageBase64 is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are an expert architectural floor plan analyzer. Given a floor plan image, extract the walls and furniture items with their approximate positions and dimensions.

Return ONLY a valid JSON object (no markdown, no explanation) with this exact structure:
{
  "walls": [
    { "start": { "x": <number>, "y": <number> }, "end": { "x": <number>, "y": <number> }, "thickness": <number> }
  ],
  "furniture": [
    { "type": "<string>", "label": "<string>", "position": { "x": <number>, "y": <number> }, "rotation": <number>, "width": <number>, "depth": <number>, "height": <number> }
  ]
}

Coordinate system:
- Use a 10x10 meter grid (values 0-10 for x and y)
- Wall thickness is typically 0.15-0.25 meters
- Furniture types must be one of: bed, sofa, table, chair, cabinet, toilet, desk, shelf, wardrobe
- Rotation is in degrees (0-360)
- Width, depth, height in meters (realistic furniture dimensions)
- Position is the center point of the furniture

Analyze the image carefully:
1. Identify all walls by their start and end coordinates
2. Identify all furniture items, their types, and approximate positions
3. Use realistic dimensions for all items
4. If you cannot clearly identify something, make a reasonable guess based on the room layout`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this floor plan image and extract all walls and furniture with their positions and dimensions." },
              { type: "image_url", image_url: { url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/png;base64,${imageBase64}` } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || "";

    // Extract JSON from the response (handle markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);

    // Add IDs to walls and furniture
    const walls = (parsed.walls || []).map((w: any, i: number) => ({
      id: `w-ai-${i}`,
      start: w.start,
      end: w.end,
      thickness: w.thickness || 0.15,
    }));

    const furniture = (parsed.furniture || []).map((f: any, i: number) => ({
      id: `f-ai-${i}`,
      type: f.type || "table",
      label: f.label || f.type || "Item",
      position: f.position,
      rotation: f.rotation || 0,
      width: f.width || 1,
      depth: f.depth || 1,
      height: f.height || 1,
    }));

    return new Response(JSON.stringify({ walls, furniture }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-floorplan error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
