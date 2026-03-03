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

    const rawBase64 = imageBase64.startsWith("data:")
      ? imageBase64.split(",")[1]
      : imageBase64;

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

    const resultRes = await fetch(
      `${RASTERSCAN_GRADIO_URL}/gradio_api/call/run/${event_id}`
    );

    if (!resultRes.ok || !resultRes.body) {
      console.error("RasterScan result fetch failed:", resultRes.status);
      return null;
    }

    const reader = resultRes.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    const timeout = Date.now() + 120_000;

    while (Date.now() < timeout) {
      const { done, value } = await reader.read();
      if (done) break;
      fullText += decoder.decode(value, { stream: true });
      if (fullText.includes("event: complete")) break;
      if (fullText.includes("event: error")) {
        console.error("RasterScan returned error event");
        return null;
      }
    }

    const dataMatch = fullText.match(/data:\s*(\[[\s\S]*?\])\s*(?:\n|$)/);
    if (!dataMatch) {
      console.error("RasterScan: no data in SSE response");
      return null;
    }

    const resultData = JSON.parse(dataMatch[1]);
    const rasterResult = resultData[1];

    if (!rasterResult || (!rasterResult.walls && !rasterResult.rooms)) {
      console.error("RasterScan returned empty result");
      return null;
    }

    console.log("RasterScan succeeded:", JSON.stringify(rasterResult).substring(0, 500));
    return rasterResult;
  } catch (err) {
    console.error("RasterScan error:", err);
    return null;
  }
}

// ─── Convert RasterScan to FloorPlanAnalysis format ─────────────────────

const ROOM_TYPE_LABELS = [
  "Living Room", "Bedroom", "Kitchen", "Bathroom", "Dining Room",
  "Office", "Hallway", "Garage", "Laundry", "Storage", "Balcony"
];

function guessRoomType(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("living") || lower.includes("lounge")) return "Living Room";
  if (lower.includes("bed") || lower.includes("master")) return "Bedroom";
  if (lower.includes("kitchen") || lower.includes("cook")) return "Kitchen";
  if (lower.includes("bath") || lower.includes("toilet") || lower.includes("wc") || lower.includes("restroom")) return "Bathroom";
  if (lower.includes("dining")) return "Dining Room";
  if (lower.includes("office") || lower.includes("study")) return "Office";
  if (lower.includes("hall") || lower.includes("corridor") || lower.includes("passage")) return "Hallway";
  if (lower.includes("garage") || lower.includes("parking")) return "Garage";
  if (lower.includes("laundry") || lower.includes("utility")) return "Laundry";
  if (lower.includes("storage") || lower.includes("closet") || lower.includes("pantry")) return "Storage";
  if (lower.includes("balcony") || lower.includes("terrace") || lower.includes("patio") || lower.includes("porch")) return "Balcony";
  return "Unknown";
}

function normalizeRasterScanToFloorPlanAnalysis(rs: any): any {
  // RasterScan returns rooms and doors with bbox format [x1, y1, x2, y2] in pixel coordinates.
  // We need to find the image extent and convert to percentage coordinates (0-100).
  
  // First, find the maximum extent from all bboxes to estimate image dimensions
  let maxX = 0, maxY = 0;
  
  const allBboxes: number[][] = [];
  
  if (Array.isArray(rs.rooms)) {
    rs.rooms.forEach((r: any) => {
      if (r.bbox && Array.isArray(r.bbox) && r.bbox.length >= 4) {
        allBboxes.push(r.bbox);
        maxX = Math.max(maxX, r.bbox[0], r.bbox[2]);
        maxY = Math.max(maxY, r.bbox[1], r.bbox[3]);
      }
    });
  }
  
  if (Array.isArray(rs.doors)) {
    rs.doors.forEach((d: any) => {
      if (d.bbox && Array.isArray(d.bbox) && d.bbox.length >= 4) {
        allBboxes.push(d.bbox);
        maxX = Math.max(maxX, d.bbox[0], d.bbox[2]);
        maxY = Math.max(maxY, d.bbox[1], d.bbox[3]);
      }
    });
  }
  
  if (Array.isArray(rs.walls)) {
    rs.walls.forEach((w: any) => {
      if (w.bbox && Array.isArray(w.bbox) && w.bbox.length >= 4) {
        maxX = Math.max(maxX, w.bbox[0], w.bbox[2]);
        maxY = Math.max(maxY, w.bbox[1], w.bbox[3]);
      } else if (Array.isArray(w) && w.length >= 4) {
        maxX = Math.max(maxX, w[0], w[2]);
        maxY = Math.max(maxY, w[1], w[3]);
      }
    });
  }
  
  // If we couldn't determine image extent, use defaults
  if (maxX === 0) maxX = 2891; // common floorplan width
  if (maxY === 0) maxY = 1807;
  
  console.log(`RasterScan image extent: ${maxX} x ${maxY}`);
  
  // Convert rooms to FloorPlanAnalysis format with percentage coordinates
  const rooms: any[] = [];
  let totalArea = 0;
  const usedTypes: Record<string, number> = {};
  
  if (Array.isArray(rs.rooms)) {
    rs.rooms.forEach((r: any, i: number) => {
      let x = 0, y = 0, w = 20, h = 20;
      
      if (r.bbox && Array.isArray(r.bbox) && r.bbox.length >= 4) {
        // Convert pixel bbox [x1, y1, x2, y2] to percentage
        x = (r.bbox[0] / maxX) * 100;
        y = (r.bbox[1] / maxY) * 100;
        w = ((r.bbox[2] - r.bbox[0]) / maxX) * 100;
        h = ((r.bbox[3] - r.bbox[1]) / maxY) * 100;
      }
      
      const name = r.name || r.type || `Room ${i + 1}`;
      const roomType = guessRoomType(name);
      
      // Track count for labeling (e.g., "Bedroom 1", "Bedroom 2")
      usedTypes[roomType] = (usedTypes[roomType] || 0) + 1;
      const label = usedTypes[roomType] > 1 ? `${roomType} ${usedTypes[roomType]}` : roomType;
      
      // Estimate square footage from percentage area (rough estimate: 1400 sqft typical apartment)
      const areaPercent = (w / 100) * (h / 100);
      const estimatedSqFt = Math.round(areaPercent * 1400);
      totalArea += estimatedSqFt;
      
      rooms.push({
        id: `r${i + 1}`,
        type: roomType !== "Unknown" ? roomType : name,
        label: roomType !== "Unknown" ? label : name,
        estimatedSqFt,
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        width: Math.round(w * 10) / 10,
        height: Math.round(h * 10) / 10,
        notes: r.name || "",
      });
    });
  }
  
  // Generate basic insights based on detected rooms
  const insights: any[] = [];
  const roomTypes = rooms.map(r => r.type);
  
  if (roomTypes.includes("Kitchen") && roomTypes.includes("Dining Room")) {
    insights.push({ type: "positive", text: "Separate kitchen and dining areas for flexible use" });
  }
  if (roomTypes.filter(t => t === "Bathroom").length >= 2) {
    insights.push({ type: "positive", text: "Multiple bathrooms improve convenience" });
  }
  if (roomTypes.includes("Hallway")) {
    insights.push({ type: "warning", text: "Hallway space could potentially be optimized" });
  }
  if (rooms.some(r => r.width < 8 || r.height < 8)) {
    insights.push({ type: "warning", text: "Some rooms appear quite small and may feel cramped" });
  }
  if (rooms.length > 8) {
    insights.push({ type: "positive", text: "Good number of distinct spaces for varied activities" });
  }
  
  // Generate score based on room variety and count
  const uniqueTypes = new Set(roomTypes).size;
  const score = Math.min(10, Math.max(3, uniqueTypes * 1.2 + (rooms.length > 5 ? 1 : 0)));
  
  // Generate recommendations
  const recommendations: any[] = [];
  const smallRooms = rooms.filter(r => r.estimatedSqFt < 80);
  if (smallRooms.length > 0) {
    recommendations.push({
      id: "rec1",
      title: "Merge Small Rooms",
      description: `Consider merging ${smallRooms[0].label} with an adjacent room to create a more spacious area`,
      impact: "medium",
      roomChanges: [{ id: smallRooms[0].id, width: smallRooms[0].width * 1.5, height: smallRooms[0].height, notes: "Expanded by merging" }],
    });
  }
  
  const doorCount = Array.isArray(rs.doors) ? rs.doors.length : 0;
  
  return {
    rooms,
    totalArea: totalArea || 1200,
    score: Math.round(score * 10) / 10,
    summary: `${rooms.length}-room layout with ${doorCount} doors detected by computer vision`,
    insights: insights.length > 0 ? insights : [{ type: "positive", text: `${rooms.length} distinct rooms identified` }],
    flowIssues: [],
    recommendations,
  };
}

// ─── AI Vision Fallback ─────────────────────────────────────────────────

const ANALYSIS_PROMPT = `You are a senior architectural space planner. Analyse the uploaded floor plan image carefully.

Return ONLY a single valid JSON object — no markdown, no explanation, nothing else.

Schema:
{
  "rooms": [
    {
      "id": "r1",
      "type": "Living Room",
      "label": "Living Room",
      "estimatedSqFt": 220,
      "x": 5,
      "y": 8,
      "width": 30,
      "height": 25,
      "notes": "Open plan, south-facing"
    }
  ],
  "totalArea": 1400,
  "score": 7.2,
  "summary": "Compact 2BR apartment with efficient layout",
  "insights": [
    { "type": "positive", "text": "Good separation of wet and dry zones" },
    { "type": "warning",  "text": "Bedroom 2 has no direct natural light" },
    { "type": "negative", "text": "Kitchen triangle inefficient — fridge too far from sink" }
  ],
  "flowIssues": ["Living room acts as through-corridor to bedrooms"],
  "recommendations": [
    {
      "id": "rec1",
      "title": "Enlarge Kitchen",
      "description": "Extend kitchen 4 ft east, removing awkward pantry nook",
      "impact": "high",
      "roomChanges": [
        { "id": "r2", "width": 22, "height": 18, "notes": "Expanded kitchen with island" }
      ]
    }
  ]
}

Rules:
- x, y, width, height are PERCENTAGES (0–100) of the image dimensions
- Only identify rooms clearly delimited by walls, labels or boundaries in the image
- Do NOT invent rooms that are not visible
- Every recommendation roomChange must reference a real room id from the rooms array
- score is 0–10 based on: flow efficiency, natural light, privacy zoning, storage, space utilisation
- impact must be "high", "medium", or "low"`;

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

function parseJSON(raw: string): any {
  const clean = raw.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();
  try { return JSON.parse(clean); } catch {}
  const match = clean.match(/\{[\s\S]*\}/);
  if (match) return JSON.parse(match[0]);
  throw new Error("Could not parse AI response as JSON");
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
      const normalized = normalizeRasterScanToFloorPlanAnalysis(rsResult);
      console.log(`RasterScan normalized: ${normalized.rooms.length} rooms, score: ${normalized.score}`);
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

    const imageUrl = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:image/png;base64,${imageBase64}`;

    const messages = [
      { role: "system", content: ANALYSIS_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: "Analyze this floor plan. Respond only with the JSON object." },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ];

    const aiResult = await callAI(providers, messages);
    const content = aiResult.choices?.[0]?.message?.content || "";
    console.log("AI raw response length:", content.length);

    const result = parseJSON(content);
    console.log(`AI Vision: ${result.rooms?.length || 0} rooms, score: ${result.score}`);

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
