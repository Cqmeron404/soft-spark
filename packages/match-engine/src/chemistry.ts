/**
 * Chemistry dims from the private bot↔bot transcript.
 * Clients never receive history / messages[] — only bands + SignalLine + invite.
 */
export {
  chemistryFromTranscript,
  type TranscriptMsg,
} from "./chemistry-from-transcript";
export { chemistryFromTranscript as heuristicChemistryFromTranscript } from "./chemistry-from-transcript";
import type { TranscriptMsg } from "./chemistry-from-transcript";

export type TranscriptTurn = TranscriptMsg & { at?: string };
