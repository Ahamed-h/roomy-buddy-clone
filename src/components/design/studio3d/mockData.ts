import type { FurnitureItem, Room, Wall } from "./types";

export const MOCK_ROOMS: Room[] = [
  { id: "r1", name: "Living Room", x: 20, y: 20, width: 260, height: 200, color: "rgba(74,144,226,0.15)" },
  { id: "r2", name: "Kitchen", x: 280, y: 20, width: 160, height: 200, color: "rgba(255,107,53,0.15)" },
  { id: "r3", name: "Bedroom", x: 20, y: 220, width: 200, height: 160, color: "rgba(152,200,100,0.15)" },
  { id: "r4", name: "Bathroom", x: 220, y: 220, width: 120, height: 160, color: "rgba(200,150,255,0.15)" },
];

export const MOCK_WALLS: Wall[] = [
  { id: "w1", x1: 20, y1: 20, x2: 440, y2: 20 },
  { id: "w2", x1: 440, y1: 20, x2: 440, y2: 220 },
  { id: "w3", x1: 20, y1: 20, x2: 20, y2: 380 },
  { id: "w4", x1: 20, y1: 380, x2: 340, y2: 380 },
  { id: "w5", x1: 340, y1: 220, x2: 340, y2: 380 },
  { id: "w6", x1: 340, y1: 220, x2: 440, y2: 220 },
  { id: "w7", x1: 280, y1: 20, x2: 280, y2: 220 },
  { id: "w8", x1: 20, y1: 220, x2: 340, y2: 220 },
  { id: "w9", x1: 220, y1: 220, x2: 220, y2: 380 },
];

export const MOCK_FURNITURE: FurnitureItem[] = [
  { id: "f1", name: "Modern Sofa", category: "furniture", thumbnail: "", dimensions: [2.2, 0.85, 0.95], color: "#6b7b8d" },
  { id: "f2", name: "Coffee Table", category: "furniture", thumbnail: "", dimensions: [1.2, 0.45, 0.6], color: "#8b6f47" },
  { id: "f3", name: "Dining Table", category: "furniture", thumbnail: "", dimensions: [1.6, 0.75, 0.9], color: "#5c4033" },
  { id: "f4", name: "Office Chair", category: "furniture", thumbnail: "", dimensions: [0.6, 1.1, 0.6], color: "#2d2d2d" },
  { id: "f5", name: "Bookshelf", category: "furniture", thumbnail: "", dimensions: [1.0, 1.8, 0.35], color: "#a0522d" },
  { id: "f6", name: "TV Stand", category: "furniture", thumbnail: "", dimensions: [1.5, 0.5, 0.4], color: "#3a3a3a" },
  { id: "f7", name: "Armchair", category: "furniture", thumbnail: "", dimensions: [0.85, 0.9, 0.85], color: "#4a6741" },
  { id: "f8", name: "Bed Frame", category: "furniture", thumbnail: "", dimensions: [2.0, 0.6, 1.6], color: "#c4a882" },
  { id: "f9", name: "Floor Lamp", category: "lighting", thumbnail: "", dimensions: [0.35, 1.6, 0.35], color: "#d4af37" },
  { id: "f10", name: "Pendant Light", category: "lighting", thumbnail: "", dimensions: [0.4, 0.3, 0.4], color: "#e8d5b7" },
  { id: "f11", name: "Table Lamp", category: "lighting", thumbnail: "", dimensions: [0.25, 0.5, 0.25], color: "#b8860b" },
  { id: "f12", name: "Ceiling Fan", category: "lighting", thumbnail: "", dimensions: [1.2, 0.3, 1.2], color: "#c0c0c0" },
  { id: "f13", name: "Plant Pot", category: "decor", thumbnail: "", dimensions: [0.3, 0.8, 0.3], color: "#228b22" },
  { id: "f14", name: "Wall Art", category: "decor", thumbnail: "", dimensions: [0.8, 0.6, 0.05], color: "#8b4513" },
  { id: "f15", name: "Rug", category: "decor", thumbnail: "", dimensions: [2.0, 0.02, 1.4], color: "#cd853f" },
  { id: "f16", name: "Mirror", category: "decor", thumbnail: "", dimensions: [0.6, 1.0, 0.05], color: "#e0e0e0" },
];

export const STYLE_OPTIONS = [
  { value: "modern", label: "Modern" },
  { value: "scandinavian", label: "Scandinavian" },
  { value: "industrial", label: "Industrial" },
  { value: "minimalist", label: "Minimalist" },
  { value: "luxury", label: "Luxury" },
];
