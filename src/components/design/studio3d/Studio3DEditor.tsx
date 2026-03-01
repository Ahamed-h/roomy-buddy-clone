import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, ScanEye } from "lucide-react";
import TopControlsBar from "./TopControlsBar";
import FloorplanEditor from "./FloorplanEditor";
import SceneViewer3D from "./SceneViewer3D";
import FurnitureMarketplace from "./FurnitureMarketplace";
import MidasReconstruction from "./MidasReconstruction";
import { MOCK_ROOMS, MOCK_WALLS, MOCK_FURNITURE } from "./mockData";
import type { Room, Wall, PlacedFurniture, FurnitureItem, EditMode } from "./types";
import { useToast } from "@/hooks/use-toast";
import { getHfSpacesUrl } from "@/services/api";

const Studio3DEditor = () => {
  const { toast } = useToast();
  const API = getHfSpacesUrl();

  // Scene state
  const [rooms, setRooms] = useState<Room[]>(MOCK_ROOMS);
  const [walls, setWalls] = useState<Wall[]>(MOCK_WALLS);
  const [placedFurniture, setPlacedFurniture] = useState<PlacedFurniture[]>([]);
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState("modern");
  const [editMode, setEditMode] = useState<EditMode>("select");
  const [isLoading, setIsLoading] = useState(false);
  const [marketplaceOpen, setMarketplaceOpen] = useState(true);

  const handleFileUpload = useCallback(async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "ply") {
      toast({ title: "PLY Upload", description: "Point cloud loading will be available when the backend is connected." });
    } else {
      toast({ title: "Floorplan Uploaded", description: "Parsing floorplan... (backend required for wall detection)" });
      // Future: POST /design/3d/parse_floorplan
    }
  }, [toast]);

  const handleReset = useCallback(() => {
    setRooms(MOCK_ROOMS);
    setWalls(MOCK_WALLS);
    setPlacedFurniture([]);
    setSelectedFurnitureId(null);
    toast({ title: "Scene Reset", description: "All changes cleared." });
  }, [toast]);

  const handleSave = useCallback(async () => {
    setIsLoading(true);
    try {
      // Future: POST /design/3d/export_glb
      await new Promise((r) => setTimeout(r, 1500));
      toast({ title: "Scene Saved", description: "GLB export will be available when the backend is connected." });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const handleAddToScene = useCallback((item: FurnitureItem) => {
    const placed: PlacedFurniture = {
      id: `placed-${Date.now()}`,
      itemId: item.id,
      name: item.name,
      position: [0, item.dimensions[1] / 2, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      dimensions: item.dimensions,
      color: item.color,
    };
    setPlacedFurniture((prev) => [...prev, placed]);
    setSelectedFurnitureId(placed.id);
    toast({ title: `Added ${item.name}`, description: "Click to select and drag to reposition." });
  }, [toast]);

  const handleUpdateFurniture = useCallback((id: string, position: [number, number, number]) => {
    setPlacedFurniture((prev) =>
      prev.map((f) => (f.id === id ? { ...f, position } : f))
    );
  }, []);

  return (
    <div className="flex flex-col gap-3" style={{ background: "linear-gradient(180deg, #0a0f2a 0%, #1a1f3a 100%)", margin: "-1.5rem", padding: "1.5rem", borderRadius: "var(--radius)" }}>
      {/* Top Controls */}
      <TopControlsBar
        selectedStyle={selectedStyle}
        onStyleChange={setSelectedStyle}
        onFileUpload={handleFileUpload}
        onReset={handleReset}
        onSave={handleSave}
        editMode={editMode}
        onEditModeChange={setEditMode}
        isLoading={isLoading}
      />

      {/* Dual Canvas */}
      <div className="grid gap-3 lg:grid-cols-5" style={{ minHeight: 420 }}>
        {/* 2D Floorplan - 40% */}
        <div className="lg:col-span-2 flex flex-col rounded-xl border border-white/10 bg-[#1e1e2e]/90 backdrop-blur-sm overflow-hidden">
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2">
            <div className="h-2 w-2 rounded-full bg-[#4a90e2]" />
            <span className="text-xs font-medium text-white/70">2D Floorplan</span>
            <span className="ml-auto text-[10px] text-white/30">{rooms.length} rooms • {walls.length} walls</span>
          </div>
          <div className="flex-1 overflow-auto p-2">
            <FloorplanEditor
              rooms={rooms}
              walls={walls}
              editMode={editMode}
              onRoomsChange={setRooms}
              onWallsChange={setWalls}
            />
          </div>
        </div>

        {/* 3D Viewer - 60% */}
        <div className="lg:col-span-3 flex flex-col rounded-xl border border-white/10 bg-[#0d1225]/90 backdrop-blur-sm overflow-hidden">
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2">
            <div className="h-2 w-2 rounded-full bg-[#ff6b35]" />
            <span className="text-xs font-medium text-white/70">3D Scene</span>
            <span className="ml-auto text-[10px] text-white/30">{placedFurniture.length} items placed</span>
          </div>
          <div className="flex-1">
            <SceneViewer3D
              rooms={rooms}
              furniture={placedFurniture}
              selectedId={selectedFurnitureId}
              onSelectFurniture={setSelectedFurnitureId}
              onUpdateFurniture={handleUpdateFurniture}
            />
          </div>
        </div>
      </div>

      {/* MiDaS 3D Reconstruction */}
      <div className="rounded-xl border border-white/10 bg-[#1e1e2e]/90 backdrop-blur-sm overflow-hidden">
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
          <ScanEye className="h-4 w-4 text-[#4a90e2]" />
          <span className="text-xs font-medium text-white/70">MiDaS 3D Reconstruction</span>
          <span className="ml-1 rounded bg-[#4a90e2]/15 px-1.5 py-0.5 text-[10px] font-medium text-[#4a90e2]">Depth → Point Cloud</span>
        </div>
        <div className="p-4">
          <MidasReconstruction />
        </div>
      </div>

      {/* Marketplace */}
      <div className="rounded-xl border border-white/10 bg-[#1e1e2e]/90 backdrop-blur-sm overflow-hidden">
        <button
          onClick={() => setMarketplaceOpen(!marketplaceOpen)}
          className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-white/5"
        >
          <div className="h-2 w-2 rounded-full bg-[#ff6b35]" />
          <span className="text-xs font-medium text-white/70">Marketplace</span>
          <span className="ml-auto text-white/40">
            {marketplaceOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </span>
        </button>
        <AnimatePresence>
          {marketplaceOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="border-t border-white/10 p-4">
                <FurnitureMarketplace items={MOCK_FURNITURE} onAddToScene={handleAddToScene} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Studio3DEditor;
