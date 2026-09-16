/**
 * LLM ConversationRunner scaffold (Slice 2).
 * Forge wires fetch/API keys; Nexus owns prompt + phase rules.
 * MATCH_ENGINE_MODE=llm → use this; stub → createStubConversationRunner.
 */
import { phaseForTurn, safetyCheckMessage } from "./match-logic-v0";
import type { ChemistryDims } from "./match-logic-v0";

export type BotTurnInput = {
  matchId: string;
  botId: string;
  userId: string;
  history: Array<{ role: "botA" | "botB"; text: string; at: string }>;
  profile: {
    looking_for: string;
    interests: string[];
    vibeTags: string[];
    age: number;
    gender: string;
  };
  displayName?: string;
};

export type BotTurnResult = {
  text: string;
  safety: { ok: true } | { ok: false; code: string };
};

export type LlmComplete = (prompt: string) => Promise<string>;

export function buildBotTurnPrompt(input: BotTurnInput): string {
  const turn = input.history.length + 1;
  const phase = phaseForTurn(turn);
  const name = input.displayName ?? "their human";
  const history = input.history
    .map((m) => `${m.role}: ${m.text}`)
    .join("\n");
  return `You are ${name}'s dating bot. Represent their vibe (${input.profile.vibeTags.join(", ") || "warm"}) and interests (${input.profile.interests.join(", ") || "general"}).
looking_for=${input.profile.looking_for}. Phase=${phase}. Turn=${turn}/10.
Reply in 1–3 short sentences. Ask at most one question. No venue plans. No PII. Never invent hard facts (job, kids, address). Never claim to be the human.
History:
${history || "(start)"}
Your reply:`;
}

export function createLlmConversationRunner(complete: LlmComplete): {
  runBotTurn(input: BotTurnInput): Promise<BotTurnResult>;
} {
  return {
    async runBotTurn(input: BotTurnInput): Promise<BotTurnResult> {
      const prompt = buildBotTurnPrompt(input);
      const text = (await complete(prompt)).trim().slice(0, 600);
      if (!text) throw new Error("llm_empty");
      const safety = safetyCheckMessage(text);
      return { text, safety };
    },
  };
}

/** Optional LLM judge → dims JSON. Prefer heuristic if judge fails. */
export async function chemistryDimsViaJudge(
  history: Array<{ role: string; text: string }>,
  complete: LlmComplete,
  fallback: ChemistryDims
): Promise<ChemistryDims> {
  const prompt = `Score this bot-dating transcript 0-1 JSON only with keys reciprocity,curiosity,valueAlignment,emotionalSafety,sharedSpark. No prose.
${history.map((m) => `${m.role}: ${m.text}`).join("\n")}`;
  try {
    const raw = await complete(prompt);
    const json = JSON.parse(raw.replace(/```json|```/g, "").trim()) as ChemistryDims;
    return {
      reciprocity: clamp(json.reciprocity),
      curiosity: clamp(json.curiosity),
      valueAlignment: clamp(json.valueAlignment),
      emotionalSafety: clamp(json.emotionalSafety),
      sharedSpark: clamp(json.sharedSpark),
    };
  } catch {
    return fallback;
  }
}

function clamp(n: unknown): number {
  const x = typeof n === "number" ? n : Number(n);
  if (Number.isNaN(x)) return 0.4;
  return Math.max(0, Math.min(1, x));
}
