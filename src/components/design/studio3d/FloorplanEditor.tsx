import React, { useState, useEffect, useRef } from "react";
import { Stage, Layer, Rect, Line, Text, Group, Circle } from "react-konva";
import type { Wall, Furniture } from "./types";

interface Props {
  walls: Wall[];
  furniture: Furniture[];
  onUpdateWalls: (walls: Wall[]) => void;
  onUpdateFurniture: (furniture: Furniture[]) => void;
  onSelectItem: (id: string | null) => void;
  selectedId: string | null;
}

const SCALE = 50; // 1 meter = 50 pixels

const FloorplanEditor: React.FC<Props> = ({
  walls,
  furniture,
  onUpdateWalls,
  onUpdateFurniture,
  onSelectItem,
  selectedId,
}) => {
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);

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

  return (
    <div ref={containerRef} className="w-full h-full cursor-crosshair" style={{ minHeight: 400, background: "#0d1225" }}>
      <Stage width={dimensions.width} height={dimensions.height} draggable>
        <Layer>
          {/* Grid Lines */}
          {Array.from({ length: 100 }).map((_, i) => (
            <React.Fragment key={i}>
              <Line
                points={[i * SCALE, -5000, i * SCALE, 5000]}
                stroke="rgba(74,144,226,0.06)"
                strokeWidth={1}
              />
              <Line
                points={[-5000, i * SCALE, 5000, i * SCALE]}
                stroke="rgba(74,144,226,0.06)"
                strokeWidth={1}
              />
            </React.Fragment>
          ))}

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
                strokeWidth={wall.thickness * SCALE}
                hitStrokeWidth={20}
                draggable
                onDragStart={() => onSelectItem(wall.id)}
                onDragMove={(e) => handleWallSegmentDrag(wall.id, e)}
                onClick={() => onSelectItem(wall.id)}
              />
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
          {furniture.map((item) => (
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
                fill={selectedId === item.id ? "#3b82f6" : "#52525b"}
                stroke={selectedId === item.id ? "#93c5fd" : "#71717a"}
                strokeWidth={2}
                cornerRadius={4}
                opacity={0.8}
              />
              <Text
                text={item.label}
                fontSize={11}
                fontFamily="Inter"
                fill="#e4e4e7"
                align="center"
                width={item.width * SCALE}
                offsetX={(item.width * SCALE) / 2}
                y={5}
              />
            </Group>
          ))}
        </Layer>
      </Stage>
    </div>
  );
};

export default FloorplanEditor;
