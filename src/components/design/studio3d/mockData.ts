import type { FurnitureItem, Room, Wall, Furniture, RoomData } from "./types";

export const MOCK_ROOMS: Room[] = [
  { id: "r1", name: "Living Room", x: 20, y: 20, width: 260, height: 200, color: "rgba(74,144,226,0.15)" },
  { id: "r2", name: "Kitchen", x: 280, y: 20, width: 160, height: 200, color: "rgba(255,107,53,0.15)" },
  { id: "r3", name: "Bedroom", x: 20, y: 220, width: 200, height: 160, color: "rgba(152,200,100,0.15)" },
  { id: "r4", name: "Bathroom", x: 220, y: 220, width: 120, height: 160, color: "rgba(200,150,255,0.15)" },
];

export const MOCK_WALLS: Wall[] = [
  { id: "w1", start: { x: 1, y: 1 }, end: { x: 9, y: 1 }, thickness: 0.15 },
  { id: "w2", start: { x: 9, y: 1 }, end: { x: 9, y: 7 }, thickness: 0.15 },
  { id: "w3", start: { x: 9, y: 7 }, end: { x: 1, y: 7 }, thickness: 0.15 },
  { id: "w4", start: { x: 1, y: 7 }, end: { x: 1, y: 1 }, thickness: 0.15 },
  { id: "w5", start: { x: 5, y: 1 }, end: { x: 5, y: 4 }, thickness: 0.1 },
];

export const MOCK_FURNITURE_ITEMS: Furniture[] = [
  { id: "f1", type: "bed", label: "Master Bed", position: { x: 3, y: 3 }, rotation: 0, width: 2, depth: 2, height: 0.6 },
  { id: "f2", type: "sofa", label: "Living Sofa", position: { x: 7, y: 5 }, rotation: 90, width: 2.2, depth: 0.9, height: 0.8 },
  { id: "f3", type: "table", label: "Dining Table", position: { x: 7, y: 2.5 }, rotation: 0, width: 1.2, depth: 0.8, height: 0.75 },
];

export const MOCK_FURNITURE: FurnitureItem[] = [
  { id: "mk1", name: "Modern Sofa", category: "furniture", thumbnail: "", dimensions: [2.2, 0.8, 0.9], color: "#334155" },
  { id: "mk2", name: "Dining Table", category: "furniture", thumbnail: "", dimensions: [1.2, 0.75, 0.8], color: "#78350f" },
  { id: "mk3", name: "King Bed", category: "furniture", thumbnail: "", dimensions: [2, 0.6, 2], color: "#451a03" },
  { id: "mk4", name: "Floor Lamp", category: "lighting", thumbnail: "", dimensions: [0.3, 1.6, 0.3], color: "#f5f5f4" },
  { id: "mk5", name: "Wall Art", category: "decor", thumbnail: "", dimensions: [0.8, 0.02, 0.6], color: "#818cf8" },
  { id: "mk6", name: "Bookshelf", category: "furniture", thumbnail: "", dimensions: [1, 2, 0.4], color: "#f1f5f9" },
];

export const STYLE_OPTIONS = [
  { value: "modern", label: "Modern" },
  { value: "scandinavian", label: "Scandinavian" },
  { value: "industrial", label: "Industrial" },
  { value: "minimalist", label: "Minimalist" },
  { value: "luxury", label: "Luxury" },
];

export function getSampleData(): RoomData {
  return {
    dimensions: { width: 10, height: 8 },
    walls: MOCK_WALLS,
    furniture: MOCK_FURNITURE_ITEMS,
  };
}

export const FURNITURE_LIBRARY = [
  { name: "Bed", type: "bed", w: 2, d: 2, h: 0.6 },
  { name: "Sofa", type: "sofa", w: 2.2, d: 0.9, h: 0.8 },
  { name: "Table", type: "table", w: 1.2, d: 0.8, h: 0.75 },
  { name: "Chair", type: "chair", w: 0.5, d: 0.5, h: 0.9 },
  { name: "Cabinet", type: "cabinet", w: 1, d: 0.4, h: 2 },
  { name: "Toilet", type: "toilet", w: 0.4, d: 0.7, h: 0.4 },
];
