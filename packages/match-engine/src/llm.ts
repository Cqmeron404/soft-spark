import { phaseForTurn, safetyCheckMessage } from "./logic";
import type {
  BotTurnInput,
  BotTurnResult,
  ChemistryDims,
  ConversationRunner,
} from "./types";
import type { TranscriptTurn } from "./chemistry";

export type LlmEnv = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
};

function displayNameOf(input: BotTurnInput): string {
  return input.profile.displayName ?? "their human";
}

function historyBlock(history: BotTurnInput["history"]): string {
  if (history.length === 0) return "(none yet)";
  return history.map((h) => `${h.role}: ${h.text}`).join("\n");
}

export function personaSystemPrompt(input: BotTurnInput): string {
  const turn = input.history.length + 1;
  const phase = phaseForTurn(turn);
  const name = displayNameOf(input);
  const vibe = input.profile.vibeTags.join(", ") || "easygoing";
  const interests = input.profile.interests.join(", ") || "good conversation";
  return [
    `You are ${name}'s dating bot. Represent their vibe (${vibe}) and interests (${interests}).`,
    `looking_for=${input.profile.looking_for}. Phase=${phase}. Turn=${turn}/10.`,
    `Reply in 1–3 short sentences. Ask at most one question. No venue plans. No PII.`,
    `Never invent job, kids, exact address, income, or religion. Never claim to be the human.`,
    `History:\n${historyBlock(input.history)}`,
  ].join("\n");
}

async function chatComplete(
  env: LlmEnv,
  system: string,
  user: string,
  extra?: { json?: boolean }
): Promise<string> {
  const base = (env.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.apiKey}`,
    },
    body: JSON.stringify({
      model: env.model ?? "gpt-4o-mini",
      temperature: extra?.json ? 0 : 0.7,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      ...(extra?.json ? { response_format: { type: "json_object" } } : {}),
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
}

export function createLlmConversationRunner(
  env: LlmEnv,
  fallback: ConversationRunner
): ConversationRunner {
  return {
    async runBotTurn(input: BotTurnInput): Promise<BotTurnResult> {
      try {
        const text = await chatComplete(
          env,
          personaSystemPrompt(input),
          "Write the next bot message only."
        );
        return { text, safety: safetyCheckMessage(text) };
      } catch {
        const result = await fallback.runBotTurn(input);
        return result;
      }
    },
  };
}

export function createLlmChemistryJudge(env: LlmEnv) {
  return async (history: TranscriptTurn[]): Promise<ChemistryDims | null> => {
    const transcript = history.map((h) => `${h.role}: ${h.text}`).join("\n") || "(empty)";
    const raw = await chatComplete(
      env,
      "Score dating-bot chemistry. Return JSON keys reciprocity,curiosity,valueAlignment,emotionalSafety,sharedSpark each 0–1. No extra keys.",
      transcript,
      { json: true }
    );
    const parsed = JSON.parse(raw) as Partial<ChemistryDims>;
    const keys: (keyof ChemistryDims)[] = [
      "reciprocity",
      "curiosity",
      "valueAlignment",
      "emotionalSafety",
      "sharedSpark",
    ];
    const dims = {} as ChemistryDims;
    for (const k of keys) {
      const n = Number(parsed[k]);
      if (!Number.isFinite(n)) return null;
      dims[k] = Math.max(0, Math.min(1, n));
    }
    return dims;
  };
}

export function llmConfigured(env: {
  MATCH_ENGINE_MODE?: string;
  OPENAI_API_KEY?: string;
}): boolean {
  return env.MATCH_ENGINE_MODE === "llm" && Boolean(env.OPENAI_API_KEY);
}
