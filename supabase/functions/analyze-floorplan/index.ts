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

    const systemPrompt = `You are an expert architectural floor plan analyzer. You must analyze floor plan images with extreme precision, extracting every wall segment, door, window, and furniture item.

Return ONLY a valid JSON object (no markdown, no explanation) with this exact structure:
{
  "dimensions": { "width": <meters>, "height": <meters> },
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

CRITICAL RULES for coordinate extraction:
1. Look at the MEASUREMENTS shown on the image (e.g. "8.82m", "2.77m") to determine the actual scale
2. Map the entire floorplan into a coordinate system where the top-left corner of the outer walls is (0, 0)
3. Use the REAL measurements from the image to set accurate coordinates — do NOT just guess on a 10x10 grid
4. Set "dimensions" to the overall width and height of the floorplan in meters (from the measurements shown)
5. Wall thickness: use the measurement labels if shown (e.g. "0.25m"), otherwise default to 0.15m

WALL DETECTION:
- Trace EVERY wall segment individually — each straight section is a separate wall
- Interior partition walls are just as important as exterior walls
- Where walls meet at corners, end one wall and start another
- Pay attention to wall openings (doors/windows create gaps in walls)

DOOR DETECTION:
- Door arcs (quarter circles) indicate door positions and swing direction
- The rotation indicates the direction the door faces (0=right, 90=down, 180=left, 270=up)
- Width is the door opening width in meters

FURNITURE DETECTION:
- Identify ALL furniture shown: beds, sofas, tables, chairs, cabinets, toilets, bathtubs, desks, shelves, wardrobes, TV stands, lamps, rugs
- Use the LABELS shown in the image if present (e.g. "King Bed", "Ashley Furniture", "Wade Logan Paxt...")
- Position is the CENTER of each furniture item
- Use realistic dimensions based on the measurements visible in the image

ROOM DETECTION:
- Identify distinct rooms (bedroom, bathroom, living room, kitchen, etc.)
- Place the room name at the approximate center of each room`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this floor plan image with maximum precision. Extract every wall, door, window, and furniture item. Use the measurements shown in the image to determine accurate coordinates and dimensions." },
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
    console.log("AI raw response length:", content.length);

    // Extract JSON from the response (handle markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error("JSON parse failed. Raw content:", content.substring(0, 500));
      throw new Error("Failed to parse AI response as JSON");
    }

    // Extract dimensions
    const dimensions = parsed.dimensions || { width: 10, height: 10 };

    // Add IDs to walls
    const walls = (parsed.walls || []).map((w: any, i: number) => ({
      id: `w-ai-${i}`,
      start: w.start,
      end: w.end,
      thickness: w.thickness || 0.15,
    }));

    // Process doors as special furniture items for visualization
    const doors = (parsed.doors || []).map((d: any, i: number) => ({
      id: `d-ai-${i}`,
      type: "door",
      label: `Door (${d.type || "single"})`,
      position: d.position,
      rotation: d.rotation || 0,
      width: d.width || 0.9,
      depth: 0.1,
      height: 2.1,
    }));

    // Process windows
    const windows = (parsed.windows || []).map((w: any, i: number) => ({
      id: `win-ai-${i}`,
      type: "window",
      label: "Window",
      position: {
        x: (w.start.x + w.end.x) / 2,
        y: (w.start.y + w.end.y) / 2,
      },
      rotation: 0,
      width: w.width || Math.sqrt(Math.pow(w.end.x - w.start.x, 2) + Math.pow(w.end.y - w.start.y, 2)),
      depth: 0.15,
      height: 1.2,
    }));

    // Process furniture
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

    // Process rooms
    const rooms = (parsed.rooms || []).map((r: any, i: number) => ({
      id: `r-ai-${i}`,
      name: r.name,
      center: r.center,
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
