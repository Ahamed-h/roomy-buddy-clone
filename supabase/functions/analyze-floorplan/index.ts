import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an expert architectural floor plan analyzer. Analyze the provided floor plan image and extract ALL structural and furniture elements with precise coordinates.

CRITICAL: Return ONLY a valid JSON object. No markdown, no explanation, no code blocks.

JSON SCHEMA:
{
  "unit": "feet" | "meters",
  "dimensions": { "width": <number>, "height": <number> },
  "walls": [
    { "start": { "x": <number>, "y": <number> }, "end": { "x": <number>, "y": <number> }, "thickness": <number> }
  ],
  "doors": [
    { "position": { "x": <number>, "y": <number> }, "width": <number>, "rotation": <number>, "type": "single"|"double"|"sliding" }
  ],
  "windows": [
    { "start": { "x": <number>, "y": <number> }, "end": { "x": <number>, "y": <number> }, "width": <number> }
  ],
  "furniture": [
    { "type": "<string>", "label": "<string>", "position": { "x": <number>, "y": <number> }, "rotation": <number>, "width": <number>, "depth": <number>, "height": <number> }
  ],
  "rooms": [
    { "name": "<string>", "center": { "x": <number>, "y": <number> } }
  ]
}

STEP-BY-STEP INSTRUCTIONS:

1. UNIT DETECTION:
   - Look at the dimension numbers on the image. If values are large (e.g., 20, 30, 40), they are likely in FEET.
   - If values are small (e.g., 3.5, 8.8), they are likely in METERS.
   - Set the "unit" field accordingly. ALL coordinates must use the SAME unit as shown on the image.

2. COORDINATE SYSTEM:
   - Origin (0, 0) = top-left corner of the outer boundary
   - X increases to the right, Y increases downward
   - Read EVERY dimension label on the image to determine exact coordinates

3. WALL DETECTION (most important):
   - Trace EVERY wall segment as a separate entry
   - Exterior walls form the outer boundary — trace all 4+ sides
   - Interior partition walls divide rooms — include ALL of them
   - Wall thickness: use 0.5 for feet-based plans, 0.15 for meter-based plans

4. DOOR DETECTION:
   - Look for arc symbols (quarter circles) indicating door swings
   - Position is the CENTER of the door opening
   - Rotation: 0=opens right, 90=opens down, 180=opens left, 270=opens up

5. WINDOW DETECTION:
   - Look for parallel lines on exterior walls
   - Start/end coordinates should be on the wall line

6. FURNITURE DETECTION:
   - Identify ALL drawn furniture items
   - Position is the CENTER of each item
   - Use realistic dimensions in the detected unit

7. ROOM DETECTION:
   - Read room name labels from the image
   - Place center point at the approximate center of each room`;

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
    providers.push({
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      key: geminiKey,
      model: "gemini-2.5-pro",
      name: "Gemini",
    });
  }
  
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (openaiKey) {
    providers.push({
      url: "https://api.openai.com/v1/chat/completions",
      key: openaiKey,
      model: "gpt-4o",
      name: "OpenAI",
    });
  }

  return providers;
}

async function callAI(providers: AIProvider[], messages: any[]): Promise<any> {
  for (const provider of providers) {
    try {
      console.log(`Trying ${provider.name}...`);
      const response = await fetch(provider.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${provider.key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: provider.model, messages }),
      });

      if (response.ok) {
        console.log(`${provider.name} succeeded`);
        return await response.json();
      }
      
      console.error(`${provider.name} failed: ${response.status}`);
      if (response.status === 429 || response.status === 402) {
        continue; // Try next provider
      }
      // For other errors, still try next provider
      continue;
    } catch (err) {
      console.error(`${provider.name} error:`, err);
      continue;
    }
  }
  throw new Error("All AI providers failed");
}

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

    const providers = getProviders();
    if (providers.length === 0) {
      throw new Error("No AI API keys configured. Set GOOGLE_GEMINI_API_KEY or OPENAI_API_KEY.");
    }

    const imageUrl = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:image/png;base64,${imageBase64}`;

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Analyze this floor plan. Read ALL dimension labels carefully. Extract every wall, door, window, furniture item, and room.",
          },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ];

    const aiResult = await callAI(providers, messages);
    const content = aiResult.choices?.[0]?.message?.content || "";
    console.log("AI raw response length:", content.length);

    // Extract JSON from response
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();
    if (!jsonStr.startsWith("{")) {
      const braceMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (braceMatch) jsonStr = braceMatch[0];
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("JSON parse failed. Raw:", content.substring(0, 1000));
      throw new Error("Failed to parse AI response as JSON");
    }

    // Unit conversion
    const unit = parsed.unit || "meters";
    const toMeters = unit === "feet" ? 0.3048 : 1;

    const dimensions = {
      width: (parsed.dimensions?.width || 10) * toMeters,
      height: (parsed.dimensions?.height || 10) * toMeters,
    };

    const walls = (parsed.walls || []).map((w: any, i: number) => ({
      id: `w-ai-${i}`,
      start: { x: (w.start?.x || 0) * toMeters, y: (w.start?.y || 0) * toMeters },
      end: { x: (w.end?.x || 0) * toMeters, y: (w.end?.y || 0) * toMeters },
      thickness: (w.thickness || (unit === "feet" ? 0.5 : 0.15)) * toMeters,
    }));

    const doors = (parsed.doors || []).map((d: any, i: number) => ({
      id: `d-ai-${i}`,
      type: "door",
      label: `Door (${d.type || "single"})`,
      position: { x: (d.position?.x || 0) * toMeters, y: (d.position?.y || 0) * toMeters },
      rotation: d.rotation || 0,
      width: (d.width || (unit === "feet" ? 3 : 0.9)) * toMeters,
      depth: 0.1,
      height: 2.1,
    }));

    const windows = (parsed.windows || []).map((w: any, i: number) => {
      const sx = (w.start?.x || 0) * toMeters;
      const sy = (w.start?.y || 0) * toMeters;
      const ex = (w.end?.x || 0) * toMeters;
      const ey = (w.end?.y || 0) * toMeters;
      return {
        id: `win-ai-${i}`,
        type: "window",
        label: "Window",
        position: { x: (sx + ex) / 2, y: (sy + ey) / 2 },
        rotation: 0,
        width: w.width ? w.width * toMeters : Math.sqrt((ex - sx) ** 2 + (ey - sy) ** 2),
        depth: 0.15,
        height: 1.2,
      };
    });

    const furniture = (parsed.furniture || []).map((f: any, i: number) => ({
      id: `f-ai-${i}`,
      type: f.type || "table",
      label: f.label || f.type || "Item",
      position: { x: (f.position?.x || 0) * toMeters, y: (f.position?.y || 0) * toMeters },
      rotation: f.rotation || 0,
      width: (f.width || 1) * toMeters,
      depth: (f.depth || 1) * toMeters,
      height: (f.height || 1) * toMeters,
    }));

    const rooms = (parsed.rooms || []).map((r: any, i: number) => ({
      id: `r-ai-${i}`,
      name: r.name,
      center: { x: (r.center?.x || 0) * toMeters, y: (r.center?.y || 0) * toMeters },
    }));

    const allFurniture = [...furniture, ...doors, ...windows];
    console.log(`Extracted: ${walls.length} walls, ${doors.length} doors, ${windows.length} windows, ${furniture.length} furniture, ${rooms.length} rooms`);

    return new Response(JSON.stringify({ walls, furniture: allFurniture, rooms, dimensions }), {
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
