import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// ─── RasterScan (Primary — free CV model) ───────────────────────────────

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

    console.log("RasterScan succeeded:", JSON.stringify(rasterResult).substring(0, 200));
    return rasterResult;
  } catch (err) {
    console.error("RasterScan error:", err);
    return null;
  }
}

// Convert RasterScan result to FloorPlanAnalysis format
function rasterScanToFloorPlanAnalysis(rs: any, imageWidth: number, imageHeight: number): any {
  const rooms: any[] = [];
  const roomTypeGuesses = ["Living Room", "Bedroom", "Kitchen", "Bathroom", "Dining Room", "Office", "Hallway", "Storage", "Laundry", "Balcony", "Garage", "Unknown"];

  if (Array.isArray(rs.rooms)) {
    rs.rooms.forEach((r: any, i: number) => {
      let x = 0, y = 0, width = 20, height = 15;

      if (r.bbox && Array.isArray(r.bbox) && r.bbox.length >= 4) {
        x = (r.bbox[0] / imageWidth) * 100;
        y = (r.bbox[1] / imageHeight) * 100;
        width = ((r.bbox[2] - r.bbox[0]) / imageWidth) * 100;
        height = ((r.bbox[3] - r.bbox[1]) / imageHeight) * 100;
      } else if (r.center) {
        x = ((r.center.x || 0) / imageWidth) * 100 - 10;
        y = ((r.center.y || 0) / imageHeight) * 100 - 7.5;
        width = 20;
        height = 15;
      } else if (r.contour && Array.isArray(r.contour) && r.contour.length > 0) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const pt of r.contour) {
          const px = Array.isArray(pt) ? pt[0] : pt.x || 0;
          const py = Array.isArray(pt) ? pt[1] : pt.y || 0;
          minX = Math.min(minX, px);
          minY = Math.min(minY, py);
          maxX = Math.max(maxX, px);
          maxY = Math.max(maxY, py);
        }
        x = (minX / imageWidth) * 100;
        y = (minY / imageHeight) * 100;
        width = ((maxX - minX) / imageWidth) * 100;
        height = ((maxY - minY) / imageHeight) * 100;
      }

      const roomName = r.name || r.type || r.label || roomTypeGuesses[i % roomTypeGuesses.length];
      const roomType = matchRoomType(roomName);
      const sqFt = Math.round((width / 100) * (height / 100) * 1500);

      rooms.push({
        id: `r${i}`,
        type: roomType,
        label: roomName,
        estimatedSqFt: sqFt,
        x: Math.max(0, Math.round(x * 10) / 10),
        y: Math.max(0, Math.round(y * 10) / 10),
        width: Math.max(5, Math.round(width * 10) / 10),
        height: Math.max(5, Math.round(height * 10) / 10),
        notes: "",
      });
    });
  }

  const totalArea = rooms.reduce((sum, r) => sum + r.estimatedSqFt, 0);
  const doorCount = Array.isArray(rs.doors) ? rs.doors.length : 0;

  return {
    rooms,
    totalArea,
    score: Math.min(10, Math.max(1, 5 + rooms.length * 0.3)),
    summary: `Detected ${rooms.length} rooms with ${doorCount} doors via computer vision analysis.`,
    insights: [
      { type: "positive", text: `${rooms.length} rooms clearly identified in the floor plan` },
      ...(doorCount > 0 ? [{ type: "positive", text: `${doorCount} doors detected` }] : []),
      ...(rooms.length < 3 ? [{ type: "warning", text: "Few rooms detected — some may be missed" }] : []),
    ],
    flowIssues: [],
    recommendations: [],
    source: "rasterscan",
  };
}

function matchRoomType(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("living") || n.includes("lounge")) return "Living Room";
  if (n.includes("bed")) return "Bedroom";
  if (n.includes("kitchen")) return "Kitchen";
  if (n.includes("bath") || n.includes("toilet") || n.includes("wc")) return "Bathroom";
  if (n.includes("dining")) return "Dining Room";
  if (n.includes("office") || n.includes("study")) return "Office";
  if (n.includes("hall") || n.includes("corridor") || n.includes("passage")) return "Hallway";
  if (n.includes("garage") || n.includes("parking")) return "Garage";
  if (n.includes("laundry") || n.includes("utility")) return "Laundry";
  if (n.includes("storage") || n.includes("closet") || n.includes("store")) return "Storage";
  if (n.includes("balcony") || n.includes("terrace") || n.includes("patio")) return "Balcony";
  return "Unknown";
}

// ─── Lovable AI Vision (FloorPlanAnalysis format) ───────────────────────

const FLOORPLAN_ANALYSIS_PROMPT = `You are a licensed senior architect with 25+ years of residential and commercial design experience. Analyse the uploaded floor plan image with the precision and detail of a professional architectural review.

Return ONLY a single valid JSON object — no markdown, no explanation, nothing else.

Schema:
{
  "rooms": [
    {
      "id": "r0",
      "type": "Living Room",
      "label": "Living Room",
      "estimatedSqFt": 220,
      "x": 5,
      "y": 8,
      "width": 30,
      "height": 25,
      "notes": "Open plan, south-facing, 3.2m ceiling height"
    }
  ],
  "totalArea": 1400,
  "score": 7.2,
  "summary": "Compact 2BR apartment with efficient layout but suboptimal kitchen work triangle",
  "insights": [
    { "type": "positive", "text": "Excellent separation of public and private zones with central hallway acting as buffer" },
    { "type": "positive", "text": "Living area benefits from dual-aspect natural light — ideal for passive solar gain" },
    { "type": "warning",  "text": "Bedroom 2 lacks direct fenestration — fails IRC R303.1 natural light requirement" },
    { "type": "warning",  "text": "Kitchen work triangle exceeds 26 ft total — NKBA guidelines recommend max 26 ft" },
    { "type": "negative", "text": "No clear egress path from master bedroom — potential fire safety concern per IBC 1015" },
    { "type": "negative", "text": "Bathroom door swings into hallway circulation path — ADA clearance compromised" }
  ],
  "flowIssues": [
    "Living room serves as mandatory through-corridor to bedrooms — eliminates private retreat quality",
    "Kitchen entry forces 180° turn from main hallway — poor wayfinding for guests"
  ],
  "recommendations": [
    {
      "id": "rec1",
      "title": "Optimize Kitchen Work Triangle",
      "description": "Relocate refrigerator to north wall and extend counter 4 ft east to achieve ideal 12-18 ft work triangle. This improves cooking efficiency by 40% per NKBA standards.",
      "impact": "high",
      "roomChanges": [
        { "id": "r2", "width": 22, "height": 18, "notes": "L-shaped layout with island, improved ventilation path" }
      ]
    },
    {
      "id": "rec2",
      "title": "Add Pocket Door to En-Suite",
      "description": "Replace swing door with pocket door to reclaim 9 sq ft of usable floor area and eliminate door-swing conflict with vanity.",
      "impact": "medium",
      "roomChanges": []
    },
    {
      "id": "rec3",
      "title": "Create Visual Connection Between Living & Dining",
      "description": "Remove non-load-bearing partition wall between living and dining areas. Install a structural beam (LVL 3.5x11.875) to create an open-plan social zone of ~380 sq ft.",
      "impact": "high",
      "roomChanges": [
        { "id": "r0", "width": 45, "height": 25, "notes": "Combined living-dining open plan" }
      ]
    }
  ]
}

ARCHITECTURAL ANALYSIS RULES:
- x, y, width, height are PERCENTAGES (0–100) of the image dimensions
- Only identify rooms clearly visible in the image — do NOT invent rooms
- Every recommendation roomChange must reference a real room id
- score is 0–10 (be critical — most residential plans score 5-7)
- type must be one of: Living Room, Bedroom, Kitchen, Bathroom, Dining Room, Office, Hallway, Garage, Laundry, Storage, Balcony, Unknown
- impact must be "high", "medium", or "low"

PROFESSIONAL EVALUATION CRITERIA (use these in your insights):
1. CIRCULATION & FLOW: Assess traffic patterns, dead-end corridors, and cross-traffic through private zones
2. SPATIAL PROPORTIONS: Check room aspect ratios (ideal 1:1.2 to 1:1.6), ceiling-to-floor ratios
3. NATURAL LIGHT: Evaluate fenestration ratio (15-20% of floor area), light penetration depth (<2.5x window head height)
4. KITCHEN WORK TRIANGLE: Measure sink-stove-fridge triangle (ideal 12-26 ft total per NKBA)
5. PRIVACY ZONING: Separate public (living/dining/kitchen) from private (bedrooms/bathrooms) zones
6. ACCESSIBILITY: Check 36" min doorways, 60" turning radius in bathrooms, 42" kitchen aisles
7. STRUCTURAL LOGIC: Note load-bearing wall implications in recommendations
8. VENTILATION & EGRESS: Cross-ventilation potential, emergency exit paths per building codes
9. STORAGE: Minimum 10% of total area should be dedicated storage (closets, pantry, utility)
10. ENERGY EFFICIENCY: Orientation, thermal mass placement, HVAC duct routing potential

Provide at least 4-6 insights and 2-4 actionable recommendations with specific measurements.`;

async function tryLovableVision(imageBase64: string, apiKey: string): Promise<any | null> {
  try {
    console.log("Trying Lovable AI vision analysis...");
    const imageUrl = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:image/png;base64,${imageBase64}`;

    const response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: FLOORPLAN_ANALYSIS_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this floor plan image. Return only the JSON object." },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("Lovable AI vision failed:", response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    console.log("Lovable AI vision raw length:", content.length);

    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();
    if (!jsonStr.startsWith("{")) {
      const braceMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (braceMatch) jsonStr = braceMatch[0];
    }

    const parsed = JSON.parse(jsonStr);
    if (parsed.rooms && Array.isArray(parsed.rooms)) {
      parsed.source = "lovable-ai";
      console.log(`Lovable AI: ${parsed.rooms.length} rooms, score: ${parsed.score}`);
      return parsed;
    }
    return null;
  } catch (err) {
    console.error("Lovable AI vision error:", err);
    return null;
  }
}

// ─── Legacy AI Vision Fallback ──────────────────────────────────────────

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

async function callLovableAI(apiKey: string, messages: any[]): Promise<any> {
  console.log("Calling Lovable AI gateway...");
  const response = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Lovable AI failed [${response.status}]: ${errText}`);
  }

  return await response.json();
}

// ─── Main Handler ───────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { imageBase64, imageWidth, imageHeight, format } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "imageBase64 is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const wantFloorPlanFormat = format === "floorplan-analysis";
    const imgW = imageWidth || 2000;
    const imgH = imageHeight || 1500;

    // ── Strategy 1: RasterScan (free CV model) ──
    const rsResult = await tryRasterScan(imageBase64);
    if (rsResult) {
      if (wantFloorPlanFormat) {
        const analysis = rasterScanToFloorPlanAnalysis(rsResult, imgW, imgH);
        console.log(`RasterScan → FloorPlanAnalysis: ${analysis.rooms.length} rooms`);
        return new Response(JSON.stringify(analysis), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const normalized = normalizeRasterScanLegacy(rsResult);
      console.log(`RasterScan legacy: ${normalized.walls.length} walls, ${normalized.rooms.length} rooms`);
      return new Response(JSON.stringify(normalized), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Strategy 2: Lovable AI Vision (FloorPlanAnalysis format) ──
    if (wantFloorPlanFormat) {
      const aiResult = await tryLovableVision(imageBase64, LOVABLE_API_KEY);
      if (aiResult) {
        return new Response(JSON.stringify(aiResult), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── Strategy 3: Lovable AI Vision (legacy format) ──
    console.log("Falling back to Lovable AI vision (legacy)...");

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

    const aiResult = await callLovableAI(LOVABLE_API_KEY, messages);
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

// ─── Legacy format normalizers ──────────────────────────────────────────

function normalizeRasterScanLegacy(rs: any) {
  const walls: any[] = [];
  const furniture: any[] = [];
  const rooms: any[] = [];

  if (Array.isArray(rs.walls)) {
    rs.walls.forEach((w: any, i: number) => {
      if (w.start && w.end) {
        walls.push({
          id: `w-rs-${i}`,
          start: { x: (w.start.x || 0) / 100, y: (w.start.y || 0) / 100 },
          end: { x: (w.end.x || 0) / 100, y: (w.end.y || 0) / 100 },
          thickness: 0.15,
        });
      } else if (Array.isArray(w) && w.length >= 4) {
        walls.push({
          id: `w-rs-${i}`,
          start: { x: w[0] / 100, y: w[1] / 100 },
          end: { x: w[2] / 100, y: w[3] / 100 },
          thickness: 0.15,
        });
      }
    });
  }

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
  return { walls, furniture: allFurniture, rooms, dimensions, source: "lovable-ai" };
}
