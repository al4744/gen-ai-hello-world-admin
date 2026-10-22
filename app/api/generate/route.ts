import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MODEL = "openrouter/free";

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be signed in to generate captions." },
        { status: 401 }
      );
    }

    // Admin API: require Google authentication and superadmin access.
    const hasGoogleIdentity =
      user.identities?.some(
        (identity) => identity.provider === "google"
      ) === true;

    if (!hasGoogleIdentity) {
      return NextResponse.json(
        { error: "Google authentication is required." },
        { status: 403 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_superadmin")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || profile?.is_superadmin !== true) {
      return NextResponse.json(
        { error: "Superadmin access is required." },
        { status: 403 }
      );
    }

    // Only authorized superadmins reach the generation logic.
    const body = await request.json();

    const imagePath =
      typeof body.imagePath === "string" ? body.imagePath.trim() : "";

    const userPrompt =
      typeof body.userPrompt === "string" ? body.userPrompt.trim() : "";

    if (
      !imagePath ||
      !imagePath.startsWith(`${user.id}/`) ||
      imagePath.includes("..")
    ) {
      return NextResponse.json(
        { error: "Invalid image path." },
        { status: 400 }
      );
    }

    if (userPrompt.length > 500) {
      return NextResponse.json(
        { error: "Context must be 500 characters or fewer." },
        { status: 400 }
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage
      .from("generation-media")
      .getPublicUrl(imagePath);

    const imageResponse = await fetch(publicUrl);

    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: "Could not load the uploaded image." },
        { status: 400 }
      );
    }

    const mimeType =
      imageResponse.headers.get("content-type")?.split(";")[0] ?? "";

    if (!allowedMimeTypes.has(mimeType)) {
      return NextResponse.json(
        { error: "Unsupported image type." },
        { status: 400 }
      );
    }

    const imageBuffer = Buffer.from(
      await imageResponse.arrayBuffer()
    );

    if (imageBuffer.byteLength > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Image must be 5 MB or smaller." },
        { status: 400 }
      );
    }

    const generationPrompt = `
You are generating captions for a social humor preference experiment.

Audience:
A chronically online Columbia University junior who is relatively new to
New York City, lives in the dorms, and explores NYC on weekends.

Task:
Study the provided image and generate exactly two distinct, concise,
funny captions for it.

The captions should:
- feel native to internet and campus humor rather than corporate copy
- work even if the viewer has not seen the user's context
- be meaningfully different from one another so an A/B preference vote
  is interesting
- avoid inventing sensitive personal facts about people in the image
- avoid hateful, harassing, or sexually explicit content
- contain no explanation, labels, hashtags, or quotation marks

User-provided context:
<context>
${userPrompt || "No additional context provided."}
</context>

Return ONLY valid JSON in exactly this shape:
{
  "caption_a": "first caption",
  "caption_b": "second caption"
}
`.trim();

    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenRouter is not configured." },
        { status: 500 }
      );
    }

    const openRouterResponse = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: generationPrompt,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: publicUrl,
                  },
                },
              ],
            },
          ],
          response_format: {
            type: "json_object",
          },
          temperature: 1,
        }),
      }
    );

    const openRouterData = await openRouterResponse.json();

    if (!openRouterResponse.ok) {
      console.error("OpenRouter error:", openRouterData);

      return NextResponse.json(
        { error: "The AI model could not generate captions." },
        { status: 502 }
      );
    }

    const outputText =
      openRouterData?.choices?.[0]?.message?.content;

    if (typeof outputText !== "string" || !outputText.trim()) {
      console.error(
        "Unexpected OpenRouter response:",
        openRouterData
      );

      return NextResponse.json(
        { error: "The AI model returned no captions." },
        { status: 502 }
      );
    }

    let parsed;

    try {
      parsed = JSON.parse(outputText);
    } catch {
      console.error(
        "Invalid JSON from OpenRouter:",
        outputText
      );

      return NextResponse.json(
        { error: "The AI model returned an invalid response." },
        { status: 502 }
      );
    }

    const captionA =
      typeof parsed.caption_a === "string"
        ? parsed.caption_a.trim()
        : "";

    const captionB =
      typeof parsed.caption_b === "string"
        ? parsed.caption_b.trim()
        : "";

    if (!captionA || !captionB || captionA === captionB) {
      return NextResponse.json(
        {
          error:
            "The AI model did not return two distinct captions.",
        },
        { status: 502 }
      );
    }

    // Record the actual model OpenRouter used when available,
    // rather than only storing the free-router alias.
    const actualModel =
      typeof openRouterData?.model === "string"
        ? openRouterData.model
        : MODEL;

    const {
      data: generationSet,
      error: generationSetError,
    } = await supabase
      .from("generation_sets")
      .insert({
        creator_id: user.id,
        image_path: imagePath,
        user_prompt: userPrompt,
        generation_prompt: generationPrompt,
        model: actualModel,
      })
      .select("id")
      .single();

    if (generationSetError || !generationSet) {
      console.error(
        "Generation set insert error:",
        generationSetError
      );

      return NextResponse.json(
        { error: "Could not save the generation set." },
        { status: 500 }
      );
    }

    const {
      data: generations,
      error: generationsError,
    } = await supabase
      .from("generations")
      .insert([
        {
          generation_set_id: generationSet.id,
          candidate_index: 1,
          content: captionA,
        },
        {
          generation_set_id: generationSet.id,
          candidate_index: 2,
          content: captionB,
        },
      ])
      .select("id, candidate_index, content")
      .order("candidate_index", { ascending: true });

    if (generationsError || !generations) {
      console.error(
        "Generations insert error:",
        generationsError
      );

      return NextResponse.json(
        { error: "Could not save the generated captions." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      generationSetId: generationSet.id,
      imagePath,
      imageUrl: publicUrl,
      model: actualModel,
      generations,
    });
  } catch (error) {
    console.error("Generation error:", error);

    return NextResponse.json(
      {
        error:
          "Something went wrong while generating captions.",
      },
      { status: 500 }
    );
  }
}