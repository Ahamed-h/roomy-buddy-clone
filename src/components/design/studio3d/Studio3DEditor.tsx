import { useState, useCallback, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import {
  Box,
  Layers,
  Upload,
  Plus,
  Eye,
  Loader2,
  ChevronRight,
  ChevronLeft,
  ScanEye,
  RotateCcw,
  Download,
} from "lucide-react";
import SceneViewer3D, { type SceneViewer3DHandle } from "./SceneViewer3D";
import FloorplanAnalyzer from "./FloorplanAnalyzer";
import { MOCK_WALLS, MOCK_FURNITURE_ITEMS, getSampleData, FURNITURE_LIBRARY } from "./mockData";
import type { Wall, Furniture, FloorplanAnalysis } from "./types";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { isOllamaAvailable, ollamaVision } from "@/services/ollama";
import { directVision, hasDirectKeys } from "@/services/directAI";

const ROOM_ANALYSIS_PROMPT = `You are a senior architectural space planner. Analyse the uploaded floor plan image carefully.

Return ONLY a single valid JSON object — no markdown, no explanation, nothing else.

Schema:
{
  "rooms": [
    {
      "id": "r1",
      "type": "Living Room",
      "label": "Living Room",
      "estimatedSqFt": 220,
      "x": 5,
      "y": 8,
      "width": 30,
      "height": 25,
      "notes": "Open plan, south-facing"
    }
  ],
  "totalArea": 1400,
  "score": 7.2,
  "summary": "Compact 2BR apartment with efficient layout",
  "insights": [
    { "type": "positive", "text": "Good separation of wet and dry zones" },
    { "type": "warning",  "text": "Bedroom 2 has no direct natural light" },
    { "type": "negative", "text": "Kitchen triangle inefficient" }
  ],
  "flowIssues": ["Living room acts as through-corridor to bedrooms"],
  "recommendations": [
    {
      "id": "rec1",
      "title": "Enlarge Kitchen",
      "description": "Extend kitchen 4 ft east, removing awkward pantry nook",
      "impact": "high",
      "roomChanges": [
        { "id": "r2", "width": 22, "height": 18, "notes": "Expanded kitchen with island" }
      ]
    }
  ]
}

Rules:
- x, y, width, height are PERCENTAGES (0–100) of the image dimensions
- Only identify rooms clearly delimited by walls, labels or boundaries in the image
- Do NOT invent rooms that are not visible
- Every recommendation roomChange must reference a real room id from the rooms array
- score is 0–10 based on: flow efficiency, natural light, privacy zoning, storage, space utilisation
- impact must be "high", "medium", or "low"
- type must be one of: Living Room, Bedroom, Kitchen, Bathroom, Dining Room, Office, Hallway, Garage, Laundry, Storage, Balcony, Unknown`;

function parseAnalysisJSON(raw: string): FloorplanAnalysis {
  let jsonStr = raw;
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) jsonStr = fenceMatch[1].trim();
  if (!jsonStr.startsWith("{")) {
    const braceMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (braceMatch) jsonStr = braceMatch[0];
  }
  return JSON.parse(jsonStr);
}

/** Convert percentage-based rooms into metric walls & furniture for the 3D view */
function roomsTo3D(analysis: FloorplanAnalysis): { walls: Wall[]; furniture: Furniture[] } {
  // Assume a 20m x 20m real-world space mapped from 0-100% coordinates
  const SCALE = 0.2; // 1% = 0.2m
  const wallList: Wall[] = [];
  const furnitureList: Furniture[] = [];

  analysis.rooms.forEach((room) => {
    const x1 = room.x * SCALE;
    const y1 = room.y * SCALE;
    const x2 = (room.x + room.width) * SCALE;
    const y2 = (room.y + room.height) * SCALE;
    const prefix = room.id;

    // 4 walls per room
    wallList.push(
      { id: `${prefix}-wt`, start: { x: x1, y: y1 }, end: { x: x2, y: y1 }, thickness: 0.12 },
      { id: `${prefix}-wr`, start: { x: x2, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.12 },
      { id: `${prefix}-wb`, start: { x: x2, y: y2 }, end: { x: x1, y: y2 }, thickness: 0.12 },
      { id: `${prefix}-wl`, start: { x: x1, y: y2 }, end: { x: x1, y: y1 }, thickness: 0.12 },
    );

    // Place a label-furniture marker at center of each room
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const rw = (x2 - x1);
    const rh = (y2 - y1);

    // Add contextual furniture based on room type
    const t = room.type.toLowerCase();
    if (t.includes("bed")) {
      furnitureList.push({ id: `${prefix}-bed`, type: "bed", label: room.label, position: { x: cx, y: cy }, rotation: 0, width: Math.min(rw * 0.5, 2), depth: Math.min(rh * 0.5, 2), height: 0.6 });
    } else if (t.includes("living")) {
      furnitureList.push({ id: `${prefix}-sofa`, type: "sofa", label: room.label, position: { x: cx, y: cy }, rotation: 0, width: Math.min(rw * 0.5, 2.2), depth: Math.min(rh * 0.3, 0.9), height: 0.8 });
    } else if (t.includes("kitchen") || t.includes("dining")) {
      furnitureList.push({ id: `${prefix}-table`, type: "table", label: room.label, position: { x: cx, y: cy }, rotation: 0, width: Math.min(rw * 0.4, 1.2), depth: Math.min(rh * 0.3, 0.8), height: 0.75 });
    } else if (t.includes("bath")) {
      furnitureList.push({ id: `${prefix}-toilet`, type: "toilet", label: room.label, position: { x: cx, y: cy }, rotation: 0, width: 0.4, depth: 0.7, height: 0.4 });
    } else if (t.includes("office")) {
      furnitureList.push({ id: `${prefix}-desk`, type: "table", label: room.label, position: { x: cx, y: cy }, rotation: 0, width: Math.min(rw * 0.4, 1.4), depth: Math.min(rh * 0.3, 0.7), height: 0.75 });
    }
  });

  // Deduplicate overlapping walls (shared between adjacent rooms)
  const wallMap = new Map<string, Wall>();
  wallList.forEach((w) => {
    const key = [
      Math.min(w.start.x, w.end.x).toFixed(2),
      Math.min(w.start.y, w.end.y).toFixed(2),
      Math.max(w.start.x, w.end.x).toFixed(2),
      Math.max(w.start.y, w.end.y).toFixed(2),
    ].join(",");
    if (!wallMap.has(key)) wallMap.set(key, w);
  });

  return { walls: Array.from(wallMap.values()), furniture: furnitureList };
}

const Studio3DEditor = () => {
  const { toast } = useToast();
  const sceneRef = useRef<SceneViewer3DHandle>(null);
  const [isExporting, setIsExporting] = useState(false);

  const [view, setView] = useState<"2d" | "3d">("2d");
  const [walls, setWalls] = useState<Wall[]>(MOCK_WALLS);
  const [furniture, setFurniture] = useState<Furniture[]>(MOCK_FURNITURE_ITEMS);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<FloorplanAnalysis | null>(null);

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;
      setIsProcessing(true);
      setAnalysis(null);
      try {
        const imageBase64 = await fileToBase64(file);
        setUploadedImageUrl(imageBase64);

        let result: FloorplanAnalysis | null = null;

        // Try Ollama first
        const ollamaOnline = await isOllamaAvailable();
        if (ollamaOnline) {
          try {
            toast({ title: "Analyzing with local AI (Qwen2.5-VL)..." });
            const raw = await ollamaVision(ROOM_ANALYSIS_PROMPT, imageBase64);
            result = parseAnalysisJSON(raw);
          } catch (err) {
            console.warn("Ollama analysis failed:", err);
          }
        }

        // Try direct API
        if (!result && hasDirectKeys()) {
          try {
            toast({ title: "Analyzing with direct API..." });
            const raw = await directVision(ROOM_ANALYSIS_PROMPT, imageBase64);
            result = parseAnalysisJSON(raw);
          } catch (err) {
            console.warn("Direct API analysis failed:", err);
          }
        }

        // Fallback to edge function
        if (!result) {
          toast({ title: "Analyzing with cloud AI..." });
          const { data: edgeData, error } = await supabase.functions.invoke("analyze-floorplan", {
            body: { imageBase64, mode: "rooms" },
          });
          if (error) throw error;
          if (edgeData?.error) throw new Error(edgeData.error);
          // The edge function may return room-format or wall-format data
          if (edgeData?.rooms) {
            result = edgeData as FloorplanAnalysis;
          } else {
            // Convert wall-format to basic room format
            result = {
              rooms: [],
              totalArea: 0,
              score: 0,
              summary: "Analysis returned wall data. Room detection not available with this provider.",
              insights: [],
              flowIssues: [],
              recommendations: [],
            };
            // Still load walls/furniture for 3D view
            if (edgeData?.walls) setWalls(edgeData.walls);
            if (edgeData?.furniture) setFurniture(edgeData.furniture);
          }
        }

        if (result) {
          setAnalysis(result);
          // Convert rooms to 3D walls & furniture
          if (result.rooms && result.rooms.length > 0) {
            const scene3d = roomsTo3D(result);
            setWalls(scene3d.walls);
            setFurniture(scene3d.furniture);
          }
          toast({
            title: "AI Analysis Complete",
            description: `Detected ${result.rooms?.length || 0} rooms. Score: ${result.score?.toFixed(1) || "N/A"}/10`,
          });
        }
      } catch (err: any) {
        console.error("Floorplan analysis failed:", err);
        toast({
          title: "Analysis Failed",
          description: err?.message || "Unknown error",
          variant: "destructive",
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [toast]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    multiple: false,
  });

  const handleReset = () => {
    setWalls([]);
    setFurniture([]);
    setAnalysis(null);
    setUploadedImageUrl(null);
    toast({ title: "Scene Cleared" });
  };

  return (
    <div
      className="flex overflow-hidden rounded-xl border border-white/10"
      style={{
        background: "linear-gradient(180deg, #0a0f2a 0%, #1a1f3a 100%)",
        margin: "-1.5rem",
        height: "calc(100vh - 200px)",
        minHeight: 600,
      }}
    >
      {/* Main Content */}
      <main className="relative flex-1 flex flex-col overflow-hidden">
        {/* Header bar */}
        <header className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-[#0d1225]/80 backdrop-blur-xl z-40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-[#4a90e2] rounded-lg">
              <Box className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-sm font-bold text-white tracking-tight">ArchAI Studio</h2>
          </div>

          {/* 2D / 3D Toggle */}
          <div className="flex items-center p-0.5 bg-white/5 rounded-full">
            <button
              onClick={() => setView("2d")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                view === "2d" ? "bg-[#4a90e2] text-white shadow-lg" : "text-white/40 hover:text-white/60"
              }`}
            >
              <ScanEye className="w-3.5 h-3.5" />
              <span>Analyzer</span>
            </button>
            <button
              onClick={() => setView("3d")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                view === "3d" ? "bg-[#4a90e2] text-white shadow-lg" : "text-white/40 hover:text-white/60"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>3D View</span>
            </button>
          </div>

          {/* Upload & Reset */}
          <div className="flex items-center gap-2">
            <div {...getRootProps()} className="cursor-pointer">
              <input {...getInputProps()} />
              <button
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  isDragActive
                    ? "border-[#4a90e2] bg-[#4a90e2]/20 text-[#4a90e2]"
                    : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80"
                }`}
              >
                {isProcessing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                <span>{isProcessing ? "Analyzing..." : "Upload Plan"}</span>
              </button>
            </div>
            <button
              onClick={handleReset}
              className="p-1.5 rounded-lg border border-white/10 bg-white/5 text-white/40 hover:text-red-400 hover:border-red-400/30 transition-all"
              title="Clear All"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {/* Canvas Area */}
        <div className="flex-1 relative overflow-hidden">
          <AnimatePresence mode="wait">
            {view === "2d" ? (
              <motion.div
                key="2d"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full h-full"
              >
                {uploadedImageUrl && (analysis || isProcessing) ? (
                  <FloorplanAnalyzer
                    imgUrl={uploadedImageUrl}
                    analysis={analysis || { rooms: [], totalArea: 0, score: 0, summary: "", insights: [], flowIssues: [], recommendations: [] }}
                    isAnalyzing={isProcessing}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-white/30">
                    <div
                      {...getRootProps()}
                      className={`cursor-pointer rounded-2xl border-2 border-dashed p-12 transition-all max-w-md text-center ${
                        isDragActive
                          ? "border-[#4a90e2] bg-[#4a90e2]/10"
                          : "border-white/10 hover:border-white/20 hover:bg-white/5"
                      }`}
                    >
                      <input {...getInputProps()} />
                      <div className="p-4 rounded-full bg-white/5 inline-block mb-4">
                        <Upload className="w-8 h-8 text-white/30" />
                      </div>
                      <p className="text-sm font-medium text-white/60 mb-1">Upload a Floor Plan</p>
                      <p className="text-xs text-white/30">
                        Drag & drop or click to upload. AI will detect rooms, provide insights & recommendations.
                      </p>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="3d"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full h-full"
              >
                <SceneViewer3D ref={sceneRef} walls={walls} furniture={furniture} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Floating Controls for 3D */}
        {view === "3d" && (
          <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-40">
            <button
              onClick={async () => {
                if (!sceneRef.current) return;
                setIsExporting(true);
                try {
                  const blob = await sceneRef.current.exportGLB();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "archai-scene.glb";
                  a.click();
                  URL.revokeObjectURL(url);
                  toast({ title: "Exported", description: "GLB file downloaded." });
                } catch (err: any) {
                  toast({ title: "Export Failed", description: err?.message || "Unknown error", variant: "destructive" });
                } finally {
                  setIsExporting(false);
                }
              }}
              disabled={isExporting}
              className="p-3 bg-[#0d1225] border border-white/10 rounded-xl shadow-xl text-white/40 hover:text-[#4a90e2] transition-all hover:scale-105 disabled:opacity-50"
              title="Export as GLB"
            >
              {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default Studio3DEditor;
