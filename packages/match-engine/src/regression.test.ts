import assert from "node:assert/strict";
import { test } from "node:test";
import { CONSTANTS } from "./logic";
import { overlappingPersonaScore, runInviteThresholdRegression } from "./regression";

test("invite_threshold stays 0.75", async () => {
  assert.equal(CONSTANTS.INVITE_THRESHOLD, 0.75);
  const failures = await runInviteThresholdRegression();
  assert.deepEqual(failures, []);
});

test("overlapping Denver personas still clear invite_ready band", async () => {
  const scored = await overlappingPersonaScore();
  assert.ok(scored.confidence >= 0.75, `confidence ${scored.confidence}`);
  assert.equal(scored.band, "invite_ready");
});
