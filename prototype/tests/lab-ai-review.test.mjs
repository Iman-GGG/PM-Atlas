import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { normalizeAiReview } from "../worker/lab/ai-review.ts";

function completeReview() {
  return {
    summary: " 结算事实已经闭环。 ",
    strengths: [{ claim: "识别到关键风险", evidenceRefs: ["ROUND-1", "D26"], impact: "避免风险继续扩大" }],
    improvements: [{ claim: "行动仍可更精简", evidenceRefs: ["ROUND-2"], impact: "减少额外管理成本" }],
    mainlineDifferences: [{ claim: "比主线多一个回合", evidenceRefs: ["PATH-COMPARISON"], impact: "完工预测延后一周" }],
    capabilityProfile: {
      signalRecognition: "mature",
      riskAndRootCauseDiagnosis: "developing",
      actionCompletenessAndMinimality: "needs_practice",
      timingAndTradeoff: "developing",
      communicationAndGovernance: "mature",
    },
    recommendedKnowledgeIds: ["PM-RISK-01", "PM-RISK-01", "PM-GOV-02"],
    retrySuggestion: " 下一次减少重复动作。 ",
    providerInternalNote: "must not leak",
  };
}

test("normalizes the complete seven-field AI review contract", () => {
  const normalized = normalizeAiReview(completeReview());
  assert.ok(normalized);
  assert.equal(normalized.summary, "结算事实已经闭环。");
  assert.equal(normalized.retrySuggestion, "下一次减少重复动作。");
  assert.equal(normalized.capabilityProfile.actionCompletenessAndMinimality, "needs-practice");
  assert.deepEqual(normalized.recommendedKnowledgeIds, ["PM-RISK-01", "PM-GOV-02"]);
  assert.equal("providerInternalNote" in normalized, false);
});

test("rejects incomplete capability profiles and findings without evidence", () => {
  const missingCapability = completeReview();
  delete missingCapability.capabilityProfile.communicationAndGovernance;
  assert.equal(normalizeAiReview(missingCapability), null);

  const missingEvidence = completeReview();
  missingEvidence.improvements[0].evidenceRefs = [];
  assert.equal(normalizeAiReview(missingEvidence), null);
});

test("renders deterministic outcomes independently from optional AI review", async () => {
  const [pageSource, outcomeSource, cssSource] = await Promise.all([
    readFile(new URL("../app/lab-timeline-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lab-scenario-outcome.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(pageSource, /ScenarioOutcomeView/);
  assert.match(pageSource, /查看完整结局与复盘/);
  assert.doesNotMatch(pageSource, /String\(aiReview\.summary/);
  assert.match(outcomeSource, /确定性规则复盘/);
  assert.match(outcomeSource, /AI 结构化复盘/);
  assert.match(outcomeSource, /aiReview\.strengths/);
  assert.match(outcomeSource, /aiReview\.improvements/);
  assert.match(outcomeSource, /aiReview\.mainlineDifferences/);
  assert.match(outcomeSource, /aiReview\.capabilityProfile/);
  assert.match(outcomeSource, /aiReview\.recommendedKnowledgeIds/);
  assert.match(outcomeSource, /aiReview\.retrySuggestion/);
  assert.match(cssSource, /\.lab-v2-outcome-page \{ position: fixed/);
  assert.match(cssSource, /@media \(max-width: 640px\)[\s\S]*\.lab-v2-outcome-metrics \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(cssSource, /\.lab-v2-outcome-page[^}]*overflow-x:\s*auto/);
});
