import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { analysisData, aiSuggestions, userSuggestions, imageBase64 } = await req.json();
    
    if (!analysisData) {
      return new Response(JSON.stringify({ error: "analysisData is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GEMINI_KEY) {
      throw new Error("GOOGLE_GEMINI_API_KEY is not configured");
    }

    const rooms = analysisData.rooms || [];
    const roomDescriptions = rooms.map((r: any) => 
      `${r.label || r.type} (${r.estimatedSqFt || 0} sq ft)`
    ).join(", ");

    const aiRecsList = (aiSuggestions || []).map((s: string) => `- ${s}`).join("\n");
    const userReqs = userSuggestions || "";

    console.log("Generating floorplan with:", {
      roomCount: rooms.length,
      aiSuggestionCount: (aiSuggestions || []).length,
      hasUserSuggestions: !!userReqs,
      hasImage: !!imageBase64,
    });

    // Step 1: Generate refined prompt via Gemini chat
    const promptResponse = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an architectural floor plan designer. Create a concise image generation prompt for a redesigned floor plan.
The prompt should describe a clean, professional 2D architectural floor plan drawing with labeled rooms.
Keep it under 200 words. Focus on layout, room sizes, and spatial relationships.
Return ONLY the prompt text, nothing else.`
          },
          {
            role: "user",
            content: `Create an image prompt for this redesigned floor plan:

CURRENT ROOMS: ${roomDescriptions}
TOTAL AREA: ${analysisData.totalArea || "unknown"} sq ft
LAYOUT SCORE: ${analysisData.score || "N/A"}/10

AI RECOMMENDATIONS TO APPLY:
${aiRecsList || "None selected"}

USER REQUIREMENTS:
${userReqs || "None specified"}

Generate a prompt for a clean, professional architectural floor plan that incorporates these changes.`
          }
        ],
      }),
    });

    if (!promptResponse.ok) {
      const errText = await promptResponse.text();
      console.error("Prompt generation failed:", promptResponse.status, errText);
      if (promptResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Failed to generate prompt");
    }

    const promptData = await promptResponse.json();
    const enhancedPrompt = promptData.choices?.[0]?.message?.content || 
      `Professional 2D architectural floor plan with ${rooms.length} rooms: ${roomDescriptions}. Clean lines, labeled rooms, dimensions shown.`;
    
    console.log("Enhanced prompt:", enhancedPrompt.substring(0, 200));

    // Step 2: Generate image via Gemini image model
    const imageMessages: any[] = [];
    
    if (imageBase64) {
      imageMessages.push({
        role: "user",
        content: [
          { type: "text", text: `Redesign this floor plan: ${enhancedPrompt}` },
          { type: "image_url", image_url: { url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/png;base64,${imageBase64}` } },
        ],
      });
    } else {
      imageMessages.push({
        role: "user",
        content: `Generate a professional 2D architectural floor plan: ${enhancedPrompt}`,
      });
    }

    const imageResponse = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash-image-generation",
        messages: imageMessages,
        modalities: ["image", "text"],
      }),
    });

    if (!imageResponse.ok) {
      const errText = await imageResponse.text();
      console.error("Image generation failed:", imageResponse.status, errText);
      if (imageResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Image generation failed");
    }

    const imageData = await imageResponse.json();
    const generatedImage = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    const description = imageData.choices?.[0]?.message?.content || "";

    if (!generatedImage) {
      console.error("No image in response:", JSON.stringify(imageData).substring(0, 500));
      throw new Error("AI did not generate an image. Try simplifying your requirements.");
    }

    console.log("Image generated successfully, description length:", description.length);

    return new Response(JSON.stringify({
      image_url: generatedImage,
      description,
      prompt_used: enhancedPrompt,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("generate-floorplan error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
