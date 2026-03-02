import { Suspense, useRef, forwardRef, useImperativeHandle } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Grid, Environment, PerspectiveCamera, ContactShadows } from "@react-three/drei";
import type { Wall, Furniture } from "./types";

/** Procedural 3D furniture meshes based on type */
const ProceduralFurniture = ({ item }: { item: Furniture }) => {
  const { type, width: w, depth: d, height: h } = item;

  switch (type.toLowerCase()) {
    case "bed":
      return (
        <group>
          <mesh position={[0, h * 0.2, 0]}>
            <boxGeometry args={[w, h * 0.4, d]} />
            <meshStandardMaterial color="#451a03" />
          </mesh>
          <mesh position={[0, h * 0.6, 0]}>
            <boxGeometry args={[w * 0.95, h * 0.4, d * 0.95]} />
            <meshStandardMaterial color="#f8fafc" />
          </mesh>
          <mesh position={[-w * 0.25, h * 0.85, -d * 0.35]}>
            <boxGeometry args={[w * 0.4, h * 0.1, d * 0.2]} />
            <meshStandardMaterial color="#e2e8f0" />
          </mesh>
          <mesh position={[w * 0.25, h * 0.85, -d * 0.35]}>
            <boxGeometry args={[w * 0.4, h * 0.1, d * 0.2]} />
            <meshStandardMaterial color="#e2e8f0" />
          </mesh>
        </group>
      );
    case "sofa":
      return (
        <group>
          <mesh position={[0, h * 0.3, d * 0.1]}>
            <boxGeometry args={[w, h * 0.4, d * 0.8]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          <mesh position={[0, h * 0.6, -d * 0.4]}>
            <boxGeometry args={[w, h * 0.8, d * 0.2]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          <mesh position={[-w * 0.45, h * 0.5, 0]}>
            <boxGeometry args={[w * 0.1, h * 0.6, d]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
          <mesh position={[w * 0.45, h * 0.5, 0]}>
            <boxGeometry args={[w * 0.1, h * 0.6, d]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
        </group>
      );
    case "table":
      return (
        <group>
          <mesh position={[0, h - 0.05, 0]}>
            <boxGeometry args={[w, 0.1, d]} />
            <meshStandardMaterial color="#78350f" />
          </mesh>
          {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
            <mesh key={i} position={[sx * (w / 2 - 0.1), h / 2, sz * (d / 2 - 0.1)]}>
              <cylinderGeometry args={[0.05, 0.05, h, 8]} />
              <meshStandardMaterial color="#451a03" />
            </mesh>
          ))}
        </group>
      );
    case "chair":
      return (
        <group>
          <mesh position={[0, h * 0.5, 0]}>
            <boxGeometry args={[w, 0.05, d]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
          <mesh position={[0, h * 0.8, -d / 2 + 0.05]}>
            <boxGeometry args={[w, h * 0.4, 0.05]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
          {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
            <mesh key={i} position={[sx * (w / 2 - 0.05), h * 0.25, sz * (d / 2 - 0.05)]}>
              <boxGeometry args={[0.05, h * 0.5, 0.05]} />
              <meshStandardMaterial color="#334155" />
            </mesh>
          ))}
        </group>
      );
    case "cabinet":
      return (
        <group>
          <mesh position={[0, h / 2, 0]}>
            <boxGeometry args={[w, h, d]} />
            <meshStandardMaterial color="#f1f5f9" />
          </mesh>
          <mesh position={[0, h / 2, d / 2 + 0.01]}>
            <boxGeometry args={[w * 0.95, h * 0.95, 0.01]} />
            <meshStandardMaterial color="#e2e8f0" />
          </mesh>
          <mesh position={[-0.05, h / 2, d / 2 + 0.02]}>
            <boxGeometry args={[0.02, 0.2, 0.02]} />
            <meshStandardMaterial color="#94a3b8" />
          </mesh>
          <mesh position={[0.05, h / 2, d / 2 + 0.02]}>
            <boxGeometry args={[0.02, 0.2, 0.02]} />
            <meshStandardMaterial color="#94a3b8" />
          </mesh>
        </group>
      );
    case "toilet":
      return (
        <group>
          <mesh position={[0, h * 0.3, d * 0.2]}>
            <cylinderGeometry args={[w * 0.4, w * 0.3, h * 0.6, 16]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0, h * 0.6, -d * 0.3]}>
            <boxGeometry args={[w * 0.8, h * 0.8, d * 0.4]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
        </group>
      );
    default:
      return (
        <mesh position={[0, h / 2, 0]}>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial color="#64748b" />
        </mesh>
      );
  }
};

const FurnitureModel = ({ item }: { item: Furniture }) => (
  <group
    position={[item.position.x, 0, item.position.y]}
    rotation={[0, (-item.rotation * Math.PI) / 180, 0]}
  >
    <ProceduralFurniture item={item} />
  </group>
);

const WallModel = ({ wall }: { wall: Wall }) => {
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);
  const centerX = (wall.start.x + wall.end.x) / 2;
  const centerY = (wall.start.y + wall.end.y) / 2;
  const height = 2.5;

  return (
    <mesh position={[centerX, height / 2, centerY]} rotation={[0, -angle, 0]}>
      <boxGeometry args={[length, height, wall.thickness]} />
      <meshStandardMaterial color="#e4e4e7" />
    </mesh>
  );
};

/** Inner component to capture the Three.js scene ref */
const SceneContent = forwardRef<THREE.Scene, { walls: Wall[]; furniture: Furniture[]; centerX: number; centerY: number; floorWidth: number; floorHeight: number }>(
  ({ walls, furniture, centerX, centerY, floorWidth, floorHeight }, ref) => {
    const { scene } = useThree();
    useImperativeHandle(ref, () => scene, [scene]);

    return (
      <>
        <PerspectiveCamera makeDefault position={[centerX + 5, 10, centerY + 5]} />
        <OrbitControls
          makeDefault
          target={[centerX, 0, centerY]}
          minPolarAngle={0}
          maxPolarAngle={Math.PI / 2.1}
        />

        <color attach="background" args={["#0a0f2a"]} />
        <ambientLight intensity={0.7} />
        <directionalLight
          position={[10, 20, 10]}
          intensity={1.5}
          castShadow
          shadow-mapSize={2048}
        />
        <pointLight position={[-10, 10, -10]} intensity={0.5} />
        <Environment preset="night" />

        <group>
          {walls.map((wall) => (
            <WallModel key={wall.id} wall={wall} />
          ))}
          {furniture.map((item) => (
            <FurnitureModel key={item.id} item={item} />
          ))}
        </group>

        {/* Floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[centerX, -0.01, centerY]} receiveShadow>
          <planeGeometry args={[floorWidth, floorHeight]} />
          <meshStandardMaterial color="#27272a" />
        </mesh>

        <Grid
          args={[40, 40]}
          position={[0, -0.02, 0]}
          cellSize={0.5}
          cellColor="#1a2040"
          sectionSize={1}
          sectionColor="#2a3060"
          fadeDistance={30}
          fadeStrength={1}
        />
        <ContactShadows position={[0, 0, 0]} opacity={0.4} scale={40} blur={2} far={4.5} />
      </>
    );
  }
);

SceneContent.displayName = "SceneContent";

interface Props {
  walls: Wall[];
  furniture: Furniture[];
}

export interface SceneViewer3DHandle {
  exportGLB: () => Promise<Blob>;
}

import * as THREE from "three";

const SceneViewer3D = forwardRef<SceneViewer3DHandle, Props>(({ walls, furniture }, ref) => {
  const sceneRef = useRef<THREE.Scene>(null);

  const allPoints = walls.flatMap((w) => [w.start, w.end]);
  const minX = Math.min(...allPoints.map((p) => p.x), 0) - 2;
  const maxX = Math.max(...allPoints.map((p) => p.x), 10) + 2;
  const minY = Math.min(...allPoints.map((p) => p.y), 0) - 2;
  const maxY = Math.max(...allPoints.map((p) => p.y), 10) + 2;

  const floorWidth = maxX - minX;
  const floorHeight = maxY - minY;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  useImperativeHandle(ref, () => ({
    exportGLB: async () => {
      const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");
      const exporter = new GLTFExporter();
      const scene = sceneRef.current;
      if (!scene) throw new Error("Scene not ready");

      return new Promise<Blob>((resolve, reject) => {
        exporter.parse(
          scene,
          (result) => {
            const blob = new Blob([result as ArrayBuffer], { type: "model/gltf-binary" });
            resolve(blob);
          },
          (error) => reject(error),
          { binary: true }
        );
      });
    },
  }));

  return (
    <div className="h-full w-full rounded-lg overflow-hidden" style={{ minHeight: 400 }}>
      <Canvas shadows gl={{ antialias: true }}>
        <Suspense fallback={null}>
          <SceneContent
            ref={sceneRef}
            walls={walls}
            furniture={furniture}
            centerX={centerX}
            centerY={centerY}
            floorWidth={floorWidth}
            floorHeight={floorHeight}
          />
        </Suspense>
      </Canvas>
    </div>
  );
});

SceneViewer3D.displayName = "SceneViewer3D";

export default SceneViewer3D;
