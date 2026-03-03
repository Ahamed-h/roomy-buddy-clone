import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { analysisData, aiSuggestions, userSuggestions, imageBase64 } = await req.json();
    
    if (!analysisData) {
      return new Response(JSON.stringify({ error: "analysisData is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Step 1: Build enhanced prompt from analysis + suggestions
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

    // Step 2: Use chat API to create a refined image generation prompt
    const promptResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
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
      if (promptResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in workspace settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Failed to generate prompt");
    }

    const promptData = await promptResponse.json();
    const enhancedPrompt = promptData.choices?.[0]?.message?.content || 
      `Professional 2D architectural floor plan with ${rooms.length} rooms: ${roomDescriptions}. Clean lines, labeled rooms, dimensions shown.`;
    
    console.log("Enhanced prompt:", enhancedPrompt.substring(0, 200));

    // Step 3: Generate image using Nano banana model
    const imageMessages: any[] = [];
    
    if (imageBase64) {
      // Edit existing floor plan
      imageMessages.push({
        role: "user",
        content: [
          { type: "text", text: `Redesign this floor plan: ${enhancedPrompt}` },
          { type: "image_url", image_url: { url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/png;base64,${imageBase64}` } },
        ],
      });
    } else {
      // Generate from scratch
      imageMessages.push({
        role: "user",
        content: `Generate a professional 2D architectural floor plan: ${enhancedPrompt}`,
      });
    }

    const imageResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
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
      if (imageResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in workspace settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
