import { useState, useCallback, useRef } from "react";
import { Upload, Loader2, RotateCcw, Image as ImageIcon, Box, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import DepthPointCloudViewer from "./DepthPointCloudViewer";

/** Generate a synthetic depth map from image dimensions using radial gradient */
function generateMockDepthMap(width: number, height: number): number[][] {
  const rows = Math.min(height, 128);
  const cols = Math.min(width, 128);
  const cx = cols / 2, cy = rows / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);
  const map: number[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: number[] = [];
    for (let c = 0; c < cols; c++) {
      const dx = c - cx, dy = r - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) / maxDist;
      // Radial gradient with some noise for visual interest
      const noise = Math.sin(c * 0.3) * 0.05 + Math.cos(r * 0.25) * 0.05;
      row.push(Math.min(1, Math.max(0, dist * 0.8 + noise + 0.1)));
    }
    map.push(row);
  }
  return map;
}

const MidasReconstruction = () => {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [depthMap, setDepthMap] = useState<number[][] | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPointCloud, setShowPointCloud] = useState(false);
  const [isDemo, setIsDemo] = useState(false);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setDepthMap(null);
    setShowPointCloud(false);
    setIsDemo(false);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const runMidasAnalysis = useCallback(async () => {
    if (!imageFile) return;
    setIsProcessing(true);
    try {
      // Use gemini-ai vision to describe the depth/3D structure
      const reader = new FileReader();
      const imageBase64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(imageFile);
      });

      const { data, error } = await supabase.functions.invoke("gemini-ai", {
        body: {
          action: "vision",
          prompt: "Analyze this room image for depth estimation. Describe the spatial layout, distances of objects from the camera, and depth layers visible in the scene.",
          imageBase64,
        },
      });

      if (error) throw error;
      const result = data;

      if (result.depth_map && result.depth_map.length > 0) {
        setDepthMap(result.depth_map);
        setShowPointCloud(true);
        setIsDemo(false);
        toast({ title: "Depth estimation complete", description: `${result.depth_map.length}×${result.depth_map[0].length} depth map generated via MiDaS.` });
      } else {
        toast({ title: "No depth data", description: "The backend returned no depth map. Ensure MiDaS model is loaded.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Backend unavailable", description: "Falling back to demo mode with synthetic depth.", variant: "default" });
      // Fall back to demo mode
      runDemoMode();
    } finally {
      setIsProcessing(false);
    }
  }, [imageFile, toast]);

  const runDemoMode = useCallback(() => {
    if (!imagePreview) return;
    setIsProcessing(true);
    // Load image to get dimensions
    const img = new Image();
    img.onload = () => {
      const mockMap = generateMockDepthMap(img.width, img.height);
      setDepthMap(mockMap);
      setShowPointCloud(true);
      setIsDemo(true);
      setIsProcessing(false);
      toast({ title: "Demo 3D generated", description: `${mockMap.length}×${mockMap[0].length} synthetic depth map. Connect backend for real MiDaS results.` });
    };
    img.onerror = () => {
      setIsProcessing(false);
      toast({ title: "Error", description: "Could not load image for demo mode.", variant: "destructive" });
    };
    img.src = imagePreview;
  }, [imagePreview, toast]);

  const handleReset = useCallback(() => {
    setImageFile(null);
    setImagePreview(null);
    setDepthMap(null);
    setShowPointCloud(false);
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  return (
    <div className="flex flex-col gap-3">
      {/* Upload & Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFileSelect}
          className="hidden"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
        >
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          Upload Image
        </Button>

        {imageFile && (
          <>
            <Button
              size="sm"
              onClick={runMidasAnalysis}
              disabled={isProcessing}
              className="bg-[#4a90e2] hover:bg-[#3a7bd2] text-white"
            >
              {isProcessing ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Box className="mr-1.5 h-3.5 w-3.5" />
              )}
              {isProcessing ? "Processing..." : "Generate 3D"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={runDemoMode}
              disabled={isProcessing}
              className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Demo 3D
            </Button>
          </>
        )}

        {depthMap && (
          <div className="ml-auto flex items-center gap-2">
            {isDemo && (
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">Demo</span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPointCloud(!showPointCloud)}
              className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
            >
              {showPointCloud ? (
                <><ImageIcon className="mr-1.5 h-3.5 w-3.5" /> Show Image</>
              ) : (
                <><Box className="mr-1.5 h-3.5 w-3.5" /> Show 3D</>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
            </Button>
          </div>
        )}
      </div>

      {/* Viewport */}
      <div className="relative rounded-lg border border-white/10 bg-[#080c1a] overflow-hidden" style={{ minHeight: 380 }}>
        {!imagePreview && !depthMap && (
          <div className="flex h-[380px] flex-col items-center justify-center gap-3 text-white/30">
            <Box className="h-10 w-10" />
            <p className="text-sm">Upload a room image to generate a 3D point cloud via MiDaS depth estimation</p>
          </div>
        )}

        {imagePreview && !showPointCloud && (
          <div className="flex h-[380px] items-center justify-center p-4">
            <img
              src={imagePreview}
              alt="Source image"
              className="max-h-full max-w-full rounded-lg object-contain"
            />
          </div>
        )}

        {showPointCloud && depthMap && imagePreview && (
          <div className="h-[380px]">
            <DepthPointCloudViewer
              depthMap={depthMap}
              imageUrl={imagePreview}
              width={depthMap[0]?.length ?? 0}
              height={depthMap.length}
            />
          </div>
        )}

        {isProcessing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 backdrop-blur-sm">
            <Loader2 className="h-8 w-8 animate-spin text-[#4a90e2]" />
            <p className="text-sm text-white/60">Running MiDaS depth estimation...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MidasReconstruction;
