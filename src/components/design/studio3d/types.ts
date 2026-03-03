export interface Point {
  x: number;
  y: number;
}

export interface Wall {
  id: string;
  start: Point;
  end: Point;
  thickness: number;
}

export interface Room {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface Furniture {
  id: string;
  type: string;
  position: Point;
  rotation: number;
  width: number;
  depth: number;
  height: number;
  label: string;
}

export interface RoomData {
  walls: Wall[];
  furniture: Furniture[];
  dimensions: { width: number; height: number };
}

export interface FurnitureItem {
  id: string;
  name: string;
  category: "furniture" | "lighting" | "decor" | "generated";
  thumbnail: string;
  dimensions: [number, number, number];
  color: string;
}

export interface PlacedFurniture {
  id: string;
  itemId: string;
  name: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  dimensions: [number, number, number];
  color: string;
}

export interface SceneState {
  rooms: Room[];
  walls: Wall[];
  furniture: Furniture[];
}

export type EditMode = "wall" | "furniture" | "select" | "none";
export type MarketplaceCategory = "furniture" | "lighting" | "decor" | "generated";

// ── Floor Plan Analyzer Types ──

export interface AnalyzedRoom {
  id: string;
  type: string;
  label: string;
  estimatedSqFt: number;
  x: number;       // percentage 0-100
  y: number;       // percentage 0-100
  width: number;   // percentage 0-100
  height: number;  // percentage 0-100
  notes: string;
}

export interface AnalysisInsight {
  type: "positive" | "warning" | "negative";
  text: string;
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  roomChanges: Array<{
    id: string;
    remove?: boolean;
    width?: number;
    height?: number;
    label?: string;
    type?: string;
    notes?: string;
  }>;
}

export interface FloorplanAnalysis {
  rooms: AnalyzedRoom[];
  totalArea: number;
  score: number;
  summary: string;
  insights: AnalysisInsight[];
  flowIssues: string[];
  recommendations: Recommendation[];
}
