import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import type { AnalyzedRoom, FloorplanAnalysis, Recommendation } from "./types";
import { supabase } from "@/integrations/supabase/client";
import { isOllamaAvailable, ollamaChat } from "@/services/ollama";
import { directChat, hasDirectKeys } from "@/services/directAI";

/* ═══════════════════════════════════════════════════════════════
   ROOM COLORS
═══════════════════════════════════════════════════════════════ */
const ROOM_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  "Living Room": { bg: "#DBEAFE", border: "#3B82F6", text: "#1D4ED8", dot: "#3B82F6" },
  "Bedroom":     { bg: "#FEF3C7", border: "#F59E0B", text: "#92400E", dot: "#F59E0B" },
  "Kitchen":     { bg: "#D1FAE5", border: "#10B981", text: "#065F46", dot: "#10B981" },
  "Bathroom":    { bg: "#EDE9FE", border: "#8B5CF6", text: "#4C1D95", dot: "#8B5CF6" },
  "Dining Room": { bg: "#FEE2E2", border: "#EF4444", text: "#7F1D1D", dot: "#EF4444" },
  "Office":      { bg: "#CFFAFE", border: "#06B6D4", text: "#164E63", dot: "#06B6D4" },
  "Hallway":     { bg: "#F1F5F9", border: "#94A3B8", text: "#334155", dot: "#94A3B8" },
  "Garage":      { bg: "#FEF9C3", border: "#CA8A04", text: "#713F12", dot: "#CA8A04" },
  "Laundry":     { bg: "#E0F2FE", border: "#0284C7", text: "#0C4A6E", dot: "#0284C7" },
  "Storage":     { bg: "#F0FDF4", border: "#16A34A", text: "#14532D", dot: "#16A34A" },
  "Balcony":     { bg: "#FDF4FF", border: "#A855F7", text: "#581C87", dot: "#A855F7" },
  "Unknown":     { bg: "#F8FAFC", border: "#CBD5E1", text: "#475569", dot: "#CBD5E1" },
};

const ROOM_TYPES = Object.keys(ROOM_COLORS);

const getColor = (type: string) => ROOM_COLORS[type] || ROOM_COLORS.Unknown;

/* ═══════════════════════════════════════════════════════════════
   CANVAS — SVG room overlay on top of floor plan image
═══════════════════════════════════════════════════════════════ */
interface CanvasProps {
  imgUrl: string;
  rooms: AnalyzedRoom[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, patch: Partial<AnalyzedRoom>) => void;
  dims: { w: number; h: number };
  readOnly?: boolean;
  label?: string;
}

function Canvas({ imgUrl, rooms, selectedId, onSelect, onUpdate, dims, readOnly = false, label }: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; ox: number; oy: number } | null>(null);
  const resizeRef = useRef<{ id: string; sx: number; sy: number; origPx: { x: number; y: number; w: number; h: number } } | null>(null);

  const dimsRef = useRef(dims);
  dimsRef.current = dims;

  const toPx = useCallback((r: AnalyzedRoom) => {
    const { w, h } = dimsRef.current;
    return {
      x: (r.x / 100) * w,
      y: (r.y / 100) * h,
      w: (r.width / 100) * w,
      h: (r.height / 100) * h,
    };
  }, []);

  const evXY = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const touch = "touches" in e ? e.touches[0] : null;
    const cx = touch ? touch.clientX : (e as React.MouseEvent).clientX;
    const cy = touch ? touch.clientY : (e as React.MouseEvent).clientY;
    const { w, h } = dimsRef.current;
    return {
      x: ((cx - rect.left) / rect.width) * w,
      y: ((cy - rect.top) / rect.height) * h,
    };
  }, []);

  const roomsRef = useRef(rooms);
  roomsRef.current = rooms;

  const startDrag = useCallback((e: React.MouseEvent | React.TouchEvent, room: AnalyzedRoom) => {
    if (readOnly) return;
    e.stopPropagation();
    const p = evXY(e);
    const px = toPx(room);
    dragRef.current = { id: room.id, ox: p.x - px.x, oy: p.y - px.y };
  }, [readOnly, evXY, toPx]);

  const startResize = useCallback((e: React.MouseEvent | React.TouchEvent, room: AnalyzedRoom) => {
    if (readOnly) return;
    e.stopPropagation();
    const p = evXY(e);
    const px = toPx(room);
    resizeRef.current = { id: room.id, sx: p.x, sy: p.y, origPx: px };
  }, [readOnly, evXY, toPx]);

  const onMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!dragRef.current && !resizeRef.current) return;
    const p = evXY(e);
    const { w, h } = dimsRef.current;

    if (dragRef.current) {
      const room = roomsRef.current.find(r => r.id === dragRef.current!.id);
      if (!room) return;
      const nx = p.x - dragRef.current.ox;
      const ny = p.y - dragRef.current.oy;
      onUpdate(dragRef.current.id, {
        x: Math.max(0, Math.min(96, (nx / w) * 100)),
        y: Math.max(0, Math.min(96, (ny / h) * 100)),
      });
    }

    if (resizeRef.current) {
      const { sx, sy, origPx } = resizeRef.current;
      const nw = Math.max(30, origPx.w + (p.x - sx));
      const nh = Math.max(20, origPx.h + (p.y - sy));
      onUpdate(resizeRef.current.id, {
        width: Math.max(3, (nw / w) * 100),
        height: Math.max(2, (nh / h) * 100),
      });
    }
  }, [evXY, onUpdate]);

  const onUp = useCallback(() => {
    dragRef.current = null;
    resizeRef.current = null;
  }, []);

  return (
    <div style={{ position: "relative" }}>
      {label && (
        <div style={{
          position: "absolute", top: 8, left: 8, zIndex: 10,
          background: "rgba(0,0,0,0.55)", color: "#fff",
          fontSize: 11, fontWeight: 700, padding: "3px 10px",
          borderRadius: 20, letterSpacing: ".05em",
          backdropFilter: "blur(4px)", pointerEvents: "none",
        }}>
          {label}
        </div>
      )}
      <div
        ref={containerRef}
        style={{
          position: "relative", userSelect: "none",
          borderRadius: 10, overflow: "hidden",
          boxShadow: "0 2px 16px rgba(0,0,0,0.22)",
        }}
        onMouseMove={onMove}
        onMouseUp={onUp}
        onMouseLeave={onUp}
        onTouchMove={onMove}
        onTouchEnd={onUp}
        onClick={() => { if (!readOnly && onSelect) onSelect(null); }}
      >
        {imgUrl && (
          <img
            src={imgUrl}
            alt="floor plan"
            draggable={false}
            style={{ width: "100%", display: "block" }}
          />
        )}

        <svg
          viewBox={`0 0 ${dims.w} ${dims.h}`}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        >
          {rooms.map((room) => {
            const c = getColor(room.type);
            const isSel = !readOnly && room.id === selectedId;
            const p = toPx(room);
            const fs = Math.min(15, Math.max(8, p.w / 10));

            return (
              <g key={room.id}>
                <rect
                  x={p.x} y={p.y} width={p.w} height={p.h}
                  fill={c.bg}
                  fillOpacity={isSel ? 0.88 : 0.65}
                  stroke={isSel ? "#EF4444" : c.border}
                  strokeWidth={isSel ? 2.5 : 1.6}
                  rx={4}
                  style={{ cursor: readOnly ? "default" : "grab" }}
                  onClick={(e) => {
                    if (!readOnly) { e.stopPropagation(); onSelect(room.id); }
                  }}
                  onMouseDown={(e) => {
                    if (!readOnly) { onSelect(room.id); startDrag(e, room); }
                  }}
                  onTouchStart={(e) => {
                    if (!readOnly) { onSelect(room.id); startDrag(e, room); }
                  }}
                />
                <text
                  x={p.x + p.w / 2}
                  y={p.y + p.h / 2 - (room.estimatedSqFt ? fs * 0.7 : 0)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={c.text}
                  fontSize={fs}
                  fontWeight={700}
                  fontFamily="Inter,sans-serif"
                  style={{ pointerEvents: "none" }}
                >
                  {room.label || room.type}
                </text>
                {room.estimatedSqFt > 0 && (
                  <text
                    x={p.x + p.w / 2}
                    y={p.y + p.h / 2 + fs * 0.9}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={c.text}
                    fontSize={fs * 0.75}
                    opacity={0.75}
                    fontFamily="Inter,sans-serif"
                    style={{ pointerEvents: "none" }}
                  >
                    {room.estimatedSqFt} ft²
                  </text>
                )}
                {isSel && (
                  <rect
                    x={p.x + p.w - 14} y={p.y + p.h - 14}
                    width={14} height={14}
                    fill="#EF4444" rx={3}
                    style={{ cursor: "se-resize" }}
                    onMouseDown={(e) => startResize(e, room)}
                    onTouchStart={(e) => startResize(e, room)}
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   INSIGHTS PANEL
═══════════════════════════════════════════════════════════════ */
function Insights({ analysis }: { analysis: FloorplanAnalysis }) {
  const { score = 0, summary = "", insights = [], flowIssues = [] } = analysis;
  const scoreColor = score >= 8 ? "#16A34A" : score >= 6 ? "#D97706" : "#DC2626";

  return (
    <div className="space-y-3 text-xs">
      {/* Score */}
      <div className="flex gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
        <div className="text-center min-w-[48px]">
          <div className="text-3xl font-black leading-none" style={{ color: scoreColor }}>
            {score.toFixed(1)}
          </div>
          <div className="text-[10px] text-white/40">/ 10</div>
        </div>
        <div className="flex-1">
          <div className="font-bold text-white/90 mb-1">Layout Score</div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-2">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${(score / 10) * 100}%`, background: scoreColor }}
            />
          </div>
          <div className="text-white/60 leading-relaxed">{summary}</div>
        </div>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-2">Analysis</div>
          {insights.map((ins, i) => {
            const isPos = ins.type === "positive";
            const isWrn = ins.type === "warning";
            return (
              <div
                key={i}
                className="p-2 mb-1.5 rounded-lg border text-[11px] leading-relaxed"
                style={{
                  background: isPos ? "rgba(16,185,129,0.1)" : isWrn ? "rgba(245,158,11,0.1)" : "rgba(239,68,68,0.1)",
                  borderColor: isPos ? "rgba(16,185,129,0.2)" : isWrn ? "rgba(245,158,11,0.2)" : "rgba(239,68,68,0.2)",
                  color: isPos ? "#34d399" : isWrn ? "#fbbf24" : "#f87171",
                }}
              >
                {isPos ? "✓" : isWrn ? "⚠" : "✕"} {ins.text}
              </div>
            );
          })}
        </div>
      )}

      {/* Flow Issues */}
      {flowIssues.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-2">Flow Issues</div>
          {flowIssues.map((f, i) => (
            <div
              key={i}
              className="p-2 mb-1.5 rounded-lg border text-[11px] leading-relaxed"
              style={{ background: "rgba(245,158,11,0.1)", borderColor: "rgba(245,158,11,0.2)", color: "#fbbf24" }}
            >
              🔄 {f}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LEGEND
═══════════════════════════════════════════════════════════════ */
function Legend({ rooms }: { rooms: AnalyzedRoom[] }) {
  const total = rooms.reduce((s, r) => s + (r.estimatedSqFt || 0), 0);
  return (
    <div>
      <div className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-2">
        {rooms.length} Room{rooms.length !== 1 ? "s" : ""}
        {total > 0 ? ` · ${total.toLocaleString()} ft²` : ""}
      </div>
      {rooms.map(r => {
        const c = getColor(r.type);
        return (
          <div
            key={r.id}
            className="flex items-center justify-between p-2 mb-1 rounded-lg border"
            style={{ background: c.bg + "22", borderColor: c.border + "44" }}
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-sm" style={{ background: c.dot }} />
              <span className="text-xs font-semibold" style={{ color: c.text }}>{r.label || r.type}</span>
            </div>
            {r.estimatedSqFt > 0 && (
              <span className="text-[11px] text-white/40">{r.estimatedSqFt} ft²</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   EDIT PANEL
═══════════════════════════════════════════════════════════════ */
function EditPanel({ room, onUpdate, onDelete, onClose }: {
  room: AnalyzedRoom | null;
  onUpdate: (patch: Partial<AnalyzedRoom>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  if (!room) {
    return (
      <div className="text-white/40 text-xs text-center py-8 leading-relaxed">
        Click any room overlay to edit it.<br />
        <span className="text-[10px]">Drag to move · drag red corner to resize</span>
      </div>
    );
  }

  const c = getColor(room.type);
  const inputClass = "w-full bg-[#0d1225] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white/80 focus:outline-none focus:border-[#4a90e2]";

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <span className="font-bold text-xs" style={{ color: c.text }}>✎ Editing Room</span>
        <button onClick={onClose} className="text-white/40 hover:text-white text-sm">✕</button>
      </div>

      <div>
        <label className="text-[10px] text-white/30 block mb-1">Type</label>
        <select
          value={room.type}
          onChange={e => onUpdate({ type: e.target.value, label: e.target.value })}
          className={inputClass}
        >
          {ROOM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div>
        <label className="text-[10px] text-white/30 block mb-1">Label</label>
        <input value={room.label || ""} onChange={e => onUpdate({ label: e.target.value })} className={inputClass} />
      </div>

      <div>
        <label className="text-[10px] text-white/30 block mb-1">Est. Area (sq ft)</label>
        <input type="number" value={room.estimatedSqFt || ""} onChange={e => onUpdate({ estimatedSqFt: Number(e.target.value) || 0 })} className={inputClass} min={0} />
      </div>

      <div>
        <label className="text-[10px] text-white/30 block mb-1">Notes</label>
        <textarea value={room.notes || ""} onChange={e => onUpdate({ notes: e.target.value })} className={inputClass + " h-14 resize-y"} />
      </div>

      <button
        onClick={onDelete}
        className="w-full flex items-center justify-center gap-1.5 p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all text-xs"
      >
        🗑 Delete Room
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   RECOMMEND PANEL
═══════════════════════════════════════════════════════════════ */
function RecommendPanel({ recommendations, selected, onToggle, onApply, applying }: {
  recommendations: Recommendation[];
  selected: string[];
  onToggle: (id: string) => void;
  onApply: () => void;
  applying: boolean;
}) {
  if (!recommendations.length) {
    return (
      <div className="text-white/40 text-xs text-center py-8 leading-relaxed">
        No recommendations available.<br />
        <span className="text-[10px]">Run analysis first to see suggestions.</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-2">
        Select recommendations to apply
      </div>
      {recommendations.map(r => {
        const isChecked = selected.includes(r.id);
        const impactColor = r.impact === "high" ? "#f87171" : r.impact === "medium" ? "#fbbf24" : "#34d399";
        return (
          <div
            key={r.id}
            onClick={() => onToggle(r.id)}
            className="p-2.5 rounded-lg border-2 cursor-pointer transition-all"
            style={{
              borderColor: isChecked ? "#3B82F6" : "rgba(255,255,255,0.1)",
              background: isChecked ? "rgba(59,130,246,0.1)" : "rgba(255,255,255,0.02)",
            }}
          >
            <div className="flex items-start gap-2">
              <div
                className="w-4 h-4 rounded flex items-center justify-center mt-0.5 shrink-0 border-2"
                style={{
                  borderColor: isChecked ? "#3B82F6" : "rgba(255,255,255,0.2)",
                  background: isChecked ? "#3B82F6" : "transparent",
                }}
              >
                {isChecked && <span className="text-white text-[9px] font-black">✓</span>}
              </div>
              <div className="flex-1">
                <div className="font-bold text-white/90 text-xs mb-0.5">
                  {r.title}
                  <span className="ml-2 text-[10px] font-semibold" style={{ color: impactColor }}>
                    ● {r.impact}
                  </span>
                </div>
                <div className="text-[11px] text-white/50 leading-relaxed">{r.description}</div>
              </div>
            </div>
          </div>
        );
      })}

      <button
        onClick={onApply}
        disabled={selected.length === 0 || applying}
        className="w-full py-2.5 rounded-lg font-bold text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: selected.length > 0 && !applying ? "linear-gradient(135deg,#3B82F6,#2563EB)" : "rgba(255,255,255,0.1)",
          color: selected.length > 0 && !applying ? "#fff" : "rgba(255,255,255,0.4)",
        }}
      >
        {applying ? "⏳ Applying…" : `✨ Apply Recommendation${selected.length !== 1 ? "s" : ""}`}
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DIFF BADGE
═══════════════════════════════════════════════════════════════ */
function DiffBadge({ originalRooms, updatedRooms }: { originalRooms: AnalyzedRoom[]; updatedRooms: AnalyzedRoom[] }) {
  const removed = originalRooms.filter(o => !updatedRooms.find(u => u.id === o.id));
  const added = updatedRooms.filter(u => !originalRooms.find(o => o.id === u.id));
  const changed = updatedRooms.filter(u => {
    const o = originalRooms.find(r => r.id === u.id);
    if (!o) return false;
    return o.label !== u.label || o.type !== u.type || Math.abs(o.width - u.width) > 0.4 || Math.abs(o.height - u.height) > 0.4;
  });

  if (!removed.length && !added.length && !changed.length) return null;

  return (
    <div className="rounded-lg p-2.5 mb-3 text-xs border" style={{ background: "rgba(16,185,129,0.1)", borderColor: "rgba(16,185,129,0.2)" }}>
      <div className="font-bold text-emerald-400 mb-1">✅ Floor Plan Updated</div>
      {changed.map(r => <div key={r.id} className="text-emerald-300">✎ {r.label || r.type} — modified</div>)}
      {removed.map(r => <div key={r.id} className="text-red-400">✕ {r.label || r.type} — removed</div>)}
      {added.map(r => <div key={r.id} className="text-blue-400">＋ {r.label || r.type} — added</div>)}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CHAT PANEL — AI-powered floorplan editing via natural language
═══════════════════════════════════════════════════════════════ */
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function parseRoomsFromResponse(text: string): AnalyzedRoom[] | null {
  const match = text.match(/```rooms\s*([\s\S]*?)```/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1].trim());
    if (Array.isArray(parsed)) return parsed;
  } catch { /* ignore */ }
  return null;
}

function buildFloorplanChatPrompt(rooms: AnalyzedRoom[]): string {
  return `You are ArchAI, an expert architectural floor plan editor. The user has a floor plan with these rooms:

${JSON.stringify(rooms, null, 2)}

Each room has: id, type, label, estimatedSqFt, x, y, width, height (x/y/width/height are PERCENTAGES 0-100 of image dimensions), notes.

When the user asks to modify the floor plan, respond with:
1. A brief natural language explanation of what you changed
2. A JSON block with the updated rooms array wrapped in \`\`\`rooms ... \`\`\`

Example:
"I've enlarged the kitchen by extending it eastward."
\`\`\`rooms
[{"id":"r1","type":"Kitchen","label":"Kitchen","estimatedSqFt":180,"x":30,"y":10,"width":25,"height":20,"notes":"Expanded east"}]
\`\`\`

Rules:
- ALWAYS return the FULL rooms array (all rooms, not just changed ones)
- Keep x, y, width, height as percentages (0-100)
- Preserve room ids for existing rooms, use "r_new_X" for new rooms
- Rooms should not overlap significantly
- Be realistic about proportions and architectural constraints
- If the user asks a question without requesting changes, just answer naturally without the rooms block`;
}

function ChatPanel({ rooms, onApplyRooms }: {
  rooms: AnalyzedRoom[];
  onApplyRooms: (rooms: AnalyzedRoom[]) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingRooms, setPendingRooms] = useState<AnalyzedRoom[] | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setIsLoading(true);
    setPendingRooms(null);

    try {
      let fullResponse = "";
      const apiMessages = allMessages.map(m => ({ role: m.role, content: m.content }));

      // Try Ollama first
      const ollamaOnline = await isOllamaAvailable();
      if (ollamaOnline) {
        try {
          const systemMsg = { role: "system", content: buildFloorplanChatPrompt(rooms) };
          const resp = await ollamaChat([systemMsg, ...apiMessages]);
          if (resp.ok) {
            const data = await resp.json();
            fullResponse = data.choices?.[0]?.message?.content || "";
          }
        } catch (err) {
          console.warn("Ollama chat failed:", err);
        }
      }

      // Try direct API
      if (!fullResponse && hasDirectKeys()) {
        try {
          fullResponse = await directChat(apiMessages, buildFloorplanChatPrompt(rooms));
        } catch (err) {
          console.warn("Direct API chat failed:", err);
        }
      }

      // Fallback to Supabase edge function
      if (!fullResponse) {
        const { data, error } = await supabase.functions.invoke("design-chat", {
          body: { messages: apiMessages, floorplanRooms: rooms },
        });

        if (error) throw error;

        if (typeof data === "string") {
          for (const line of data.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            const jsonStr = trimmed.slice(6);
            if (jsonStr === "[DONE]") break;
            try {
              const parsed = JSON.parse(jsonStr);
              const delta = parsed.choices?.[0]?.delta?.content || "";
              fullResponse += delta;
            } catch { /* skip */ }
          }
        } else if (data?.choices) {
          fullResponse = data.choices[0]?.message?.content || "";
        } else if (data?.error) {
          throw new Error(data.error);
        }
      }

      if (!fullResponse) {
        fullResponse = "Sorry, I couldn't process that request. Please try again.";
      }

      // Check for room changes
      const newRooms = parseRoomsFromResponse(fullResponse);
      if (newRooms) setPendingRooms(newRooms);

      // Strip rooms JSON block for display
      const displayText = fullResponse.replace(/```rooms[\s\S]*?```/g, "").trim();
      setMessages(prev => [...prev, { role: "assistant", content: displayText || "Changes are ready to apply." }]);
    } catch (err: any) {
      console.error("Chat error:", err);
      setMessages(prev => [...prev, { role: "assistant", content: `❌ Error: ${err?.message || "Unknown error"}` }]);
    } finally {
      setIsLoading(false);
    }
  }, [input, messages, rooms, isLoading]);

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 mb-2 min-h-0">
        {messages.length === 0 && (
          <div className="text-white/30 text-[11px] text-center py-6 leading-relaxed">
            💬 Ask me to edit the floor plan!<br />
            <span className="text-[10px]">e.g. "Make the kitchen bigger" or "Add a bathroom"</span>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`p-2 rounded-lg text-[11px] leading-relaxed ${
              msg.role === "user"
                ? "bg-[#4a90e2]/20 text-[#93c5fd] ml-4"
                : "bg-white/5 text-white/80 mr-4"
            }`}
          >
            {msg.role === "assistant" ? (
              <div className="prose prose-invert prose-xs max-w-none [&>p]:mb-1 [&>p]:text-[11px]">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            ) : (
              msg.content
            )}
          </div>
        ))}
        {isLoading && (
          <div className="p-2 rounded-lg bg-white/5 text-white/40 text-[11px] mr-4">
            <span className="animate-pulse">Thinking...</span>
          </div>
        )}
      </div>

      {pendingRooms && (
        <div className="flex gap-1.5 mb-2">
          <button
            onClick={() => { onApplyRooms(pendingRooms); setPendingRooms(null); }}
            className="flex-1 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 transition-all"
          >
            ✓ Apply Changes
          </button>
          <button
            onClick={() => setPendingRooms(null)}
            className="px-3 py-1.5 rounded-lg text-[11px] bg-white/5 border border-white/10 text-white/40 hover:text-white/60 transition-all"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex gap-1.5">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
          placeholder="e.g. Make the kitchen bigger..."
          disabled={isLoading}
          className="flex-1 bg-[#0d1225] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white/80 placeholder:text-white/20 focus:outline-none focus:border-[#4a90e2] disabled:opacity-50"
        />
        <button
          onClick={sendMessage}
          disabled={isLoading || !input.trim()}
          className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-30"
          style={{ background: "linear-gradient(135deg,#3B82F6,#2563EB)", color: "#fff" }}
        >
          ➤
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   APPLY RECOMMENDATIONS HELPER
═══════════════════════════════════════════════════════════════ */
function applyRecommendations(rooms: AnalyzedRoom[], recommendations: Recommendation[], selectedIds: string[]): AnalyzedRoom[] {
  const chosen = recommendations.filter(r => selectedIds.includes(r.id));
  if (!chosen.length) return rooms;
  let updated = rooms.map(r => ({ ...r }));
  for (const rec of chosen) {
    for (const change of (rec.roomChanges || [])) {
      if (change.remove) {
        updated = updated.filter(r => r.id !== change.id);
      } else {
        updated = updated.map(r =>
          r.id === change.id ? { ...r, ...change } : r
        );
      }
    }
  }
  return updated;
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
interface FloorplanAnalyzerProps {
  imgUrl: string;
  analysis: FloorplanAnalysis;
  isAnalyzing: boolean;
}

const FloorplanAnalyzer: React.FC<FloorplanAnalyzerProps> = ({ imgUrl, analysis, isAnalyzing }) => {
  const [dims, setDims] = useState({ w: 800, h: 600 });
  const [originalRooms, setOriginalRooms] = useState<AnalyzedRoom[]>([]);
  const [rooms, setRooms] = useState<AnalyzedRoom[]>([]);
  const [updatedRooms, setUpdatedRooms] = useState<AnalyzedRoom[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedRecs, setSelectedRecs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"insights" | "legend" | "edit" | "recommend" | "chat">("insights");
  const [applied, setApplied] = useState(false);

  // Detect image dimensions
  React.useEffect(() => {
    if (!imgUrl) return;
    const img = new Image();
    img.onload = () => setDims({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = imgUrl;
  }, [imgUrl]);

  // When analysis changes, update rooms
  React.useEffect(() => {
    if (analysis?.rooms) {
      const withIds = analysis.rooms.map((r, i) => ({ ...r, id: r.id || `r${i}` }));
      setOriginalRooms(withIds);
      setRooms(withIds.map(r => ({ ...r })));
      setUpdatedRooms(null);
      setSelectedRecs([]);
      setApplied(false);
      setActiveTab("insights");
    }
  }, [analysis]);

  const selectedRoom = useMemo(() => rooms.find(r => r.id === selectedId) || null, [rooms, selectedId]);

  const updateRoom = useCallback((id: string, patch: Partial<AnalyzedRoom>) => {
    setRooms(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  }, []);

  const deleteRoom = useCallback((id: string) => {
    setRooms(prev => prev.filter(r => r.id !== id));
    setSelectedId(null);
  }, []);

  const addRoom = useCallback(() => {
    const newRoom: AnalyzedRoom = {
      id: `r_new_${Date.now()}`,
      type: "Unknown",
      label: "New Room",
      estimatedSqFt: 0,
      x: 10, y: 10, width: 20, height: 15,
      notes: "",
    };
    setRooms(prev => [...prev, newRoom]);
    setSelectedId(newRoom.id);
    setActiveTab("edit");
  }, []);

  const toggleRec = useCallback((id: string) => {
    setSelectedRecs(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  const applyRecs = useCallback(() => {
    if (!analysis) return;
    const result = applyRecommendations(rooms, analysis.recommendations || [], selectedRecs);
    setUpdatedRooms(result);
    setApplied(true);
  }, [rooms, analysis, selectedRecs]);

  const acceptChanges = useCallback(() => {
    if (updatedRooms) setRooms(updatedRooms);
    setUpdatedRooms(null);
    setSelectedRecs([]);
    setApplied(false);
  }, [updatedRooms]);

  const discardChanges = useCallback(() => {
    setUpdatedRooms(null);
    setApplied(false);
  }, []);

  const applyRoomsFromChat = useCallback((newRooms: AnalyzedRoom[]) => {
    setUpdatedRooms(newRooms);
    setApplied(true);
  }, []);

  const displayRooms = (applied && updatedRooms) ? updatedRooms : rooms;
  const hasRooms = rooms.length > 0;

  if (isAnalyzing) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white/50">
        <div className="text-sm mb-3">🤖 AI is analyzing your floor plan…</div>
        <div className="h-1 w-80 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full animate-pulse" style={{ width: "60%" }} />
        </div>
      </div>
    );
  }

  if (!hasRooms) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white/40 text-sm">
        Upload a floor plan and run analysis to see room detection.
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-full p-4 overflow-hidden">
      {/* Column 1 — Original AI (read-only) */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">
          📐 Original — AI Analysed
        </div>
        <div className="flex-1 overflow-auto">
          <Canvas
            imgUrl={imgUrl}
            rooms={originalRooms}
            dims={dims}
            readOnly
            label="AI Analysis"
            selectedId={null}
            onSelect={() => {}}
            onUpdate={() => {}}
          />
          {/* Compact legend chips */}
          <div className="mt-2 flex flex-wrap gap-1">
            {originalRooms.map(r => {
              const c = getColor(r.type);
              return (
                <div key={r.id} className="flex items-center gap-1 px-2 py-0.5 rounded-full border" style={{ background: c.bg + "22", borderColor: c.border + "44" }}>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
                  <span className="text-[10px] font-semibold" style={{ color: c.text }}>{r.label || r.type}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Column 2 — Editable */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">
          {applied ? "✨ Updated Floor Plan" : "✏️ Editable Floor Plan"}
        </div>
        {applied && updatedRooms && <DiffBadge originalRooms={originalRooms} updatedRooms={updatedRooms} />}
        <div className="flex-1 overflow-auto">
          <Canvas
            imgUrl={imgUrl}
            rooms={displayRooms}
            selectedId={selectedId}
            onSelect={(id) => { setSelectedId(id); if (id) setActiveTab("edit"); }}
            onUpdate={updateRoom}
            dims={dims}
            label={applied ? "After Recommendations" : "Your Edit"}
          />
        </div>
        <div className="flex gap-2 mt-2">
          <button onClick={addRoom} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60 hover:bg-white/10 transition-colors">
            ＋ Add Room
          </button>
          {applied && updatedRooms && (
            <>
              <button onClick={acceptChanges} className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-xs text-emerald-400 hover:bg-emerald-500/30 transition-colors">
                ✓ Accept
              </button>
              <button onClick={discardChanges} className="px-3 py-1.5 rounded-lg bg-purple-500/20 border border-purple-500/30 text-xs text-purple-400 hover:bg-purple-500/30 transition-colors">
                ✕ Discard
              </button>
            </>
          )}
        </div>
      </div>

      {/* Column 3 — Side panel */}
      <div className="w-[280px] shrink-0 flex flex-col">
        {/* Tabs */}
        <div className="flex gap-0.5 mb-2 bg-white/5 rounded-lg p-0.5">
          {([
            ["insights", "📊"],
            ["legend", "🗂"],
            ["edit", "✎"],
            ["recommend", "✨"],
            ["chat", "💬"],
          ] as const).map(([id, icon]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                activeTab === id
                  ? "bg-[#4a90e2] text-white shadow"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              {icon}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto rounded-xl bg-white/5 border border-white/10 p-3 flex flex-col">
          {activeTab === "insights" && analysis && <Insights analysis={analysis} />}
          {activeTab === "legend" && <Legend rooms={displayRooms} />}
          {activeTab === "edit" && (
            <EditPanel
              room={selectedRoom}
              onUpdate={(patch) => updateRoom(selectedId!, patch)}
              onDelete={() => deleteRoom(selectedId!)}
              onClose={() => setSelectedId(null)}
            />
          )}
          {activeTab === "recommend" && (
            <RecommendPanel
              recommendations={analysis?.recommendations || []}
              selected={selectedRecs}
              onToggle={toggleRec}
              onApply={applyRecs}
              applying={false}
            />
          )}
          {activeTab === "chat" && (
            <ChatPanel
              rooms={displayRooms}
              onApplyRooms={applyRoomsFromChat}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default FloorplanAnalyzer;
