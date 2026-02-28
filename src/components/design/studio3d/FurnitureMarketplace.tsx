import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Plus, Sofa, Lightbulb, Flower2, Wand2 } from "lucide-react";
import type { FurnitureItem, MarketplaceCategory } from "./types";

interface Props {
  items: FurnitureItem[];
  onAddToScene: (item: FurnitureItem) => void;
}

const TABS: { key: MarketplaceCategory; label: string; icon: React.ReactNode }[] = [
  { key: "furniture", label: "Furniture", icon: <Sofa className="h-3.5 w-3.5" /> },
  { key: "lighting", label: "Lighting", icon: <Lightbulb className="h-3.5 w-3.5" /> },
  { key: "decor", label: "Decor", icon: <Flower2 className="h-3.5 w-3.5" /> },
  { key: "generated", label: "Generated from 2D", icon: <Wand2 className="h-3.5 w-3.5" /> },
];

const FurnitureMarketplace = ({ items, onAddToScene }: Props) => {
  const [activeTab, setActiveTab] = useState<MarketplaceCategory>("furniture");
  const [search, setSearch] = useState("");

  const filtered = items.filter(
    (i) => i.category === activeTab && i.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Tabs + Search */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1 rounded-lg bg-[#0d1225] p-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                activeTab === tab.key
                  ? "bg-[#ff6b35] text-white shadow-lg shadow-[#ff6b35]/20"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items..."
            className="w-full rounded-lg border border-white/10 bg-[#0d1225] py-1.5 pl-8 pr-3 text-xs text-white placeholder:text-white/30 focus:border-[#4a90e2] focus:outline-none"
          />
        </div>
      </div>

      {/* Items grid */}
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
        {filtered.length === 0 && activeTab === "generated" ? (
          <div className="col-span-full flex flex-col items-center py-6 text-white/40">
            <Wand2 className="mb-2 h-8 w-8" />
            <p className="text-xs">Generate designs in the 2D tab first, then convert them here.</p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="col-span-full py-4 text-center text-xs text-white/40">No items found</p>
        ) : (
          filtered.map((item, idx) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              className="group relative flex flex-col items-center rounded-xl border border-white/10 bg-[#1e1e2e]/90 p-2.5 backdrop-blur-sm transition-all hover:border-[#4a90e2]/50 hover:shadow-lg hover:shadow-[#4a90e2]/10"
            >
              {/* 3D thumbnail placeholder */}
              <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-lg" style={{ backgroundColor: item.color + "33" }}>
                <div className="h-8 w-8 rounded" style={{ backgroundColor: item.color, opacity: 0.8 }} />
              </div>
              <p className="mb-1.5 text-center text-[10px] font-medium leading-tight text-white/80">{item.name}</p>
              <button
                onClick={() => onAddToScene(item)}
                className="flex w-full items-center justify-center gap-1 rounded-md bg-[#ff6b35]/10 py-1 text-[10px] font-medium text-[#ff6b35] transition-all hover:bg-[#ff6b35] hover:text-white"
              >
                <Plus className="h-3 w-3" /> Add
              </button>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export default FurnitureMarketplace;
