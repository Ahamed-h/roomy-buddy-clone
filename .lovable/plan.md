

# Investigation Results: 3D Studio (Design Page) Status

## Finding: The 3D Studio IS Working

After navigating to `/design` and testing interactively:

- **3D Canvas renders correctly** — floor, grid, lighting, environment all display
- **Adding furniture works** — clicked "Sofa" in Quick Add, it appeared as a 3D box with correct dimensions (200x85x90 cm)
- **Selection works** — clicking the sofa highlights it with green wireframe edges, left sidebar shows details
- **RoomBot chat opens** — clicking the bottom bar expands the chat panel with the initial greeting message and input field
- **No JavaScript errors** in console related to the 3D scene (only a minor React ref warning unrelated to functionality)

## What Does NOT Work (By Design, Not a Bug)

These features show placeholder behavior because no backend is connected:

1. **RoomBot chat** — returns hardcoded demo responses, not real AI. It does respond to keywords like "sofa", "table", "lamp" by auto-adding furniture, but there is no real AI behind it
2. **Render button** — no edge function deployed, so it does nothing
3. **Upload Furniture Photo** — shows a toast saying "Connect Lovable Cloud" instead of doing photo-to-3D
4. **Marketplace tab** — shows a search UI but no real product search
5. **Export/Save/Share** — toolbar buttons are non-functional stubs

## What Needs to Happen

The studio UI shell works. The "not working" aspect is that **none of the AI-powered features have backends**. Per our previous plans, these need:

1. **`design-chat` edge function** — for real RoomBot AI responses (streaming, context-aware)
2. **`redesign-room` edge function** — for the Render button (photorealistic generation)
3. **Local server connection** — for the evaluation pipeline data to flow into the studio
4. **Rebrand** — still says "roomform" in the top-left

## Recommended Implementation Order

Given this is all working at the UI level, the implementation plan from our previous conversation remains valid. The priority should be:

1. **Rebrand to "aivo"** across all files (quick win, no backend needed)
2. **Deploy `design-chat` edge function** so RoomBot actually works with real AI
3. **Connect evaluation data flow** — pass sessionStorage data from Evaluate → Design so RoomBot has room context
4. **Build the 2D Studio page** (`/design-2d`) for photo-based redesign
5. **Deploy `redesign-room` edge function** for the Render/2D redesign features

No code changes needed to "fix" the 3D Studio — it renders and functions correctly. The gap is backend integration, which we planned in the previous conversations.

