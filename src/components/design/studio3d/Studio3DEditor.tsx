import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import {
  Box,
  Layers,
  Upload,
  Trash2,
  Plus,
  Eye,
  Loader2,
  ChevronRight,
  ChevronLeft,
  ScanEye,
  RotateCcw,
} from "lucide-react";
import FloorplanEditor from "./FloorplanEditor";
import SceneViewer3D from "./SceneViewer3D";
import MidasReconstruction from "./MidasReconstruction";
import { MOCK_WALLS, MOCK_FURNITURE_ITEMS, getSampleData, FURNITURE_LIBRARY } from "./mockData";
import type { Wall, Furniture } from "./types";
import { useToast } from "@/hooks/use-toast";

const Studio3DEditor = () => {
  const { toast } = useToast();

  const [view, setView] = useState<"2d" | "3d">("2d");
  const [walls, setWalls] = useState<Wall[]>(MOCK_WALLS);
  const [furniture, setFurniture] = useState<Furniture[]>(MOCK_FURNITURE_ITEMS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const loadSample = () => {
    const data = getSampleData();
    setWalls(data.walls);
    setFurniture(data.furniture);
    setSelectedId(null);
    toast({ title: "Sample Loaded", description: "Loaded sample floorplan with furniture." });
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;
      setIsProcessing(true);
      // For now, load sample data as placeholder for AI analysis
      await new Promise((r) => setTimeout(r, 1500));
      const data = getSampleData();
      setWalls(data.walls);
      setFurniture(data.furniture);
      setIsProcessing(false);
      toast({ title: "Floorplan Analyzed", description: "Loaded detected walls and furniture (demo mode)." });
    },
    [toast]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    multiple: false,
  });

  const addWall = () => {
    const newWall: Wall = {
      id: `w-${Date.now()}`,
      start: { x: 2, y: 2 },
      end: { x: 5, y: 2 },
      thickness: 0.15,
    };
    setWalls([...walls, newWall]);
    setSelectedId(newWall.id);
  };

  const addFurnitureItem = (lib: typeof FURNITURE_LIBRARY[0]) => {
    const newItem: Furniture = {
      id: `f-${Date.now()}`,
      type: lib.type,
      label: lib.name,
      position: { x: 5, y: 5 },
      rotation: 0,
      width: lib.w,
      depth: lib.d,
      height: lib.h,
    };
    setFurniture([...furniture, newItem]);
    setSelectedId(newItem.id);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setWalls(walls.filter((w) => w.id !== selectedId));
    setFurniture(furniture.filter((f) => f.id !== selectedId));
    setSelectedId(null);
  };

  const handleReset = () => {
    setWalls([]);
    setFurniture([]);
    setSelectedId(null);
    toast({ title: "Scene Cleared" });
  };

  const selectedFurniture = furniture.find((f) => f.id === selectedId);
  const selectedWall = walls.find((w) => w.id === selectedId);

  const updateSelectedFurniture = (updates: Partial<Furniture>) => {
    setFurniture(furniture.map((f) => (f.id === selectedId ? { ...f, ...updates } : f)));
  };

  const updateSelectedWall = (updates: Partial<Wall>) => {
    setWalls(walls.map((w) => (w.id === selectedId ? { ...w, ...updates } : w)));
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
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 300 : 0 }}
        className="relative flex flex-col border-r border-white/10 bg-[#0d1225]/80 backdrop-blur-xl overflow-hidden shrink-0"
      >
        <div className={`flex flex-col h-full p-5 space-y-6 overflow-y-auto ${!sidebarOpen ? "hidden" : ""}`}>
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-[#4a90e2] rounded-lg">
              <Box className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-base font-bold text-white tracking-tight">ArchAI Studio</h2>
          </div>

          {/* Upload Section */}
          <div className="space-y-2">
            <div
              {...getRootProps()}
              className={`relative group cursor-pointer rounded-xl border-2 border-dashed p-6 transition-all ${
                isDragActive
                  ? "border-[#4a90e2] bg-[#4a90e2]/10"
                  : "border-white/10 hover:border-white/20 hover:bg-white/5"
              }`}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="p-2.5 rounded-full bg-white/5 group-hover:bg-white/10 transition-colors">
                  <Upload className="w-5 h-5 text-white/40" />
                </div>
                <div>
                  <p className="text-xs font-medium text-white/70">Upload Floorplan</p>
                  <p className="text-[10px] text-white/30 mt-0.5">Drag & drop or click to scan</p>
                </div>
              </div>
              {isProcessing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0d1225]/90 rounded-xl backdrop-blur-sm">
                  <Loader2 className="w-6 h-6 text-[#4a90e2] animate-spin mb-1" />
                  <p className="text-[10px] font-medium text-white/60">AI Analyzing...</p>
                </div>
              )}
            </div>

            <button
              onClick={loadSample}
              className="w-full py-2 px-3 rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-white/60 hover:bg-white/10 hover:text-white/80 transition-colors"
            >
              Load Sample Data
            </button>
          </div>

          {/* Furniture Library */}
          <div className="space-y-3">
            <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Furniture Library</p>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={addWall}
                className="flex items-center space-x-1.5 p-2.5 rounded-lg bg-[#4a90e2]/10 border border-[#4a90e2]/20 hover:bg-[#4a90e2]/20 transition-all text-xs text-[#4a90e2]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Wall</span>
              </button>
              {FURNITURE_LIBRARY.map((lib) => (
                <button
                  key={lib.type}
                  onClick={() => addFurnitureItem(lib)}
                  className="flex items-center space-x-1.5 p-2.5 rounded-lg bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white/10 transition-all text-xs text-white/60"
                >
                  <Box className="w-3.5 h-3.5 text-white/30" />
                  <span>{lib.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Properties Panel */}
          {(selectedFurniture || selectedWall) && (
            <div className="space-y-3">
              <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Properties</p>
              <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-3">
                {selectedFurniture && (
                  <>
                    <div className="space-y-1">
                      <label className="text-[10px] text-white/30">Label</label>
                      <input
                        type="text"
                        value={selectedFurniture.label}
                        onChange={(e) => updateSelectedFurniture({ label: e.target.value })}
                        className="w-full bg-[#0d1225] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white/80 focus:outline-none focus:border-[#4a90e2]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: "Width (m)", key: "width", val: selectedFurniture.width },
                        { label: "Depth (m)", key: "depth", val: selectedFurniture.depth },
                        { label: "Height (m)", key: "height", val: selectedFurniture.height },
                        { label: "Rotation (°)", key: "rotation", val: selectedFurniture.rotation },
                      ].map((field) => (
                        <div key={field.key} className="space-y-1">
                          <label className="text-[10px] text-white/30">{field.label}</label>
                          <input
                            type="number"
                            step={field.key === "rotation" ? "1" : "0.1"}
                            value={field.val}
                            onChange={(e) =>
                              updateSelectedFurniture({ [field.key]: parseFloat(e.target.value) })
                            }
                            className="w-full bg-[#0d1225] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white/80 focus:outline-none focus:border-[#4a90e2]"
                          />
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {selectedWall && (
                  <div className="space-y-1">
                    <label className="text-[10px] text-white/30">Thickness (m)</label>
                    <input
                      type="number"
                      step="0.05"
                      value={selectedWall.thickness}
                      onChange={(e) =>
                        updateSelectedWall({ thickness: parseFloat(e.target.value) })
                      }
                      className="w-full bg-[#0d1225] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white/80 focus:outline-none focus:border-[#4a90e2]"
                    />
                  </div>
                )}
                <button
                  onClick={deleteSelected}
                  className="w-full flex items-center justify-center space-x-1.5 p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Item</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute -right-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-[#1e1e2e] border border-white/10 rounded-full text-white/40 hover:text-white transition-colors z-50"
        >
          {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </motion.aside>

      {/* Main Content */}
      <main className="relative flex-1 flex flex-col overflow-hidden">
        {/* 2D / 3D Toggle */}
        <header className="absolute top-4 left-1/2 -translate-x-1/2 z-40 flex items-center p-1 bg-[#0d1225]/80 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl">
          <button
            onClick={() => setView("2d")}
            className={`flex items-center space-x-1.5 px-5 py-1.5 rounded-full text-xs font-medium transition-all ${
              view === "2d"
                ? "bg-[#4a90e2] text-white shadow-lg"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>2D Editor</span>
          </button>
          <button
            onClick={() => setView("3d")}
            className={`flex items-center space-x-1.5 px-5 py-1.5 rounded-full text-xs font-medium transition-all ${
              view === "3d"
                ? "bg-[#4a90e2] text-white shadow-lg"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>3D View</span>
          </button>
        </header>

        {/* Canvas Area */}
        <div className="flex-1 relative">
          <AnimatePresence mode="wait">
            {view === "2d" ? (
              <motion.div
                key="2d"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full h-full"
              >
                <FloorplanEditor
                  walls={walls}
                  furniture={furniture}
                  onUpdateWalls={setWalls}
                  onUpdateFurniture={setFurniture}
                  onSelectItem={setSelectedId}
                  selectedId={selectedId}
                />
              </motion.div>
            ) : (
              <motion.div
                key="3d"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full h-full"
              >
                <SceneViewer3D walls={walls} furniture={furniture} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Floating Controls */}
        <div className="absolute bottom-6 right-6 flex flex-col space-y-2 z-40">
          <button
            onClick={handleReset}
            className="p-3 bg-[#0d1225] border border-white/10 rounded-xl shadow-xl text-white/40 hover:text-red-400 transition-all hover:scale-105"
            title="Clear All"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
      </main>
    </div>
  );
};

export default Studio3DEditor;
