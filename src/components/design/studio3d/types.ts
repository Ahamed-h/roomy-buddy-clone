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
