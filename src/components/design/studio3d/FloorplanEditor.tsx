import { useState, useRef } from "react";
import { Stage, Layer, Rect, Line, Text, Group } from "react-konva";
import type { Room, Wall, EditMode } from "./types";

interface Props {
  rooms: Room[];
  walls: Wall[];
  editMode: EditMode;
  onRoomsChange: (rooms: Room[]) => void;
  onWallsChange: (walls: Wall[]) => void;
}

const FloorplanEditor = ({ rooms, walls, editMode, onRoomsChange, onWallsChange }: Props) => {
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleRoomDragEnd = (id: string, x: number, y: number) => {
    onRoomsChange(rooms.map((r) => (r.id === id ? { ...r, x, y } : r)));
  };

  return (
    <div ref={containerRef} className="h-full w-full">
      <Stage width={480} height={400} className="cursor-crosshair">
        <Layer>
          {/* Background grid */}
          {Array.from({ length: 25 }).map((_, i) => (
            <Line
              key={`gv-${i}`}
              points={[i * 20, 0, i * 20, 400]}
              stroke="rgba(74,144,226,0.08)"
              strokeWidth={1}
            />
          ))}
          {Array.from({ length: 21 }).map((_, i) => (
            <Line
              key={`gh-${i}`}
              points={[0, i * 20, 480, i * 20]}
              stroke="rgba(74,144,226,0.08)"
              strokeWidth={1}
            />
          ))}

          {/* Rooms */}
          {rooms.map((room) => (
            <Group
              key={room.id}
              x={room.x}
              y={room.y}
              draggable={editMode === "select" || editMode === "wall"}
              onDragEnd={(e) => handleRoomDragEnd(room.id, e.target.x(), e.target.y())}
              onClick={() => setSelectedRoomId(room.id)}
            >
              <Rect
                width={room.width}
                height={room.height}
                fill={room.color}
                stroke={selectedRoomId === room.id ? "#4a90e2" : "rgba(74,144,226,0.3)"}
                strokeWidth={selectedRoomId === room.id ? 2 : 1}
                cornerRadius={4}
              />
              <Text
                text={room.name}
                x={8}
                y={8}
                fontSize={11}
                fontFamily="Inter"
                fill="rgba(255,255,255,0.7)"
              />
              <Text
                text={`${(room.width / 50).toFixed(1)}m × ${(room.height / 50).toFixed(1)}m`}
                x={8}
                y={24}
                fontSize={9}
                fontFamily="Inter"
                fill="rgba(255,255,255,0.4)"
              />
            </Group>
          ))}

          {/* Walls */}
          {walls.map((wall) => (
            <Line
              key={wall.id}
              points={[wall.x1, wall.y1, wall.x2, wall.y2]}
              stroke="rgba(255,255,255,0.6)"
              strokeWidth={3}
              lineCap="round"
              hitStrokeWidth={10}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
};

export default FloorplanEditor;
