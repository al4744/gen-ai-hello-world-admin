
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordGenerationAttempt } from "@/lib/observability/log-generation";

const MODEL = "openrouter/free";

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type LlmResponseLog = NonNullable<
  Parameters<typeof recordGenerationAttempt>[0]["llmResponse"]
>;

function validTokenCount(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
    ? value
    : null;
}

export async function POST(request: Request) {
  const startedAt = new Date().toISOString();

  let supabase: Awaited<ReturnType<typeof createClient>> | null = null;
  let requesterId: string | null = null;

  // These fields accumulate observability data throughout the request.
  let loggedImagePath: string | null = null;
  let loggedUserPrompt: string | null = null;
  let loggedGenerationPrompt: string | null = null;
  let loggedActualModel: string | null = null;
  let loggedGenerationSetId: number | null = null;
  let loggedLlmResponse: LlmResponseLog | null = null;

  let generationStatus: "succeeded" | "failed" = "failed";
  let errorCode: string | null = "unexpected_error";
  let errorMessage: string | null = "Generation did not complete.";

  // Preserve the existing JSON error contract while also recording
  // the reason an authenticated generation attempt failed.
  function fail(
    code: string,
    message: string,
    httpStatus: number
  ) {
    errorCode = code;
    errorMessage = message;

    return NextResponse.json(
      { error: message },
      { status: httpStatus }
    );
  }

  try {
    supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      // Anonymous requests are rejected before generation begins.
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

    requesterId = user.id;

    const body = await request.json();

    const imagePath =
      typeof body.imagePath === "string"
        ? body.imagePath.trim()
        : "";

    const userPrompt =
      typeof body.userPrompt === "string"
        ? body.userPrompt.trim()
        : "";

    loggedImagePath = imagePath
      ? imagePath.slice(0, 1024)
      : null;

    loggedUserPrompt = userPrompt
      ? userPrompt.slice(0, 500)
      : null;

    if (
      !imagePath ||
      !imagePath.startsWith(`${user.id}/`) ||
      imagePath.includes("..")
    ) {
      return fail(
        "invalid_image_path",
        "Invalid image path.",
        400
      );
    }

    if (userPrompt.length > 500) {
      return fail(
        "invalid_user_prompt",
        "Context must be 500 characters or fewer.",
        400
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage
      .from("generation-media")
      .getPublicUrl(imagePath);

    const imageResponse = await fetch(publicUrl);

    if (!imageResponse.ok) {
      return fail(
        "image_load_failed",
        "Could not load the uploaded image.",
        400
      );
    }

    const mimeType =
      imageResponse.headers.get("content-type")?.split(";")[0] ?? "";

    if (!allowedMimeTypes.has(mimeType)) {
      return fail(
        "unsupported_image_type",
        "Unsupported image type.",
        400
      );
    }

    const imageBuffer = Buffer.from(
      await imageResponse.arrayBuffer()
    );

    if (imageBuffer.byteLength > 5 * 1024 * 1024) {
      return fail(
        "image_too_large",
        "Image must be 5 MB or smaller.",
        400
      );
    }

    // Preserve the original caption-generation prompt.
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

    loggedGenerationPrompt = generationPrompt;

    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return fail(
        "openrouter_not_configured",
        "OpenRouter is not configured.",
        500
      );
    }

    // Measure the model request separately from the full request.
    const llmStartedAt = Date.now();

    let openRouterResponse: Response;

    try {
      openRouterResponse = await fetch(
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
    } catch (error) {
      console.error("OpenRouter network error:", error);

      loggedLlmResponse = {
        model: MODEL,
        durationMs: Date.now() - llmStartedAt,
        errorMessage: "OpenRouter network request failed.",
      };

      return fail(
        "openrouter_network_error",
        "The AI model could not generate captions.",
        502
      );
    }

    // Record HTTP status even if the provider returns invalid JSON.
    loggedLlmResponse = {
      model: MODEL,
      httpStatus: openRouterResponse.status,
      durationMs: Date.now() - llmStartedAt,
    };

    const openRouterData = await openRouterResponse.json();

    const actualModel =
      typeof openRouterData?.model === "string"
        ? openRouterData.model
        : MODEL;

    loggedActualModel = actualModel;

    const outputText =
      openRouterData?.choices?.[0]?.message?.content;

    loggedLlmResponse = {
      ...loggedLlmResponse,
      model: actualModel,
      providerResponseId:
        typeof openRouterData?.id === "string"
          ? openRouterData.id
          : null,
      responseText:
        typeof outputText === "string"
          ? outputText
          : null,
      finishReason:
        typeof openRouterData?.choices?.[0]?.finish_reason === "string"
          ? openRouterData.choices[0].finish_reason
          : null,
      promptTokens: validTokenCount(
        openRouterData?.usage?.prompt_tokens
      ),
      completionTokens: validTokenCount(
        openRouterData?.usage?.completion_tokens
      ),
      totalTokens: validTokenCount(
        openRouterData?.usage?.total_tokens
      ),
      errorMessage: openRouterResponse.ok
        ? null
        : "OpenRouter returned an unsuccessful response.",
    };

    if (!openRouterResponse.ok) {
      console.error("OpenRouter error:", openRouterData);

      return fail(
        "openrouter_api_error",
        "The AI model could not generate captions.",
        502
      );
    }

    if (typeof outputText !== "string" || !outputText.trim()) {
      console.error(
        "Unexpected OpenRouter response:",
        openRouterData
      );

      return fail(
        "empty_llm_response",
        "The AI model returned no captions.",
        502
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

      return fail(
        "invalid_llm_json",
        "The AI model returned an invalid response.",
        502
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
      return fail(
        "invalid_caption_pair",
        "The AI model did not return two distinct captions.",
        502
      );
    }

    // Preserve the existing generation_sets write.
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

      return fail(
        "generation_set_save_failed",
        "Could not save the generation set.",
        500
      );
    }

    loggedGenerationSetId = generationSet.id;

    // Preserve the existing generations write.
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

      return fail(
        "captions_save_failed",
        "Could not save the generated captions.",
        500
      );
    }

    // Mark success only after both existing database writes succeed.
    generationStatus = "succeeded";
    errorCode = null;
    errorMessage = null;

    return NextResponse.json({
      generationSetId: generationSet.id,
      imagePath,
      imageUrl: publicUrl,
      model: actualModel,
      generations,
    });
  } catch (error) {
    console.error("Generation error:", error);

    return fail(
      "unexpected_error",
      "Something went wrong while generating captions.",
      500
    );
  } finally {
    // This runs on success, validation failures, and provider errors.
    // Logging failures are caught inside the helper and cannot
    // replace the existing generation response.
    if (supabase && requesterId) {
      await recordGenerationAttempt({
        supabase,
        requesterId,
        sourceApp: "admin",
        startedAt,
        status: generationStatus,
        requestedModel: MODEL,
        imagePath: loggedImagePath,
        userPrompt: loggedUserPrompt,
        generationPrompt: loggedGenerationPrompt,
        actualModel: loggedActualModel,
        generationSetId: loggedGenerationSetId,
        errorCode,
        errorMessage,
        llmResponse: loggedLlmResponse,
      });
    }
  }
}
