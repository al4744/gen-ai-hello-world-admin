
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

type LlmResponseDetails = {
  model?: string | null;
  providerResponseId?: string | null;
  httpStatus?: number | null;
  responseText?: string | null;
  finishReason?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  durationMs?: number | null;
  errorMessage?: string | null;
};

type GenerationLogDetails = {
  supabase: SupabaseClient;
  requesterId: string;
  sourceApp: "main" | "admin";
  startedAt: string;
  status: "succeeded" | "failed";
  requestedModel: string;

  imagePath?: string | null;
  userPrompt?: string | null;
  generationPrompt?: string | null;
  actualModel?: string | null;
  generationSetId?: number | null;

  errorCode?: string | null;
  errorMessage?: string | null;

  llmResponse?: LlmResponseDetails | null;
};

/**
 * Record one generation attempt and its optional LLM response.
 *
 * Logging must never prevent caption generation from working.
 * No API keys or authorization headers are persisted.
 */
export async function recordGenerationAttempt(
  details: GenerationLogDetails
): Promise<void> {
  try {
    // Generate the ID locally, because ordinary users cannot
    // SELECT from the observability tables.
    const requestId = randomUUID();

    const completedAt = new Date();
    const durationMs = Math.max(
      0,
      completedAt.getTime() -
        new Date(details.startedAt).getTime()
    );

    const { error: requestError } = await details.supabase
      .from("generation_requests")
      .insert({
        id: requestId,
        requester_id: details.requesterId,
        source_app: details.sourceApp,

        image_path: details.imagePath ?? null,
        user_prompt: details.userPrompt ?? null,
        generation_prompt: details.generationPrompt ?? null,

        requested_model: details.requestedModel,
        actual_model: details.actualModel ?? null,
        generation_set_id: details.generationSetId ?? null,

        status: details.status,
        error_code: details.errorCode ?? null,
        error_message: details.errorMessage ?? null,

        duration_ms: durationMs,
        started_at: details.startedAt,
        completed_at: completedAt.toISOString(),
      });

    if (requestError) {
      console.error(
        "Generation observability request insert failed:",
        requestError.message
      );
      return;
    }

    // Some failures occur before an LLM is contacted.
    if (!details.llmResponse) {
      return;
    }

    const llm = details.llmResponse;

    const { error: responseError } = await details.supabase
      .from("llm_responses")
      .insert({
        request_id: requestId,
        requester_id: details.requesterId,

        provider: "openrouter",
        model: llm.model ?? null,
        provider_response_id: llm.providerResponseId ?? null,

        http_status: llm.httpStatus ?? null,
        response_text:
          typeof llm.responseText === "string"
            ? llm.responseText.slice(0, 10000)
            : null,
        finish_reason: llm.finishReason ?? null,

        prompt_tokens: llm.promptTokens ?? null,
        completion_tokens: llm.completionTokens ?? null,
        total_tokens: llm.totalTokens ?? null,

        duration_ms: llm.durationMs ?? null,
        error_message: llm.errorMessage ?? null,
      });

    if (responseError) {
      console.error(
        "Generation observability response insert failed:",
        responseError.message
      );
    }
  } catch (error) {
    // Observability is best-effort: never break generation
    // because recording a log failed.
    console.error("Generation observability error:", error);
  }
}
