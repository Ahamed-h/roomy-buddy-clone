import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import * as THREE from "three";

interface Props {
  depthMap: number[][];
  imageUrl: string;
  width: number;
  height: number;
}

/**
 * Converts a 2D depth map + source image into a 3D point cloud.
 * Each pixel becomes a vertex positioned by (x, y, depth).
 * Color is sampled from the original image via an off-screen canvas.
 */
function PointCloud({
  depthMap,
  imageUrl,
  width,
  height,
}: Props) {
  const meshRef = useRef<THREE.Points>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const colorsReady = useRef(false);

  const { positions, colors, count } = useMemo(() => {
    const step = 2; // sample every 2nd pixel for performance
    const rows = depthMap.length;
    const cols = depthMap[0]?.length ?? 0;

    const sampledRows = Math.ceil(rows / step);
    const sampledCols = Math.ceil(cols / step);
    const total = sampledRows * sampledCols;

    const pos = new Float32Array(total * 3);
    const col = new Float32Array(total * 3);

    // Normalise depth values
    let minD = Infinity,
      maxD = -Infinity;
    for (let r = 0; r < rows; r += step) {
      for (let c = 0; c < cols; c += step) {
        const d = depthMap[r][c];
        if (d < minD) minD = d;
        if (d > maxD) maxD = d;
      }
    }
    const range = maxD - minD || 1;

    // Scale factor so the cloud fits nicely in the viewer
    const scaleX = 8 / cols;
    const scaleY = 8 / rows;
    const depthScale = 4;

    let idx = 0;
    for (let r = 0; r < rows; r += step) {
      for (let c = 0; c < cols; c += step) {
        const d = (depthMap[r][c] - minD) / range;
        // x across, y up (inverted), z = depth
        pos[idx * 3] = (c - cols / 2) * scaleX;
        pos[idx * 3 + 1] = -(r - rows / 2) * scaleY;
        pos[idx * 3 + 2] = -d * depthScale;

        // Default grey, will be replaced with image colors
        col[idx * 3] = 0.4 + d * 0.6;
        col[idx * 3 + 1] = 0.4 + d * 0.4;
        col[idx * 3 + 2] = 0.5 + d * 0.5;
        idx++;
      }
    }

    return { positions: pos, colors: col, count: total };
  }, [depthMap]);

  // Load image and sample colors onto points
  useMemo(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, img.width, img.height).data;

      const rows = depthMap.length;
      const cols = depthMap[0]?.length ?? 0;
      const step = 2;
      let idx = 0;

      for (let r = 0; r < rows; r += step) {
        for (let c = 0; c < cols; c += step) {
          // Map depth-map coords to image coords
          const imgX = Math.floor((c / cols) * img.width);
          const imgY = Math.floor((r / rows) * img.height);
          const pixelIdx = (imgY * img.width + imgX) * 4;
          colors[idx * 3] = imgData[pixelIdx] / 255;
          colors[idx * 3 + 1] = imgData[pixelIdx + 1] / 255;
          colors[idx * 3 + 2] = imgData[pixelIdx + 2] / 255;
          idx++;
        }
      }
      colorsReady.current = true;
    };
    img.src = imageUrl;
    imgRef.current = img;
  }, [imageUrl, depthMap, colors]);

  // Update geometry colors once image loads
  useFrame(() => {
    if (colorsReady.current && meshRef.current) {
      const geo = meshRef.current.geometry;
      geo.attributes.color.needsUpdate = true;
      colorsReady.current = false;
    }
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={count}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
          count={count}
        />
      </bufferGeometry>
      <pointsMaterial size={0.06} vertexColors sizeAttenuation />
    </points>
  );
}

const DepthPointCloudViewer = ({ depthMap, imageUrl, width, height }: Props) => {
  return (
    <div className="h-full w-full rounded-lg overflow-hidden">
      <Canvas camera={{ position: [0, 0, 8], fov: 50 }} gl={{ antialias: true }}>
        <Suspense fallback={null}>
          <color attach="background" args={["#080c1a"]} />
          <fog attach="fog" args={["#080c1a", 12, 25]} />
          <ambientLight intensity={0.5} />
          <pointLight position={[5, 5, 5]} intensity={0.3} />
          <PointCloud depthMap={depthMap} imageUrl={imageUrl} width={width} height={height} />
          <OrbitControls makeDefault enablePan enableZoom minDistance={2} maxDistance={15} />
          <Environment preset="night" />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default DepthPointCloudViewer;
