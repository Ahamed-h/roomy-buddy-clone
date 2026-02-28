export interface Wall {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
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

export interface FurnitureItem {
  id: string;
  name: string;
  category: "furniture" | "lighting" | "decor" | "generated";
  thumbnail: string;
  dimensions: [number, number, number]; // w, h, d in meters
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
  furniture: PlacedFurniture[];
}

export type EditMode = "wall" | "furniture" | "select" | "none";
export type MarketplaceCategory = "furniture" | "lighting" | "decor" | "generated";
