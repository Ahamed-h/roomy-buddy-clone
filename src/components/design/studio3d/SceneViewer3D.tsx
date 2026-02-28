import { Suspense, useState, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Grid, Environment, TransformControls, Text as DreiText } from "@react-three/drei";
import type { PlacedFurniture, Room } from "./types";
import * as THREE from "three";

interface Props {
  rooms: Room[];
  furniture: PlacedFurniture[];
  selectedId: string | null;
  onSelectFurniture: (id: string | null) => void;
  onUpdateFurniture: (id: string, position: [number, number, number]) => void;
}

function RoomMesh({ rooms }: { rooms: Room[] }) {
  const scale = 0.02; // 50px = 1m
  return (
    <group>
      {rooms.map((room) => {
        const w = room.width * scale;
        const d = room.height * scale;
        const cx = (room.x + room.width / 2) * scale - 5;
        const cz = (room.y + room.height / 2) * scale - 4;
        return (
          <group key={room.id}>
            {/* Floor */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.01, cz]} receiveShadow>
              <planeGeometry args={[w, d]} />
              <meshStandardMaterial color="#1a1f3a" opacity={0.6} transparent />
            </mesh>
            {/* Walls - back */}
            <mesh position={[cx, 1.4, cz - d / 2]} receiveShadow>
              <boxGeometry args={[w, 2.8, 0.08]} />
              <meshStandardMaterial color="#1e2545" opacity={0.5} transparent />
            </mesh>
            {/* Walls - left */}
            <mesh position={[cx - w / 2, 1.4, cz]} receiveShadow>
              <boxGeometry args={[0.08, 2.8, d]} />
              <meshStandardMaterial color="#1e2545" opacity={0.5} transparent />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function FurniturePiece({
  item,
  isSelected,
  onSelect,
  onUpdate,
}: {
  item: PlacedFurniture;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (pos: [number, number, number]) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  return (
    <>
      <mesh
        ref={meshRef}
        position={item.position}
        rotation={item.rotation}
        scale={item.scale}
        castShadow
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        <boxGeometry args={item.dimensions} />
        <meshStandardMaterial
          color={item.color}
          emissive={isSelected ? "#4a90e2" : "#000000"}
          emissiveIntensity={isSelected ? 0.3 : 0}
        />
        {isSelected && (
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(...item.dimensions)]} />
            <lineBasicMaterial color="#4a90e2" linewidth={2} />
          </lineSegments>
        )}
      </mesh>
      {isSelected && meshRef.current && (
        <TransformControls
          object={meshRef.current}
          mode="translate"
          onObjectChange={() => {
            if (meshRef.current) {
              const p = meshRef.current.position;
              onUpdate([p.x, p.y, p.z]);
            }
          }}
        />
      )}
    </>
  );
}

const SceneViewer3D = ({ rooms, furniture, selectedId, onSelectFurniture, onUpdateFurniture }: Props) => {
  return (
    <div className="h-full w-full rounded-lg overflow-hidden">
      <Canvas shadows camera={{ position: [8, 6, 8], fov: 45 }} gl={{ antialias: true }}>
        <Suspense fallback={null}>
          <color attach="background" args={["#0a0f2a"]} />
          <fog attach="fog" args={["#0a0f2a", 15, 30]} />

          <ambientLight intensity={0.3} />
          <directionalLight position={[5, 10, 5]} intensity={0.7} castShadow shadow-mapSize={2048} />
          <pointLight position={[0, 4, 0]} intensity={0.4} color="#4a90e2" />

          {/* Floor */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
            <planeGeometry args={[20, 20]} />
            <meshStandardMaterial color="#0d1225" />
          </mesh>

          <RoomMesh rooms={rooms} />

          {furniture.map((f) => (
            <FurniturePiece
              key={f.id}
              item={f}
              isSelected={selectedId === f.id}
              onSelect={() => onSelectFurniture(f.id)}
              onUpdate={(pos) => onUpdateFurniture(f.id, pos)}
            />
          ))}

          <Grid
            args={[20, 20]}
            position={[0, 0.005, 0]}
            cellSize={0.5}
            cellColor="#1a2040"
            sectionSize={2}
            sectionColor="#2a3060"
            fadeDistance={15}
            fadeStrength={1}
          />

          <OrbitControls
            makeDefault
            minDistance={3}
            maxDistance={20}
            maxPolarAngle={Math.PI / 2.1}
          />
          <Environment preset="night" />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default SceneViewer3D;
