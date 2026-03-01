import { useState, useCallback, useRef } from "react";
import { Upload, Loader2, RotateCcw, Image as ImageIcon, Box } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getHfSpacesUrl } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import DepthPointCloudViewer from "./DepthPointCloudViewer";

const MidasReconstruction = () => {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [depthMap, setDepthMap] = useState<number[][] | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPointCloud, setShowPointCloud] = useState(false);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setDepthMap(null);
    setShowPointCloud(false);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const runMidasAnalysis = useCallback(async () => {
    if (!imageFile) return;
    setIsProcessing(true);
    try {
      const url = getHfSpacesUrl();
      const formData = new FormData();
      formData.append("file", imageFile);

      const response = await fetch(`${url}/analyze`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error(`MiDaS analysis failed: ${response.status}`);

      const result = await response.json();

      if (result.depth_map && result.depth_map.length > 0) {
        setDepthMap(result.depth_map);
        setShowPointCloud(true);
        toast({ title: "Depth estimation complete", description: `${result.depth_map.length}×${result.depth_map[0].length} depth map generated via MiDaS.` });
      } else {
        toast({ title: "No depth data", description: "The backend returned no depth map. Ensure MiDaS model is loaded.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "MiDaS Error", description: err.message || "Could not connect to local backend.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  }, [imageFile, toast]);

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
            {isProcessing ? "Running MiDaS..." : "Generate 3D"}
          </Button>
        )}

        {depthMap && (
          <div className="ml-auto flex gap-2">
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
