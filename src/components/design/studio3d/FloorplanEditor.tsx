import React, { useState, useEffect, useRef } from "react";
import { Stage, Layer, Rect, Line, Text, Group, Circle, Image as KonvaImage } from "react-konva";
import type { Wall, Furniture } from "./types";

interface Props {
  walls: Wall[];
  furniture: Furniture[];
  onUpdateWalls: (walls: Wall[]) => void;
  onUpdateFurniture: (furniture: Furniture[]) => void;
  onSelectItem: (id: string | null) => void;
  selectedId: string | null;
  backgroundImage?: string | null;
  sceneDimensions?: { width: number; height: number } | null;
}

const FloorplanEditor: React.FC<Props> = ({
  walls,
  furniture,
  onUpdateWalls,
  onUpdateFurniture,
  onSelectItem,
  selectedId,
  backgroundImage,
  sceneDimensions,
}) => {
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [bgImg, setBgImg] = useState<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Compute scale: fit scene dimensions into viewport
  const sceneW = sceneDimensions?.width || 10;
  const sceneH = sceneDimensions?.height || 10;
  const SCALE = Math.min(
    (dimensions.width - 40) / sceneW,
    (dimensions.height - 40) / sceneH,
    80
  );

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Load background image
  useEffect(() => {
    if (!backgroundImage) {
      setBgImg(null);
      return;
    }
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setBgImg(img);
    img.onerror = () => setBgImg(null);
    img.src = backgroundImage;
  }, [backgroundImage]);

  const handleFurnitureDrag = (id: string, e: any) => {
    const newPos = {
      x: e.target.x() / SCALE,
      y: e.target.y() / SCALE,
    };
    const updated = furniture.map((f) =>
      f.id === id ? { ...f, position: newPos } : f
    );
    onUpdateFurniture(updated);
  };

  const handleWallSegmentDrag = (wallId: string, e: any) => {
    const dx = e.target.x();
    const dy = e.target.y();
    e.target.position({ x: 0, y: 0 });

    const updated = walls.map((w) => {
      if (w.id === wallId) {
        return {
          ...w,
          start: { x: w.start.x + dx / SCALE, y: w.start.y + dy / SCALE },
          end: { x: w.end.x + dx / SCALE, y: w.end.y + dy / SCALE },
        };
      }
      return w;
    });
    onUpdateWalls(updated);
  };

  const handleWallPointDrag = (wallId: string, pointType: "start" | "end", e: any) => {
    const newPos = {
      x: e.target.x() / SCALE,
      y: e.target.y() / SCALE,
    };
    const updated = walls.map((w) => {
      if (w.id === wallId) {
        return { ...w, [pointType]: newPos };
      }
      return w;
    });
    onUpdateWalls(updated);
  };

  // Compute background image size to fill the scene area
  const bgWidth = sceneW * SCALE;
  const bgHeight = sceneH * SCALE;

  const getFurnitureColor = (type: string, isSelected: boolean) => {
    if (isSelected) return "#3b82f6";
    switch (type.toLowerCase()) {
      case "door": return "#f59e0b";
      case "window": return "#38bdf8";
      case "bed": return "#6366f1";
      case "sofa": return "#334155";
      case "table": return "#78350f";
      case "chair": return "#0f172a";
      case "cabinet":
      case "wardrobe":
      case "shelf": return "#64748b";
      case "toilet":
      case "bathtub": return "#06b6d4";
      default: return "#52525b";
    }
  };

  const getFurnitureStroke = (type: string, isSelected: boolean) => {
    if (isSelected) return "#93c5fd";
    switch (type.toLowerCase()) {
      case "door": return "#fbbf24";
      case "window": return "#7dd3fc";
      default: return "#71717a";
    }
  };

  return (
    <div ref={containerRef} className="w-full h-full cursor-crosshair" style={{ minHeight: 400, background: "#0d1225" }}>
      <Stage width={dimensions.width} height={dimensions.height} draggable>
        <Layer>
          {/* Grid Lines */}
          {Array.from({ length: Math.ceil(sceneW + 4) }).map((_, i) => (
            <React.Fragment key={`v-${i}`}>
              <Line
                points={[i * SCALE, -SCALE * 2, i * SCALE, (sceneH + 4) * SCALE]}
                stroke="rgba(74,144,226,0.06)"
                strokeWidth={1}
              />
            </React.Fragment>
          ))}
          {Array.from({ length: Math.ceil(sceneH + 4) }).map((_, i) => (
            <React.Fragment key={`h-${i}`}>
              <Line
                points={[-SCALE * 2, i * SCALE, (sceneW + 4) * SCALE, i * SCALE]}
                stroke="rgba(74,144,226,0.06)"
                strokeWidth={1}
              />
            </React.Fragment>
          ))}

          {/* Background Image Overlay */}
          {bgImg && (
            <KonvaImage
              image={bgImg}
              x={0}
              y={0}
              width={bgWidth}
              height={bgHeight}
              opacity={0.2}
            />
          )}

          {/* Walls */}
          {walls.map((wall) => (
            <Group key={wall.id}>
              <Line
                points={[
                  wall.start.x * SCALE,
                  wall.start.y * SCALE,
                  wall.end.x * SCALE,
                  wall.end.y * SCALE,
                ]}
                stroke={selectedId === wall.id ? "#3b82f6" : "#e4e4e7"}
                strokeWidth={Math.max(wall.thickness * SCALE, 3)}
                hitStrokeWidth={20}
                draggable
                onDragStart={() => onSelectItem(wall.id)}
                onDragMove={(e) => handleWallSegmentDrag(wall.id, e)}
                onClick={() => onSelectItem(wall.id)}
              />
              {/* Wall length label */}
              {(() => {
                const dx = wall.end.x - wall.start.x;
                const dy = wall.end.y - wall.start.y;
                const len = Math.sqrt(dx * dx + dy * dy);
                const mx = ((wall.start.x + wall.end.x) / 2) * SCALE;
                const my = ((wall.start.y + wall.end.y) / 2) * SCALE;
                return (
                  <Text
                    text={`${len.toFixed(1)}m`}
                    fontSize={9}
                    fill="rgba(255,255,255,0.3)"
                    x={mx + 4}
                    y={my - 12}
                  />
                );
              })()}
              {/* Draggable endpoints */}
              {selectedId === wall.id && (
                <>
                  <Circle
                    x={wall.start.x * SCALE}
                    y={wall.start.y * SCALE}
                    radius={8}
                    fill="#3b82f6"
                    stroke="#fff"
                    strokeWidth={2}
                    draggable
                    onDragMove={(e) => handleWallPointDrag(wall.id, "start", e)}
                  />
                  <Circle
                    x={wall.end.x * SCALE}
                    y={wall.end.y * SCALE}
                    radius={8}
                    fill="#3b82f6"
                    stroke="#fff"
                    strokeWidth={2}
                    draggable
                    onDragMove={(e) => handleWallPointDrag(wall.id, "end", e)}
                  />
                </>
              )}
            </Group>
          ))}

          {/* Furniture */}
          {furniture.map((item) => {
            const isSelected = selectedId === item.id;
            const fillColor = getFurnitureColor(item.type, isSelected);
            const strokeColor = getFurnitureStroke(item.type, isSelected);

            return (
              <Group
                key={item.id}
                x={item.position.x * SCALE}
                y={item.position.y * SCALE}
                rotation={item.rotation}
                draggable
                onDragStart={() => onSelectItem(item.id)}
                onDragEnd={(e) => handleFurnitureDrag(item.id, e)}
                onClick={() => onSelectItem(item.id)}
              >
                <Rect
                  width={item.width * SCALE}
                  height={item.depth * SCALE}
                  offsetX={(item.width * SCALE) / 2}
                  offsetY={(item.depth * SCALE) / 2}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={2}
                  cornerRadius={item.type === "door" ? 0 : 4}
                  opacity={0.8}
                  dash={item.type === "window" ? [4, 4] : undefined}
                />
                <Text
                  text={item.label}
                  fontSize={10}
                  fontFamily="Inter"
                  fill="#e4e4e7"
                  align="center"
                  verticalAlign="middle"
                  width={item.width * SCALE}
                  height={item.depth * SCALE}
                  offsetX={(item.width * SCALE) / 2}
                  offsetY={(item.depth * SCALE) / 2}
                />
              </Group>
            );
          })}
        </Layer>
      </Stage>
    </div>
  );
};

export default FloorplanEditor;
