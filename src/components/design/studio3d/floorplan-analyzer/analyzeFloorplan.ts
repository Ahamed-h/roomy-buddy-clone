import { directVision, hasDirectKeys } from "@/services/directAI";
import { isOllamaAvailable, ollamaVision } from "@/services/ollama";
import { supabase } from "@/integrations/supabase/client";
import type { FloorPlanAnalysis } from "./types";

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

function parseJSON(raw: string): any {
  const clean = raw.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();
  // Try direct parse first
  try { return JSON.parse(clean); } catch {}
  // Try extracting JSON object
  const match = clean.match(/\{[\s\S]*\}/);
  if (match) return JSON.parse(match[0]);
  throw new Error("Could not parse AI response as JSON");
}

export async function analyzeFloorplan(imageBase64: string): Promise<FloorPlanAnalysis> {
  const prompt = ANALYSIS_PROMPT + "\n\nAnalyse this floor plan. Respond only with the JSON object.";

  // Try Ollama first
  const ollamaOnline = await isOllamaAvailable();
  if (ollamaOnline) {
    try {
      const raw = await ollamaVision(prompt, imageBase64);
      return parseJSON(raw);
    } catch (err) {
      console.warn("Ollama floorplan analysis failed:", err);
    }
  }

  // Try direct API (Gemini/OpenAI)
  if (hasDirectKeys()) {
    try {
      const raw = await directVision(prompt, imageBase64);
      return parseJSON(raw);
    } catch (err) {
      console.warn("Direct API floorplan analysis failed:", err);
    }
  }

  // Fallback to Supabase edge function (now returns FloorPlanAnalysis format directly)
  const rawB64 = imageBase64.replace(/^data:image\/[^;]+;base64,/, "");
  const { data, error } = await supabase.functions.invoke("analyze-floorplan", {
    body: { imageBase64: rawB64 },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  
  // Edge function now returns FloorPlanAnalysis format with rooms having x, y, width, height as percentages
  if (data?.rooms && Array.isArray(data.rooms) && data.rooms.length > 0) {
    // Validate that rooms have the required percentage coordinate fields
    const firstRoom = data.rooms[0];
    if (typeof firstRoom.x === "number" && typeof firstRoom.width === "number") {
      return data as FloorPlanAnalysis;
    }
  }
  
  throw new Error("Analysis returned unexpected format. Please try with a Gemini API key in settings.");
}

export function applyRecommendations(
  rooms: FloorPlanAnalysis["rooms"],
  recommendations: FloorPlanAnalysis["recommendations"],
  selectedIds: string[]
): FloorPlanAnalysis["rooms"] {
  const chosen = recommendations.filter(r => selectedIds.includes(r.id));
  if (!chosen.length) return rooms;

  let updated = rooms.map(r => ({ ...r }));
  for (const rec of chosen) {
    for (const change of (rec.roomChanges || [])) {
      if (change.remove) {
        updated = updated.filter(r => r.id !== change.id);
      } else {
        updated = updated.map(r =>
          r.id === change.id ? { ...r, ...change } : r
        );
      }
    }
  }
  return updated;
}
