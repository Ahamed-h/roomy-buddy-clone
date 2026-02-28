import { Upload, RotateCcw, Save, Loader2, Box, PenTool, MousePointer } from "lucide-react";
import type { EditMode } from "./types";

interface Props {
  selectedStyle: string;
  onStyleChange: (style: string) => void;
  onFileUpload: (file: File) => void;
  onReset: () => void;
  onSave: () => void;
  editMode: EditMode;
  onEditModeChange: (mode: EditMode) => void;
  isLoading: boolean;
}

const STYLES = [
  { value: "modern", label: "Modern" },
  { value: "scandinavian", label: "Scandinavian" },
  { value: "industrial", label: "Industrial" },
  { value: "minimalist", label: "Minimalist" },
  { value: "luxury", label: "Luxury" },
];

const TopControlsBar = ({
  selectedStyle,
  onStyleChange,
  onFileUpload,
  onReset,
  onSave,
  editMode,
  onEditModeChange,
  isLoading,
}: Props) => {
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileUpload(file);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-[#1e1e2e]/90 px-4 py-2.5 backdrop-blur-sm">
      {/* File upload */}
      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-[#0d1225] px-3 py-1.5 text-xs text-white/70 transition-all hover:border-[#4a90e2]/50 hover:text-white">
        <Upload className="h-3.5 w-3.5" />
        Upload Floorplan / PLY
        <input type="file" accept=".png,.jpg,.jpeg,.ply" className="hidden" onChange={handleFile} />
      </label>

      {/* Divider */}
      <div className="h-6 w-px bg-white/10" />

      {/* Edit mode toggles */}
      <div className="flex gap-1 rounded-lg bg-[#0d1225] p-0.5">
        {[
          { mode: "select" as EditMode, icon: <MousePointer className="h-3.5 w-3.5" />, label: "Select" },
          { mode: "wall" as EditMode, icon: <PenTool className="h-3.5 w-3.5" />, label: "Walls" },
          { mode: "furniture" as EditMode, icon: <Box className="h-3.5 w-3.5" />, label: "Furniture" },
        ].map(({ mode, icon, label }) => (
          <button
            key={mode}
            onClick={() => onEditModeChange(mode)}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-all ${
              editMode === mode
                ? "bg-[#4a90e2] text-white shadow-lg shadow-[#4a90e2]/20"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      <div className="h-6 w-px bg-white/10" />

      {/* Style dropdown */}
      <select
        value={selectedStyle}
        onChange={(e) => onStyleChange(e.target.value)}
        className="rounded-lg border border-white/10 bg-[#0d1225] px-3 py-1.5 text-xs text-white focus:border-[#4a90e2] focus:outline-none"
      >
        {STYLES.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Action buttons */}
      <button
        onClick={onReset}
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-white/60 transition-all hover:bg-white/5 hover:text-white"
      >
        <RotateCcw className="h-3.5 w-3.5" /> Reset
      </button>
      <button
        onClick={onSave}
        disabled={isLoading}
        className="flex items-center gap-1.5 rounded-lg bg-[#ff6b35] px-4 py-1.5 text-xs font-medium text-white shadow-lg shadow-[#ff6b35]/20 transition-all hover:bg-[#ff7b45] disabled:opacity-50"
      >
        {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        Save GLB
      </button>
    </div>
  );
};

export default TopControlsBar;
