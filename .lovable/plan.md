

# Design Studio — Real Furniture & Photorealistic Features

## Core Concept
The Design Studio won't use random placeholder furniture. Instead, it provides **real furniture** through three methods:

---

## 1. Drop In Any Furniture (Photo → 3D Model)
- **Upload a photo** of any furniture piece (from a store, online, or at home)
- AI converts it into a **to-scale 3D model** using Gemini Vision to extract dimensions, material, color, and shape
- The 3D model is placed in your room scene via React Three Fiber
- You can **drag, rotate, and resize** the piece to see exactly how it fits
- AI estimates real-world dimensions from the photo so the scale is accurate

## 2. Photorealistic Rendering
- **"Render" button** in the top toolbar generates a photorealistic image of your current 3D layout
- Uses Gemini image generation with your room photo + placed furniture as context
- Applies **real lighting and materials** — shows what the room will actually look like
- Before/after comparison: your original room vs the rendered design
- Not an approximation — the render reflects exact furniture positions and materials

## 3. Browse & Shop Real Furniture (Marketplace)
- **Right sidebar marketplace panel** with web search integration
- Search for furniture by category (sofa, table, lamp, etc.) or style
- Results show **real products from real retailers** with actual prices — zero markup
- Each result shows: product image, name, retailer, price, dimensions
- Click "Add to Room" → AI generates a 3D representation from the product image
- Click "Buy" → opens the retailer's product page directly
- Uses web search to find furniture from any retailer on the web

## 4. RoomBot AI Assistant (Bottom Chat Bar)
- Expandable chat bar at the bottom of the Design Studio
- RoomBot **sees your room** — it has context from the evaluation data (objects, style, metrics)
- Ask for **layout suggestions**: "Where should I put a reading lamp?"
- Ask for **style advice**: "What color sofa matches my Scandinavian room?"
- Ask for **shopping recommendations**: "Find me a wood dining table under $500"
- RoomBot can **place furniture** in the 3D scene via conversation
- RoomBot can **trigger renders** when you say "Show me what it looks like"

---

## Design Studio Layout (Dark Theme)

### Top Toolbar
- Left: New, Save, Share, Clear All, Undo, Redo
- Right: Post, **Render** (photorealistic), Export GLB, Export Floor Plan, Capture Screenshot

### Left Sidebar
- View Mode: 2D | 3D | Walk toggle
- Camera Controls: Orbit, Pan, X-Ray, Dimensions, Measure
- **Selected Object Panel**: When a furniture piece is selected — show name, dimensions, material, retailer link, price
- Room Materials: Floor/Walls/Doors color pickers

### Center Canvas (React Three Fiber)
- 3D room scene with grid plane
- Placed furniture as 3D objects (generated from photos/marketplace)
- Drag-and-drop positioning, rotation handles, snapping
- Fullscreen toggle
- Rendered photorealistic image overlay mode

### Right Sidebar — Three Tabs
1. **Add Furniture**
   - "Upload Photo" button → photo-to-3D conversion
   - Drag & drop zone: "Snap a photo of any furniture"
   - Recent uploads history

2. **Marketplace**
   - Search bar: "Search furniture from any store..."
   - Category filters: Sofa, Chair, Table, Bed, Lamp, Rug, Cabinet, Decor
   - Style filters: Modern, Scandinavian, Industrial, etc.
   - Results grid: product image, name, price, retailer
   - "Add to Room" and "Buy Direct" buttons per item
   - "Every store, zero markup" tagline

3. **My Room**
   - List of all placed objects with thumbnails
   - Click to select/focus in 3D view
   - Delete, duplicate, lock controls
   - Total estimated cost of all marketplace items

### Bottom Chat Bar (RoomBot)
- Persistent bar: "Ask RoomBot anything about your design..."
- Expandable to full chat panel
- Context-aware: knows your room style, placed furniture, evaluation data
- Can search marketplace, place furniture, trigger renders, give advice

---

## Technical Implementation

### Supabase Edge Functions
1. **`photo-to-3d`** — Takes a furniture photo → Gemini Vision extracts: type, dimensions (W×H×D cm), material, color, shape description → returns JSON for 3D box/primitive rendering
2. **`furniture-search`** — Uses web search API to find real furniture products → returns product listings with images, prices, retailer URLs
3. **`render-room`** — Takes room photo + furniture layout description → Gemini image generation creates photorealistic render
4. **`design-chat`** — RoomBot streaming chat with full room context, can return action commands (place_furniture, search_marketplace, render_scene)

### 3D Furniture Representation
- Each furniture piece rendered as a **textured 3D box** with correct proportions from AI-estimated dimensions
- Material color applied from AI classification
- Product image mapped as texture on the front face when available
- Future: Could integrate with 3D model APIs for more detailed meshes

### Data Flow
- Evaluation page → sessionStorage → Design Studio (room photo, detected objects, style, metrics)
- Marketplace selections stored in local state with retailer links
- RoomBot has access to all placed furniture + evaluation context

---

## Pages Included in This Build

### All 4 Pages + Navigation
1. **Landing Page** (`/`) — Hero, How It Works (referencing these features), Feature Grid, FAQ, Footer
2. **About Page** (`/about`) — How It Works detail, AI Models section, HF Spaces guide, Created By (Ahamed H - 220071601018, Aashif M - 220071601003)
3. **Evaluate Page** (`/evaluate`) — Upload → HF Spaces API → Dashboard (metrics, objects, style, charts) + Gemini cross-check + AI Redesign
4. **Design Studio** (`/design`) — Full dark-themed editor with real furniture, marketplace, photorealistic renders, and RoomBot

### HF Spaces Deployment Files
- `huggingface/app.py`, `Dockerfile`, `requirements.txt`, `SETUP_GUIDE.md`

