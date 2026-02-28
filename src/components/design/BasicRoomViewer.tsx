import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";

function RoomShape() {
  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[6, 6]} />
        <meshStandardMaterial color="hsl(220,15%,18%)" />
      </mesh>
      {/* Back wall */}
      <mesh position={[0, 1.5, -3]} receiveShadow>
        <planeGeometry args={[6, 3]} />
        <meshStandardMaterial color="hsl(220,12%,22%)" />
      </mesh>
      {/* Left wall */}
      <mesh position={[-3, 1.5, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[6, 3]} />
        <meshStandardMaterial color="hsl(220,12%,20%)" />
      </mesh>
      {/* Simple box furniture placeholder */}
      <mesh position={[0, 0.4, -1.5]} castShadow>
        <boxGeometry args={[2, 0.8, 0.8]} />
        <meshStandardMaterial color="hsl(30,30%,40%)" />
      </mesh>
      <mesh position={[1.5, 0.3, 0.5]} castShadow>
        <boxGeometry args={[0.8, 0.6, 0.8]} />
        <meshStandardMaterial color="hsl(200,20%,35%)" />
      </mesh>
    </group>
  );
}

export function BasicRoomViewer() {
  return (
    <div className="h-[400px] w-full rounded-lg border border-border overflow-hidden bg-muted/30">
      <Canvas shadows camera={{ position: [5, 4, 5], fov: 50 }}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.4} />
          <directionalLight position={[5, 8, 5]} intensity={0.7} castShadow />
          <RoomShape />
          <OrbitControls makeDefault />
          <Environment preset="apartment" />
        </Suspense>
      </Canvas>
    </div>
  );
}
