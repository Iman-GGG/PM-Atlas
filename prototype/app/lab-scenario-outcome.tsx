"use client";

import type { AiReview, ReviewFinding, ReviewLevel } from "../lib/lab/contracts";

type OutcomeMetric = {
  week: number;
  spi: number;
  cpi: number;
  forecastCompletionWeek: number;
  status: string;
};

type OutcomeRound = {
  roundNumber: number;
  commitHash: string;
  completedActions: number;
  harmfulEffects: number;
  documents: Array<{ documentId: string; operationCount: number }>;
};

export type ScenarioOutcomeComparison = {
  caseVersion: string;
  contentHash: string;
  forkWeek: number;
  currentWeek: number;
  outcomeClassification: string | null;
  mainline: OutcomeMetric;
  branch: OutcomeMetric | null;
  rounds: OutcomeRound[];
  summary: { submittedRoundCount: number; revisedDocumentCount: number; operationCount: number };
};

type ScenarioOutcomeViewProps = {
  scenarioTitle: string;
  branchStatus: string;
  comparison: ScenarioOutcomeComparison;
  incrementalCostCny: number;
  traceabilityCoveragePercent: number;
  aiReview: AiReview | null;
  aiReviewLoading: boolean;
  aiReviewError: string | null;
  retrying: boolean;
  retryError: string | null;
  documentTitles: Record<string, string>;
  nextTakeoverWeek: number | null;
  onGenerateAiReview: () => void;
  onRetryScenario: () => void;
  onOpenDocument: (documentId: string) => void;
  onClose: () => void;
  onReturnMainline: () => void;
  onStartNextScenario: () => void;
};

const pathLabels: Record<string, string> = {
  near_mainline_success: "近主线成功",
  detour_success: "绕路成功",
  delayed_success: "延期成功",
  scenario_failure: "情景失败",
};

const outcomeDescriptions: Record<string, string> = {
  near_mainline_success: "关键管理动作在允许窗口内闭环，未发生不利选择，分支恢复到接近主线的交付路径。",
  detour_success: "情景已经闭环，但处理过程包含额外回合、管理负载或不利影响，形成可交付但非最短的绕行路径。",
  delayed_success: "管理问题最终关闭，但完工预测或闭环时间超过近主线窗口，结局保留了明确的进度代价。",
  scenario_failure: "分支触发终局约束，未能在允许条件内恢复；规则结论不会被 AI 复盘覆盖。",
};

const reviewLevelLabels: Record<ReviewLevel, string> = {
  mature: "成熟",
  developing: "发展中",
  "needs-practice": "需要练习",
};

const capabilityDimensionLabels: Array<[keyof AiReview["capabilityProfile"], string]> = [
  ["signalRecognition", "信号识别"],
  ["riskAndRootCauseDiagnosis", "风险与根因诊断"],
  ["actionCompletenessAndMinimality", "行动完整性与最小性"],
  ["timingAndTradeoff", "时机与权衡"],
  ["communicationAndGovernance", "沟通与治理"],
];

function ReviewFindingList({ title, eyebrow, findings }: { title: string; eyebrow: string; findings: ReviewFinding[] }) {
  return (
    <section className="lab-v2-review-findings">
      <header><span>{eyebrow}</span><h3>{title}</h3></header>
      {findings.length ? <ol>{findings.map((finding, index) => (
        <li key={`${finding.claim}:${index}`}>
          <b>{String(index + 1).padStart(2, "0")}</b>
          <div><strong>{finding.claim}</strong><p>{finding.impact}</p><footer>{finding.evidenceRefs.map((reference) => <code key={reference}>{reference}</code>)}</footer></div>
        </li>
      ))}</ol> : <p className="empty">本次复盘没有生成这一类发现。</p>}
    </section>
  );
}

function signedMetricDelta(branchValue: number, mainlineValue: number, digits = 2): string {
  const delta = branchValue - mainlineValue;
  if (Math.abs(delta) < 10 ** -digits) return "0";
  return `${delta > 0 ? "+" : ""}${delta.toFixed(digits)}`;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }).format(value);
}

export function ScenarioOutcomeView({
  scenarioTitle,
  branchStatus,
  comparison,
  incrementalCostCny,
  traceabilityCoveragePercent,
  aiReview,
  aiReviewLoading,
  aiReviewError,
  retrying,
  retryError,
  documentTitles,
  nextTakeoverWeek,
  onGenerateAiReview,
  onRetryScenario,
  onOpenDocument,
  onClose,
  onReturnMainline,
  onStartNextScenario,
}: ScenarioOutcomeViewProps) {
  const classification = comparison.outcomeClassification ?? (branchStatus === "failed" ? "scenario_failure" : "");
  const pathLabel = pathLabels[classification] ?? "情景已结算";
  const branchMetric = comparison.branch;
  const completedActions = comparison.rounds.reduce((sum, round) => sum + round.completedActions, 0);
  const harmfulEffects = comparison.rounds.reduce((sum, round) => sum + round.harmfulEffects, 0);
  const documentOperations = new Map<string, number>();
  for (const round of comparison.rounds) {
    for (const document of round.documents) documentOperations.set(document.documentId, (documentOperations.get(document.documentId) ?? 0) + document.operationCount);
  }
  const documents = [...documentOperations].sort(([left], [right]) => left.localeCompare(right, "en"));
  const finalCommit = comparison.rounds.at(-1)?.commitHash ?? "—";

  return (
    <div className="lab-v2-outcome-page" role="dialog" aria-modal="true" aria-label={`${scenarioTitle}结局与复盘`}>
      <div className="lab-v2-outcome-shell">
        <header className="lab-v2-outcome-hero">
          <div><span>SCENARIO OUTCOME / DETERMINISTIC RESULT</span><small>{comparison.caseVersion.toUpperCase()} · {comparison.contentHash.slice(0, 12)} · COMMIT {finalCommit}</small><h1>{pathLabel}</h1><p>{scenarioTitle}</p></div>
          <button type="button" onClick={onClose}>返回路径图</button>
        </header>

        <section className="lab-v2-outcome-metrics" aria-label="情景最终指标">
          <span><b>W{comparison.currentWeek}</b>结算周</span>
          <span><b>{comparison.summary.submittedRoundCount}</b>回合提交</span>
          <span><b>{branchMetric ? branchMetric.spi.toFixed(2) : "—"}</b>分支 SPI</span>
          <span><b>{branchMetric ? branchMetric.cpi.toFixed(2) : "—"}</b>分支 CPI</span>
          <span><b>{branchMetric ? `W${branchMetric.forecastCompletionWeek}` : "—"}</b>完工预测</span>
          <span><b>{formatMoney(incrementalCostCny)}</b>增量成本</span>
        </section>

        <section className="lab-v2-rule-review">
          <header><span>RULE REVIEW</span><h2>确定性规则复盘</h2><p>以下结论来自服务端结算与不可变快照，AI 无权修改。</p></header>
          <article className="conclusion"><small>PATH CLASSIFICATION</small><h3>{pathLabel}</h3><p>{outcomeDescriptions[classification] ?? "情景已经完成结算，请结合路径、指标和文件修订复盘处理过程。"}</p><footer><code>{finalCommit}</code><span>{branchStatus === "failed" ? "终局约束触发" : "终局条件满足"}</span></footer></article>
          <div className="lab-v2-rule-evidence">
            <article><small>管理闭环</small><strong>{completedActions} 项动作完成</strong><p>{harmfulEffects ? `同时应用 ${harmfulEffects} 项不利影响。` : "没有记录不利选择影响。"}</p></article>
            <article><small>文件证据</small><strong>{comparison.summary.revisedDocumentCount} 份文件</strong><p>累计 {comparison.summary.operationCount} 项业务字段操作。</p></article>
            <article><small>治理与跟踪</small><strong>{traceabilityCoveragePercent.toFixed(0)}% 追踪覆盖</strong><p>增量管理成本 {formatMoney(incrementalCostCny)} 元。</p></article>
          </div>
          {branchMetric && <div className="lab-v2-outcome-comparison">
            <header><span>指标</span><b>同期主线</b><b>个人分支</b><b>差值</b></header>
            <div><span>SPI</span><b>{comparison.mainline.spi.toFixed(2)}</b><b>{branchMetric.spi.toFixed(2)}</b><strong>{signedMetricDelta(branchMetric.spi, comparison.mainline.spi)}</strong></div>
            <div><span>CPI</span><b>{comparison.mainline.cpi.toFixed(2)}</b><b>{branchMetric.cpi.toFixed(2)}</b><strong>{signedMetricDelta(branchMetric.cpi, comparison.mainline.cpi)}</strong></div>
            <div><span>完工预测</span><b>W{comparison.mainline.forecastCompletionWeek}</b><b>W{branchMetric.forecastCompletionWeek}</b><strong>{signedMetricDelta(branchMetric.forecastCompletionWeek, comparison.mainline.forecastCompletionWeek, 0)} 周</strong></div>
          </div>}
          <section className="lab-v2-outcome-documents">
            <header><span>DOCUMENT EVIDENCE</span><h3>结局关联文件</h3></header>
            {documents.length ? <div>{documents.map(([documentId, operationCount]) => <button type="button" key={documentId} onClick={() => onOpenDocument(documentId)}><b>{documentId}</b><span>{documentTitles[documentId] ?? documentId}</span><small>{operationCount} 项变更</small></button>)}</div> : <p>这个结局没有产生项目文件修订。</p>}
          </section>
        </section>

        <section className="lab-v2-ai-review">
          <header><div><span>AI STRUCTURED REVIEW / OPTIONAL</span><h2>AI 结构化复盘</h2><p>AI 只解释已结算事实；不可覆盖路径分类、指标或文件差异。</p></div>{!aiReview && <button type="button" disabled={aiReviewLoading} onClick={onGenerateAiReview}>{aiReviewLoading ? "正在生成复盘…" : "生成 AI 复盘"}</button>}</header>
          {aiReviewError && <p className="lab-v2-ai-review-error">{aiReviewError}。确定性规则复盘仍然有效，可稍后重试。</p>}
          {aiReview ? <>
            <article className="lab-v2-ai-summary"><small>SUMMARY</small><p>{aiReview.summary}</p></article>
            <div className="lab-v2-review-grid">
              <ReviewFindingList eyebrow="STRENGTHS" title="做得好的地方" findings={aiReview.strengths} />
              <ReviewFindingList eyebrow="IMPROVEMENTS" title="可以改进的地方" findings={aiReview.improvements} />
            </div>
            <ReviewFindingList eyebrow="MAINLINE DIFFERENCES" title="与主线处理方式的差异" findings={aiReview.mainlineDifferences} />
            <section className="lab-v2-capability-profile">
              <header><span>CAPABILITY PROFILE</span><h3>能力画像</h3></header>
              <div>{capabilityDimensionLabels.map(([key, label]) => {
                const level = aiReview.capabilityProfile[key];
                return <article key={key}><span>{label}</span><div className={level}><i /><i /><i /></div><b>{reviewLevelLabels[level]}</b></article>;
              })}</div>
            </section>
            <div className="lab-v2-review-next">
              <section><span>KNOWLEDGE REFERENCES</span><h3>建议复习的知识条目</h3>{aiReview.recommendedKnowledgeIds.length ? <div>{aiReview.recommendedKnowledgeIds.map((id) => <code key={id}>{id}</code>)}</div> : <p>本次没有新增知识条目建议。</p>}</section>
              <section><span>RETRY SUGGESTION</span><h3>下一次尝试</h3><p>{aiReview.retrySuggestion}</p></section>
            </div>
          </> : !aiReviewLoading && !aiReviewError && <p className="lab-v2-ai-review-empty">规则复盘已经可以独立使用。需要更细的学习建议时，再生成 AI 结构化复盘。</p>}
        </section>

        {retryError && <p className="lab-v2-outcome-retry-error">{retryError}</p>}
        <footer className="lab-v2-outcome-actions">
          <button type="button" onClick={onReturnMainline}>返回项目主线</button>
          {nextTakeoverWeek !== null && <button type="button" className="primary" onClick={onStartNextScenario}>开始下一情景 · W{nextTakeoverWeek}</button>}
          <button type="button" className="primary" disabled={retrying} onClick={onRetryScenario}>{retrying ? "正在创建新分支…" : `从 W${comparison.forkWeek} 重新尝试 · 新建 V5 分支`}</button>
          <button type="button" onClick={onClose}>继续查看当前分支</button>
        </footer>
      </div>
    </div>
  );
}
