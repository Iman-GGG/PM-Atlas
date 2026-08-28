import type { AiReview, ReviewFinding, ReviewLevel, StateEffect } from "../../lib/lab/contracts";

const reviewLevels = new Set<ReviewLevel>(["mature", "developing", "needs-practice"]);
const capabilityKeys = [
  "signalRecognition",
  "riskAndRootCauseDiagnosis",
  "actionCompletenessAndMinimality",
  "timingAndTradeoff",
  "communicationAndGovernance",
] as const;

function asRecord(value: unknown): StateEffect {
  return value && typeof value === "object" && !Array.isArray(value) ? value as StateEffect : {};
}

function stringList(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) return null;
  return [...new Set(value.map((item) => item.trim()).filter(Boolean))];
}

function normalizeFindings(value: unknown): ReviewFinding[] | null {
  if (!Array.isArray(value)) return null;
  const findings: ReviewFinding[] = [];
  for (const item of value) {
    const finding = asRecord(item);
    const evidenceRefs = stringList(finding.evidenceRefs);
    if (typeof finding.claim !== "string" || typeof finding.impact !== "string" || !evidenceRefs) return null;
    const claim = finding.claim.trim();
    const impact = finding.impact.trim();
    if (!claim || !impact || evidenceRefs.length === 0) return null;
    findings.push({ claim, evidenceRefs, impact });
  }
  return findings;
}

function normalizeLevel(value: unknown): ReviewLevel | null {
  const normalized = value === "needs_practice" ? "needs-practice" : value;
  return typeof normalized === "string" && reviewLevels.has(normalized as ReviewLevel)
    ? normalized as ReviewLevel
    : null;
}

export function normalizeAiReview(value: unknown): AiReview | null {
  const review = asRecord(value);
  const strengths = normalizeFindings(review.strengths);
  const improvements = normalizeFindings(review.improvements);
  const mainlineDifferences = normalizeFindings(review.mainlineDifferences);
  const recommendedKnowledgeIds = stringList(review.recommendedKnowledgeIds);
  const rawCapabilities = asRecord(review.capabilityProfile);
  const capabilityEntries = capabilityKeys.map((key) => [key, normalizeLevel(rawCapabilities[key])] as const);
  if (
    typeof review.summary !== "string"
    || typeof review.retrySuggestion !== "string"
    || !review.summary.trim()
    || !review.retrySuggestion.trim()
    || !strengths
    || !improvements
    || !mainlineDifferences
    || !recommendedKnowledgeIds
    || capabilityEntries.some(([, level]) => !level)
  ) return null;
  return {
    summary: review.summary.trim(),
    strengths,
    improvements,
    mainlineDifferences,
    capabilityProfile: Object.fromEntries(capabilityEntries) as AiReview["capabilityProfile"],
    recommendedKnowledgeIds,
    retrySuggestion: review.retrySuggestion.trim(),
  };
}
