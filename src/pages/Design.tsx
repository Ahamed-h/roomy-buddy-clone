import { useState, useRef, useCallback, Suspense, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Environment, Html } from "@react-three/drei";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Save, Share2, Trash2, Undo2, Redo2, Camera, Download,
  Upload, Search, Box, Maximize2, Minimize2,
  MessageCircle, X, Send, ChevronUp, ChevronDown,
  Eye, Move3D, Hand, Ruler, Layers, Lock, Copy, ExternalLink,
  Sparkles, RotateCcw, Loader2, Paintbrush, CuboidIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import * as THREE from "three";
import type { AnalysisResult } from "@/services/api";
import { Design2DTab } from "@/components/design/Design2DTab";
import { BasicRoomViewer } from "@/components/design/BasicRoomViewer";

// Types
interface FurnitureItem {
  id: string;
  name: string;
  width: number;
  height: number;
  depth: number;
  color: string;
  material: string;
  position: [number, number, number];
  rotation: [number, number, number];
  imageUrl?: string;
  retailerUrl?: string;
  price?: string;
  retailer?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// 3D Furniture Box component
function FurnitureBox({
  item,
  selected,
  onClick,
}: {
  item: FurnitureItem;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <mesh
      position={item.position}
      rotation={item.rotation.map((r) => (r * Math.PI) / 180) as [number, number, number]}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <boxGeometry args={[item.width / 100, item.height / 100, item.depth / 100]} />
      <meshStandardMaterial color={item.color} transparent={selected} opacity={selected ? 0.85 : 1} />
      {selected && (
        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(item.width / 100, item.height / 100, item.depth / 100)]} />
          <lineBasicMaterial color="hsl(152,60%,50%)" linewidth={2} />
        </lineSegments>
      )}
      <Html position={[0, item.height / 200 + 0.15, 0]} center>
        <div className="whitespace-nowrap rounded bg-black/80 px-2 py-0.5 text-[10px] text-white">
          {item.name}
        </div>
      </Html>
    </mesh>
  );
}

function RoomFloor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[10, 10]} />
      <meshStandardMaterial color="hsl(220,15%,15%)" />
    </mesh>
  );
}

function Scene({
  furniture, selectedId, onSelect,
}: {
  furniture: FurnitureItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 8, 5]} intensity={0.8} castShadow />
      <pointLight position={[-3, 4, -3]} intensity={0.3} color="hsl(30,80%,70%)" />
      <RoomFloor />
      <Grid args={[10, 10]} position={[0, 0.001, 0]} cellSize={0.5} cellColor="hsl(220,15%,20%)" sectionSize={2} sectionColor="hsl(220,15%,25%)" fadeDistance={12} fadeStrength={1} />
      {furniture.map((item) => (
        <FurnitureBox key={item.id} item={item} selected={selectedId === item.id} onClick={() => onSelect(item.id)} />
      ))}
      <OrbitControls makeDefault />
      <Environment preset="apartment" />
    </>
  );
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/design-chat`;

const Design = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("2d");
  const [furniture, setFurniture] = useState<FurnitureItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Hi! I'm RoomBot 🤖 I can help you design your room. Upload a photo, add furniture, or ask me for layout advice." },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [rightTab, setRightTab] = useState("add");
  const [searchQuery, setSearchQuery] = useState("");
  const [roomContext, setRoomContext] = useState<AnalysisResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("aivo_analysis");
      if (stored) {
        const data = JSON.parse(stored) as AnalysisResult;
        setRoomContext(data);
        setChatMessages(prev => [...prev, {
          role: "assistant",
          content: `I loaded your room evaluation! Score: ${data.aesthetic_score.toFixed(1)}/10, style: ${data.top_styles?.[0]?.style || "mixed"}. I'll use this for personalized advice.`
        }]);
      }
    } catch { /* ignore */ }
  }, []);

  const selectedItem = furniture.find((f) => f.id === selectedId);

  const addFurniture = (item: Partial<FurnitureItem>) => {
    const newItem: FurnitureItem = {
      id: crypto.randomUUID(),
      name: item.name || "Furniture",
      width: item.width || 80,
      height: item.height || 80,
      depth: item.depth || 80,
      color: item.color || "#8B7355",
      material: item.material || "wood",
      position: [0, (item.height || 80) / 200, 0],
      rotation: [0, 0, 0],
      ...item,
    };
    setFurniture((prev) => [...prev, newItem]);
    setSelectedId(newItem.id);
    toast({ title: `Added ${newItem.name}` });
  };

  const deleteFurniture = (id: string) => {
    setFurniture((prev) => prev.filter((f) => f.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const duplicateFurniture = (id: string) => {
    const item = furniture.find((f) => f.id === id);
    if (!item) return;
    addFurniture({
      ...item,
      id: undefined,
      name: `${item.name} (copy)`,
      position: [item.position[0] + 0.5, item.position[1], item.position[2] + 0.5],
    });
  };

  const parseFurnitureFromResponse = (text: string) => {
    const match = text.match(/```furniture\s*\n([\s\S]*?)```/);
    if (match) {
      try { addFurniture(JSON.parse(match[1])); } catch { /* ignore */ }
    }
  };

  const handleChatSend = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg: ChatMessage = { role: "user", content: chatInput };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setChatInput("");
    setChatLoading(true);

    let assistantSoFar = "";
    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          roomContext: roomContext || undefined,
        }),
      });

      if (!resp.ok || !resp.body) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              setChatMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && prev.length === newMessages.length + 1) {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                }
                return [...prev, { role: "assistant", content: assistantSoFar }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
      parseFurnitureFromResponse(assistantSoFar);
    } catch (e: any) {
      console.error("Chat error:", e);
      setChatMessages(prev => [...prev, {
        role: "assistant",
        content: `Sorry, I couldn't connect. ${e.message || "Please try again."}`
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  const presetFurniture = [
    { name: "Sofa", width: 200, height: 85, depth: 90, color: "#6B7B8D", material: "fabric" },
    { name: "Armchair", width: 80, height: 85, depth: 80, color: "#8B6914", material: "fabric" },
    { name: "Coffee Table", width: 120, height: 45, depth: 60, color: "#8B6914", material: "wood" },
    { name: "Dining Table", width: 160, height: 75, depth: 90, color: "#654321", material: "wood" },
    { name: "Bed (Queen)", width: 160, height: 50, depth: 200, color: "#F5F5DC", material: "fabric" },
    { name: "Bookshelf", width: 80, height: 180, depth: 30, color: "#8B4513", material: "wood" },
    { name: "Floor Lamp", width: 30, height: 160, depth: 30, color: "#C0C0C0", material: "metal" },
    { name: "Rug", width: 200, height: 2, depth: 300, color: "#BC8F8F", material: "fabric" },
    { name: "Cabinet", width: 100, height: 90, depth: 45, color: "#DEB887", material: "wood" },
    { name: "Side Table", width: 45, height: 55, depth: 45, color: "#D2691E", material: "wood" },
  ];

  const marketplaceCategories = ["Sofa", "Chair", "Table", "Bed", "Lamp", "Rug", "Cabinet", "Decor"];

  return (
    <div className="flex h-screen flex-col bg-studio-bg text-studio-text studio-theme">
      {/* Top Toolbar */}
      <div className="flex h-12 items-center justify-between border-b border-studio-border bg-studio-surface px-3">
        <div className="flex items-center gap-1">
          <a href="/" className="mr-3 flex items-center gap-1.5 font-display text-sm font-bold">
            <Box className="h-4 w-4 text-studio-accent" />
            <span>aivo</span>
          </a>
          {activeTab === "3d" && (
            <>
              <Button variant="ghost" size="sm" className="h-8 text-xs text-studio-text-muted hover:text-studio-text">
                <Plus className="mr-1 h-3 w-3" /> New
              </Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs text-studio-text-muted hover:text-studio-text">
                <Save className="mr-1 h-3 w-3" /> Save
              </Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs text-studio-text-muted hover:text-studio-text">
                <Share2 className="mr-1 h-3 w-3" /> Share
              </Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs text-studio-text-muted hover:text-studio-text" onClick={() => { setFurniture([]); setSelectedId(null); }}>
                <Trash2 className="mr-1 h-3 w-3" /> Clear
              </Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs text-studio-text-muted hover:text-studio-text">
                <Undo2 className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs text-studio-text-muted hover:text-studio-text">
                <Redo2 className="h-3 w-3" />
              </Button>
            </>
          )}
        </div>

        {/* Center: Main tab switcher */}
        <div className="flex items-center gap-1 rounded-lg bg-studio-bg p-1">
          <button
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              activeTab === "2d" ? "bg-studio-accent text-white" : "text-studio-text-muted hover:text-studio-text"
            )}
            onClick={() => setActiveTab("2d")}
          >
            <Paintbrush className="h-3.5 w-3.5" /> 2D Design Generation
          </button>
          <button
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              activeTab === "3d" ? "bg-studio-accent text-white" : "text-studio-text-muted hover:text-studio-text"
            )}
            onClick={() => setActiveTab("3d")}
          >
            <CuboidIcon className="h-3.5 w-3.5" /> 3D Design
            <Badge variant="outline" className="ml-1 border-studio-border text-[9px] px-1 py-0">Soon</Badge>
          </button>
        </div>

        <div className="flex items-center gap-1">
          {activeTab === "3d" && (
            <>
              <Button size="sm" className="h-8 bg-studio-accent text-xs font-medium hover:bg-studio-accent/90">
                <Sparkles className="mr-1 h-3 w-3" /> Render
              </Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs text-studio-text-muted hover:text-studio-text">
                <Download className="mr-1 h-3 w-3" /> Export
              </Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs text-studio-text-muted hover:text-studio-text">
                <Camera className="mr-1 h-3 w-3" /> Capture
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 2D Tab Content */}
      {activeTab === "2d" && (
        <div className="flex-1 overflow-auto bg-background text-foreground">
          <Design2DTab />
        </div>
      )}

      {/* 3D Tab Content */}
      {activeTab === "3d" && (
        <>
          <div className="flex flex-1 overflow-hidden">
            {/* Left Sidebar */}
            <div className="flex w-56 flex-col border-r border-studio-border bg-studio-surface">
              <ScrollArea className="flex-1 studio-scrollbar">
                <div className="p-3 space-y-4">
                  <div>
                    <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-studio-text-muted">View</h4>
                    <div className="flex gap-1">
                      {["3D", "2D", "Walk"].map((mode) => (
                        <Button key={mode} variant="ghost" size="sm" className={cn("h-7 flex-1 text-[11px]", mode === "3D" && "bg-studio-accent/20 text-studio-accent")}>
                          {mode}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-studio-text-muted">Camera</h4>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { icon: Move3D, label: "Orbit" },
                        { icon: Hand, label: "Pan" },
                        { icon: Eye, label: "X-Ray" },
                        { icon: Ruler, label: "Dims" },
                        { icon: Layers, label: "Layer" },
                        { icon: RotateCcw, label: "Reset" },
                      ].map(({ icon: Icon, label }) => (
                        <Button key={label} variant="ghost" size="sm" className="h-8 flex-col gap-0.5 text-[9px] text-studio-text-muted hover:text-studio-text">
                          <Icon className="h-3.5 w-3.5" />
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {selectedItem && (
                    <div>
                      <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-studio-text-muted">Selected</h4>
                      <div className="rounded-lg border border-studio-border bg-studio-bg p-3 space-y-2">
                        <p className="text-sm font-medium">{selectedItem.name}</p>
                        <div className="space-y-1 text-[11px] text-studio-text-muted">
                          <p>{selectedItem.width}×{selectedItem.height}×{selectedItem.depth} cm</p>
                          <p className="capitalize">{selectedItem.material}</p>
                          {selectedItem.price && <p className="text-studio-accent font-medium">{selectedItem.price}</p>}
                          {selectedItem.retailer && <p>{selectedItem.retailer}</p>}
                        </div>
                        <div className="flex gap-1 pt-1">
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => duplicateFurniture(selectedItem.id)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => deleteFurniture(selectedItem.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            <Lock className="h-3 w-3" />
                          </Button>
                          {selectedItem.retailerUrl && (
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" asChild>
                              <a href={selectedItem.retailerUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-studio-text-muted">Room</h4>
                    <div className="space-y-2">
                      {["Floor", "Walls", "Doors"].map((surface) => (
                        <div key={surface} className="flex items-center justify-between">
                          <span className="text-[11px]">{surface}</span>
                          <input type="color" defaultValue="#2a2a3a" className="h-5 w-5 cursor-pointer rounded border-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </div>

            {/* Center Canvas */}
            <div className="relative flex-1">
              <Canvas shadows camera={{ position: [5, 5, 5], fov: 50 }}>
                <Suspense fallback={null}>
                  <Scene furniture={furniture} selectedId={selectedId} onSelect={setSelectedId} />
                </Suspense>
              </Canvas>
              <button
                className="absolute right-3 top-3 rounded-lg bg-studio-surface/80 p-2 text-studio-text-muted backdrop-blur hover:text-studio-text"
                onClick={() => setFullscreen(!fullscreen)}
              >
                {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
              <div className="absolute left-3 top-3 rounded-lg bg-studio-surface/80 px-3 py-1.5 text-[11px] text-studio-text-muted backdrop-blur">
                {furniture.length} objects
              </div>
            </div>

            {/* Right Sidebar */}
            <div className="flex w-72 flex-col border-l border-studio-border bg-studio-surface">
              <Tabs value={rightTab} onValueChange={setRightTab} className="flex flex-1 flex-col">
                <TabsList className="mx-2 mt-2 grid grid-cols-3 bg-studio-bg">
                  <TabsTrigger value="add" className="text-[11px]">Add</TabsTrigger>
                  <TabsTrigger value="market" className="text-[11px]">Market</TabsTrigger>
                  <TabsTrigger value="room" className="text-[11px]">My Room</TabsTrigger>
                </TabsList>

                <TabsContent value="add" className="flex-1 overflow-hidden">
                  <ScrollArea className="h-full studio-scrollbar">
                    <div className="p-3 space-y-3">
                      <div
                        className="flex flex-col items-center rounded-lg border-2 border-dashed border-studio-border p-6 text-center cursor-pointer hover:border-studio-accent/40 transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="mb-2 h-8 w-8 text-studio-text-muted" />
                        <p className="text-xs font-medium">Upload Furniture Photo</p>
                        <p className="mt-1 text-[10px] text-studio-text-muted">Snap a photo → AI creates 3D model</p>
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={() => {
                          toast({ title: "Photo-to-3D", description: "Connect backend to enable AI furniture extraction." });
                        }} />
                      </div>
                      <h4 className="text-[10px] font-semibold uppercase tracking-wider text-studio-text-muted">Quick Add</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {presetFurniture.map((item) => (
                          <button
                            key={item.name}
                            className="rounded-lg border border-studio-border bg-studio-bg p-3 text-left transition-colors hover:border-studio-accent/40"
                            onClick={() => addFurniture(item)}
                          >
                            <div className="mb-1 h-8 w-8 rounded" style={{ backgroundColor: item.color }} />
                            <p className="text-[11px] font-medium">{item.name}</p>
                            <p className="text-[9px] text-studio-text-muted capitalize">{item.material}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="market" className="flex-1 overflow-hidden">
                  <ScrollArea className="h-full studio-scrollbar">
                    <div className="p-3 space-y-3">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-studio-text-muted" />
                        <Input
                          placeholder="Search furniture from any store..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="h-8 border-studio-border bg-studio-bg pl-8 text-xs text-studio-text placeholder:text-studio-text-muted"
                        />
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {marketplaceCategories.map((cat) => (
                          <Badge key={cat} variant="outline" className="cursor-pointer border-studio-border text-[10px] text-studio-text-muted hover:border-studio-accent hover:text-studio-accent">
                            {cat}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-center text-[10px] text-studio-text-muted">Every store, zero markup</p>
                      <div className="space-y-2">
                        {[
                          { name: "Modern Velvet Sofa", price: "$899", retailer: "Wayfair", color: "#4A6741" },
                          { name: "Oak Coffee Table", price: "$349", retailer: "IKEA", color: "#C4A265" },
                          { name: "Arc Floor Lamp", price: "$199", retailer: "CB2", color: "#B8B8B8" },
                          { name: "Wool Area Rug", price: "$449", retailer: "West Elm", color: "#D4C5B2" },
                        ].map((item) => (
                          <div key={item.name} className="rounded-lg border border-studio-border bg-studio-bg p-3">
                            <div className="mb-2 h-20 rounded" style={{ backgroundColor: item.color }} />
                            <p className="text-xs font-medium">{item.name}</p>
                            <div className="mt-1 flex items-center justify-between">
                              <span className="text-[11px] text-studio-accent font-medium">{item.price}</span>
                              <span className="text-[10px] text-studio-text-muted">{item.retailer}</span>
                            </div>
                            <div className="mt-2 flex gap-1">
                              <Button size="sm" className="h-6 flex-1 bg-studio-accent text-[10px] hover:bg-studio-accent/90" onClick={() => {
                                addFurniture({ name: item.name, price: item.price, retailer: item.retailer, color: item.color, width: 120, height: 60, depth: 80 });
                              }}>
                                Add to Room
                              </Button>
                              <Button variant="ghost" size="sm" className="h-6 text-[10px] text-studio-text-muted">
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="room" className="flex-1 overflow-hidden">
                  <ScrollArea className="h-full studio-scrollbar">
                    <div className="p-3 space-y-2">
                      {furniture.length === 0 ? (
                        <div className="py-8 text-center text-xs text-studio-text-muted">
                          No objects yet. Add furniture to get started.
                        </div>
                      ) : (
                        <>
                          {furniture.map((item) => (
                            <div
                              key={item.id}
                              className={cn(
                                "flex items-center gap-3 rounded-lg border border-studio-border bg-studio-bg p-2.5 cursor-pointer transition-colors",
                                selectedId === item.id && "border-studio-accent/50 bg-studio-accent/5"
                              )}
                              onClick={() => setSelectedId(item.id)}
                            >
                              <div className="h-8 w-8 shrink-0 rounded" style={{ backgroundColor: item.color }} />
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-medium truncate">{item.name}</p>
                                <p className="text-[9px] text-studio-text-muted capitalize">{item.material} · {item.width}×{item.depth}cm</p>
                              </div>
                              <div className="flex gap-0.5">
                                <button className="p-1 text-studio-text-muted hover:text-studio-text" onClick={(e) => { e.stopPropagation(); duplicateFurniture(item.id); }}>
                                  <Copy className="h-3 w-3" />
                                </button>
                                <button className="p-1 text-studio-text-muted hover:text-destructive" onClick={(e) => { e.stopPropagation(); deleteFurniture(item.id); }}>
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                          {furniture.some((f) => f.price) && (
                            <div className="mt-4 rounded-lg border border-studio-accent/20 bg-studio-accent/5 p-3 text-center">
                              <p className="text-[10px] text-studio-text-muted">Estimated Total</p>
                              <p className="font-display text-lg font-bold text-studio-accent">
                                ${furniture.reduce((sum, f) => sum + (f.price ? parseInt(f.price.replace(/\D/g, "")) : 0), 0).toLocaleString()}
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </div>
          </div>

          {/* Bottom Chat Bar (RoomBot) */}
          <div className={cn(
            "border-t border-studio-border bg-studio-surface transition-all",
            chatOpen ? "h-72" : "h-12"
          )}>
            <div
              className="flex h-12 cursor-pointer items-center justify-between px-4"
              onClick={() => setChatOpen(!chatOpen)}
            >
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-studio-accent" />
                <span className="text-xs font-medium">RoomBot</span>
                <span className="text-[10px] text-studio-text-muted">— Ask anything about your design...</span>
              </div>
              {chatOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </div>
            {chatOpen && (
              <div className="flex h-60 flex-col">
                <ScrollArea className="flex-1 px-4 studio-scrollbar">
                  <div className="space-y-3 py-2">
                    {chatMessages.map((msg, i) => (
                      <div key={i} className={cn("max-w-[85%] rounded-lg px-3 py-2 text-xs", msg.role === "user" ? "ml-auto bg-studio-accent text-white" : "bg-studio-bg text-studio-text")}>
                        {msg.content}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <div className="flex gap-2 border-t border-studio-border p-3">
                  <Input
                    placeholder="Ask RoomBot anything..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleChatSend()}
                    className="h-8 border-studio-border bg-studio-bg text-xs text-studio-text placeholder:text-studio-text-muted"
                  />
                  <Button size="sm" className="h-8 bg-studio-accent hover:bg-studio-accent/90" onClick={handleChatSend} disabled={chatLoading}>
                    {chatLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Design;
