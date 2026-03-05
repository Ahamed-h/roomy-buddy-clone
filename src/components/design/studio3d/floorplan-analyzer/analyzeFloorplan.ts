import { analyzeFloorplan as apiAnalyzeFloorplan } from "@/services/api";
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
- type must be one of: Living Room, Bedroom, Kitchen, Bathroom, Dining Room, Office, Hallway, Garage, Laundry, Storage, Balcony, Unknown
- score is 0–10 based on: flow efficiency, natural light, privacy zoning, storage, space utilisation
- impact must be "high", "medium", or "low"`;

function parseJSON(raw: string): any {
  const clean = raw.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();
  try { return JSON.parse(clean); } catch {}
  const match = clean.match(/\{[\s\S]*\}/);
  if (match) return JSON.parse(match[0]);
  throw new Error("Could not parse AI response as JSON");
}

function isFloorPlanAnalysis(data: any): boolean {
  return data?.rooms && Array.isArray(data.rooms) && data.rooms.length > 0 &&
    typeof data.rooms[0].x === "number" && typeof data.rooms[0].width === "number";
}

/**
 * Analyze a floor plan using the backend /floorplan/analyze endpoint.
 * Falls back to parsing the text response into structured room data.
 */
export async function analyzeFloorplan(imageBase64: string): Promise<FloorPlanAnalysis> {
  // Convert data URL to File for the backend API
  const resp = await fetch(imageBase64);
  const blob = await resp.blob();
  const file = new File([blob], "floorplan.png", { type: blob.type });

  const apiResult = await apiAnalyzeFloorplan(file);

  // Try to parse the analysis text as JSON first (backend may return structured data)
  try {
    const parsed = parseJSON(apiResult.analysis);
    if (isFloorPlanAnalysis(parsed)) return parsed;
  } catch {
    // Not JSON — parse text into structured format
  }

  // Fallback: extract rooms from text
  const result: FloorPlanAnalysis = {
    rooms: [],
    totalArea: 0,
    score: 5,
    summary: "Analysis from backend",
    insights: [],
    flowIssues: [],
    recommendations: [],
  };

  const roomPattern = /(?:bedroom|living\s*room|kitchen|bathroom|dining\s*room|office|hallway|closet|balcony|garage|laundry|entry|foyer|study|nursery|guest\s*room|master\s*(?:bed)?room|utility|storage)/gi;
  const foundRooms = new Set<string>();
  const matches = apiResult.analysis.match(roomPattern);
  if (matches) matches.forEach((m) => foundRooms.add(m.trim().toLowerCase()));

  let i = 0;
  foundRooms.forEach((roomName) => {
    result.rooms.push({
      id: `r${i}`,
      type: roomName.charAt(0).toUpperCase() + roomName.slice(1),
      label: roomName.charAt(0).toUpperCase() + roomName.slice(1),
      estimatedSqFt: 0,
      x: 10 + (i % 4) * 25,
      y: 10 + Math.floor(i / 4) * 20,
      width: 20,
      height: 15,
    });
    i++;
  });

  const lines = apiResult.analysis.split("\n").filter((l) => l.trim().length > 10);
  lines.slice(0, 5).forEach((line) => {
    result.insights.push({ type: "positive", text: line.trim() });
  });

  const suggestionLines = lines.filter((l) =>
    /suggest|recommend|improve|consider|should|could|add|remove|move/i.test(l)
  );
  suggestionLines.forEach((line, idx) => {
    result.recommendations.push({
      id: `rec${idx}`,
      title: `Suggestion ${idx + 1}`,
      description: line.trim(),
      impact: idx === 0 ? "high" : idx === 1 ? "medium" : "low",
      roomChanges: [],
    });
  });

  return result;
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
