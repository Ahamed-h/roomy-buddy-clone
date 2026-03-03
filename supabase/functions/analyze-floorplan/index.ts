import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── RasterScan (Primary) ───────────────────────────────────────────────

const RASTERSCAN_GRADIO_URL =
  "https://rasterscan-automated-floor-plan-digitalization.hf.space";

async function tryRasterScan(imageBase64: string): Promise<any | null> {
  try {
    console.log("Trying RasterScan HF Space...");

    // Step 1: Submit job via Gradio API
    const rawBase64 = imageBase64.startsWith("data:")
      ? imageBase64.split(",")[1]
      : imageBase64;

    // Convert base64 to binary and upload as file
    const binaryStr = atob(rawBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // Upload file to Gradio
    const formData = new FormData();
    formData.append("files", new Blob([bytes], { type: "image/png" }), "floorplan.png");

    const uploadRes = await fetch(`${RASTERSCAN_GRADIO_URL}/gradio_api/upload`, {
      method: "POST",
      body: formData,
    });

    if (!uploadRes.ok) {
      console.error("RasterScan upload failed:", uploadRes.status);
      return null;
    }

    const uploadedFiles = await uploadRes.json();
    const filePath = uploadedFiles[0];
    console.log("RasterScan file uploaded:", filePath);

    // Step 2: Call the /run prediction endpoint
    const predictRes = await fetch(`${RASTERSCAN_GRADIO_URL}/gradio_api/call/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [{ path: filePath, orig_name: "floorplan.png", size: bytes.length, mime_type: "image/png" }],
      }),
    });

    if (!predictRes.ok) {
      console.error("RasterScan predict submit failed:", predictRes.status);
      return null;
    }

    const { event_id } = await predictRes.json();
    console.log("RasterScan job submitted, event_id:", event_id);

    // Step 3: Poll for result via SSE stream
    const resultRes = await fetch(
      `${RASTERSCAN_GRADIO_URL}/gradio_api/call/run/${event_id}`
    );

    if (!resultRes.ok || !resultRes.body) {
      console.error("RasterScan result fetch failed:", resultRes.status);
      return null;
    }

    // Read SSE stream
    const reader = resultRes.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    const timeout = Date.now() + 120_000; // 2 min timeout

    while (Date.now() < timeout) {
      const { done, value } = await reader.read();
      if (done) break;
      fullText += decoder.decode(value, { stream: true });

      // Check for completed event
      if (fullText.includes("event: complete")) break;
      if (fullText.includes("event: error")) {
        console.error("RasterScan returned error event");
        return null;
      }
    }

    // Parse the SSE data
    const dataMatch = fullText.match(/data:\s*(\[[\s\S]*?\])\s*(?:\n|$)/);
    if (!dataMatch) {
      console.error("RasterScan: no data in SSE response");
      return null;
    }

    const resultData = JSON.parse(dataMatch[1]);
    // resultData = [output_image, json_result]
    // json_result has { doors, walls, rooms, area, perimeter }
    const rasterResult = resultData[1];

    if (!rasterResult || (!rasterResult.walls && !rasterResult.rooms)) {
      console.error("RasterScan returned empty result");
      return null;
    }

    console.log("RasterScan succeeded:", JSON.stringify(rasterResult).substring(0, 200));
    return rasterResult;
  } catch (err) {
    console.error("RasterScan error:", err);
    return null;
  }
}

function normalizeRasterScanResult(rs: any) {
  // RasterScan returns pixel-coordinate data. We normalize to meters.
  // Their walls are arrays of coordinate segments, rooms have polygon data.
  // We do best-effort mapping to our schema.

  const walls: any[] = [];
  const furniture: any[] = [];
  const rooms: any[] = [];

  // Process walls - RasterScan returns wall segments
  if (Array.isArray(rs.walls)) {
    rs.walls.forEach((w: any, i: number) => {
      if (w.start && w.end) {
        // Already in {start, end} format
        walls.push({
          id: `w-rs-${i}`,
          start: { x: (w.start.x || 0) / 100, y: (w.start.y || 0) / 100 },
          end: { x: (w.end.x || 0) / 100, y: (w.end.y || 0) / 100 },
          thickness: 0.15,
        });
      } else if (Array.isArray(w) && w.length >= 4) {
        // [x1, y1, x2, y2] format
        walls.push({
          id: `w-rs-${i}`,
          start: { x: w[0] / 100, y: w[1] / 100 },
          end: { x: w[2] / 100, y: w[3] / 100 },
          thickness: 0.15,
        });
      }
    });
  }

  // Process doors
  if (Array.isArray(rs.doors)) {
    rs.doors.forEach((d: any, i: number) => {
      const pos = d.position || d.center || { x: 0, y: 0 };
      furniture.push({
        id: `d-rs-${i}`,
        type: "door",
        label: `Door (${d.type || "single"})`,
        position: { x: (pos.x || 0) / 100, y: (pos.y || 0) / 100 },
        rotation: d.rotation || 0,
        width: (d.width || 90) / 100,
        depth: 0.1,
        height: 2.1,
      });
    });
  }

  // Process rooms
  if (Array.isArray(rs.rooms)) {
    rs.rooms.forEach((r: any, i: number) => {
      const center = r.center || r.position || { x: 0, y: 0 };
      rooms.push({
        id: `r-rs-${i}`,
        name: r.name || r.type || `Room ${i + 1}`,
        center: { x: (center.x || 0) / 100, y: (center.y || 0) / 100 },
      });
    });
  }

  // Estimate dimensions from wall extents
  let maxX = 10, maxY = 10;
  walls.forEach((w) => {
    maxX = Math.max(maxX, w.start.x, w.end.x);
    maxY = Math.max(maxY, w.start.y, w.end.y);
  });

  return {
    walls,
    furniture,
    rooms,
    dimensions: { width: maxX + 0.5, height: maxY + 0.5 },
    source: "rasterscan",
  };
}

// ─── AI Vision Fallback ─────────────────────────────────────────────────

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

INSTRUCTIONS:
1. UNIT DETECTION: Large values (20-40) = feet. Small values (3-8) = meters.
2. COORDINATE SYSTEM: Origin (0,0) = top-left. X→right, Y→down.
3. WALLS: Trace every wall segment. Exterior + interior. Thickness: 0.5ft / 0.15m.
4. DOORS: Arc symbols = door swings. Position = center of opening.
5. WINDOWS: Parallel lines on exterior walls. Start/end on wall line.
6. FURNITURE: All drawn items. Position = center. Realistic dimensions.
7. ROOMS: Read labels. Center = approximate center.`;

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
      continue;
    } catch (err) {
      console.error(`${provider.name} error:`, err);
      continue;
    }
  }
  throw new Error("All AI providers failed");
}

function parseAIResult(imageBase64: string, providers: AIProvider[]) {
  const imageUrl = imageBase64.startsWith("data:")
    ? imageBase64
    : `data:image/png;base64,${imageBase64}`;

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        { type: "text", text: "Analyze this floor plan. Extract every wall, door, window, furniture item, and room." },
        { type: "image_url", image_url: { url: imageUrl } },
      ],
    },
  ];

  return callAI(providers, messages);
}

function normalizeAIResult(content: string) {
  let jsonStr = content;
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1].trim();
  if (!jsonStr.startsWith("{")) {
    const braceMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (braceMatch) jsonStr = braceMatch[0];
  }

  const parsed = JSON.parse(jsonStr);

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
  return { walls, furniture: allFurniture, rooms, dimensions, source: "ai-vision" };
}

// ─── Main Handler ───────────────────────────────────────────────────────

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

    // ── Strategy 1: RasterScan (free, dedicated CV model) ──
    const rsResult = await tryRasterScan(imageBase64);
    if (rsResult) {
      const normalized = normalizeRasterScanResult(rsResult);
      console.log(`RasterScan: ${normalized.walls.length} walls, ${normalized.rooms.length} rooms`);
      return new Response(JSON.stringify(normalized), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Strategy 2: AI Vision (Gemini → OpenAI) ──
    console.log("RasterScan unavailable, falling back to AI vision...");
    const providers = getProviders();
    if (providers.length === 0) {
      throw new Error("No analyzers available. RasterScan failed and no AI API keys configured.");
    }

    const aiResult = await parseAIResult(imageBase64, providers);
    const content = aiResult.choices?.[0]?.message?.content || "";
    console.log("AI raw response length:", content.length);

    const result = normalizeAIResult(content);
    console.log(`AI Vision: ${result.walls.length} walls, ${result.rooms.length} rooms`);

    return new Response(JSON.stringify(result), {
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
