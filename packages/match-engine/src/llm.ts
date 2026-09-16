/**
 * Forge adapter: OpenAI (or compatible) keys/retries behind Nexus ConversationRunner.
 * MATCH_ENGINE_MODE=llm + OPENAI_API_KEY → Nexus llm-conversation-runner.
 * Default MATCH_ENGINE_MODE=stub → createStubConversationRunner.
 */
import {
  chemistryDimsViaJudge,
  createLlmConversationRunner as createNexusLlmConversationRunner,
  type LlmComplete,
} from "./llm-conversation-runner";
import { createStubConversationRunner } from "./stubs";
import type {
  BotTurnInput,
  BotTurnResult,
  ChemistryDims,
  ConversationRunner,
  SafetyCode,
} from "./types";

export type { LlmComplete };
export { buildBotTurnPrompt, chemistryDimsViaJudge } from "./llm-conversation-runner";

export type LlmEnv = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
};

function toNexusInput(input: BotTurnInput) {
  return {
    matchId: input.matchId,
    botId: input.botId,
    userId: input.userId,
    history: input.history,
    profile: {
      looking_for: input.profile.looking_for,
      interests: input.profile.interests,
      vibeTags: input.profile.vibeTags,
      age: input.profile.age,
      gender: input.profile.gender,
    },
    displayName: input.profile.displayName,
  };
}

export function createOpenAiComplete(env: LlmEnv, extras?: { temperature?: number }): LlmComplete {
  return async (prompt: string) => {
    const base = (env.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.apiKey}`,
      },
      body: JSON.stringify({
        model: env.model ?? "gpt-4o-mini",
        temperature: extras?.temperature ?? 0.7,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      throw new Error(`llm_http_${res.status}`);
    }
    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = body.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("llm_empty");
    return text;
  };
}

export function createLlmConversationRunner(
  env: LlmEnv,
  fallback?: ConversationRunner
): ConversationRunner {
  const stub = fallback ?? createStubConversationRunner();
  if (!env.apiKey) {
    return {
      async runBotTurn(input) {
        const result = await stub.runBotTurn(input);
        return { ...result, fallback: true };
      },
    };
  }
  const nexus = createNexusLlmConversationRunner(createOpenAiComplete(env));
  return {
    async runBotTurn(input: BotTurnInput): Promise<BotTurnResult> {
      try {
        const result = await nexus.runBotTurn(toNexusInput(input));
        if (result.safety.ok) return { text: result.text, safety: { ok: true } };
        return {
          text: result.text,
          safety: { ok: false, code: result.safety.code as SafetyCode },
        };
      } catch {
        const fb = await stub.runBotTurn(input);
        return { ...fb, fallback: true };
      }
    },
  };
}

/** Option A: LLM judge on private transcript; heuristic fallback if judge fails. */
export function createLlmChemistryJudge(env: LlmEnv) {
  const complete = createOpenAiComplete(env, { temperature: 0 });
  return (history: Array<{ role: string; text: string }>, fallback: ChemistryDims) =>
    chemistryDimsViaJudge(history, complete, fallback);
}

export function llmConfigured(env: {
  MATCH_ENGINE_MODE?: string;
  OPENAI_API_KEY?: string;
}): boolean {
  return env.MATCH_ENGINE_MODE === "llm" && Boolean(env.OPENAI_API_KEY);
}
