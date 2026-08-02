"use client";

import { useMemo, useState } from "react";
import {
  CASE_PROJECT_NAME,
  deliverables,
  initialRisks,
  interviewItems,
  milestones,
  openQuestions,
  reasonNodes,
  type EvidenceStatus,
  type Risk,
} from "./data";
import { KnowledgeLibrary } from "./knowledge-library";
import { ProjectInitiation } from "./lab-overview";
import { ActivityInputOutputSummary, ManagementAreaPage } from "./management-area-page";
import { DocumentWorkspace } from "./document-workspace";
import { managementAreaById, managementAreas, type LabAreaId } from "./management-area-data";
import { StakeholderPage } from "./stakeholder-page";

type ProductPage = LabAreaId;
type PrimarySection = "knowledge" | "lab";
type AssessmentMode = "inherent" | "residual";
type Rating = Risk["rating"];

const statusLabels: Record<EvidenceStatus, string> = {
  confirmed: "已确认",
  inferred: "推理得出",
  assumed: "待确认假设",
  missing: "信息缺失",
  recommended: "建议方案",
};

const ratingLabels: Record<Rating, string> = {
  Critical: "极高",
  High: "高",
  Medium: "中",
  Low: "低",
};

function scoreFor(probability: number, impact: number) {
  return probability * impact;
}

function ratingFor(probability: number, impact: number, category = ""): Rating {
  const score = scoreFor(probability, impact);
  if (score >= 17) return "Critical";
  if (score >= 10) return "High";
  if (impact === 5 && (category.includes("安全") || category.includes("合规"))) return "High";
  if (score >= 5) return "Medium";
  return "Low";
}

function StatusPill({ status }: { status: EvidenceStatus }) {
  return <span className={`status-pill status-${status}`}>{statusLabels[status]}</span>;
}

function RatingPill({ rating }: { rating: Rating }) {
  return <span className={`rating-pill rating-${rating.toLowerCase()}`}>{ratingLabels[rating]}</span>;
}

function AppHeader({
  section,
  setSection,
  onExport,
  canExport,
}: {
  section: PrimarySection;
  setSection: (section: PrimarySection) => void;
  onExport: () => void;
  canExport: boolean;
}) {
  return (
    <header className="app-header">
      <div className="brand-lockup" aria-label="项目管理知识工作台">
        <span className="brand-mark">P</span>
        <span className="brand-name">PM Atlas</span>
      </div>
      <nav className="primary-nav" aria-label="一级导航">
        <button className={section === "knowledge" ? "active" : ""} onClick={() => setSection("knowledge")}>
          知识库
          <small>理解通用规律</small>
        </button>
        <button className={section === "lab" ? "active" : ""} onClick={() => setSection("lab")}>
          项目实验室
          <small>推演具体项目</small>
        </button>
      </nav>
      <div className="header-actions">
        <span className="header-mode-label">{section === "knowledge" ? "教材分类标准" : "BIM 报建案例"}</span>
        <button className={`button button-dark button-small ${canExport ? "" : "header-export-hidden"}`} onClick={onExport}>
          导出 Word
        </button>
      </div>
    </header>
  );
}

function ProjectContext({ page }: { page: ProductPage }) {
  const progress = page === "integration"
    ? "15 / 18 项信息已具备"
    : page === "risk"
      ? "9 项风险已识别"
      : page === "stakeholder"
        ? "12 类干系人已识别"
        : page === "overview"
          ? "立项判断已形成"
          : "核心输入输出已展开";
  return (
    <div className="project-context">
      <div>
        <span className="context-label">当前推演项目</span>
        <strong>{CASE_PROJECT_NAME}</strong>
      </div>
      <div className="context-meta">
        <span>推演草案 v0.1</span>
        <span className="dot-separator" />
        <span>{progress}</span>
      </div>
    </div>
  );
}

function LabSubnav({ page, setPage }: { page: ProductPage; setPage: (page: ProductPage) => void }) {
  const items: Array<{ id: ProductPage; label: string; state: string }> = [
    { id: "overview", label: "立项", state: "项目起点" },
    ...managementAreas.map((area) => ({
      id: area.id,
      label: area.tabLabel,
      state: area.id === "integration" || area.id === "risk" ? "已有样本" : area.id === "stakeholder" ? "推荐下一步" : `${area.processes.length} 个活动`,
    })),
  ];
  return (
    <nav className="lab-subnav" aria-label="项目实验室导航">
      <div className="lab-page-tabs">
        {items.map((item, index) => (
          <button key={item.id} className={page === item.id ? "active" : ""} onClick={() => setPage(item.id)}>
            <span>{String(index).padStart(2, "0")}</span><strong>{item.label}</strong><small>{item.state}</small>
          </button>
        ))}
      </div>
    </nav>
  );
}

function ManagementProcessStrip({ page }: { page: Exclude<ProductPage, "overview"> }) {
  const area = managementAreaById[page];
  return (
    <section className="management-process-strip" aria-label={`${area.title}子活动`}>
      <header>
        <span>第二层 · 子活动</span>
        <strong>{area.title}</strong>
        <small>仅显示层级；当前样本在下方展开</small>
      </header>
      <ol>
        {area.processes.map((item, index) => (
          <li className={item.id === area.focusProcessId ? "active" : ""} key={item.id}>
            <span>{String(index + 1).padStart(2, "0")} · {item.group}</span>
            <strong>{item.title}</strong>
            {item.id === area.focusProcessId && <small>下方当前样本</small>}
          </li>
        ))}
      </ol>
    </section>
  );
}

function CharterPage({ onContinue }: { onContinue: () => void }) {
  const [activeQuestionId, setActiveQuestionId] = useState("INT-002");
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(interviewItems.map((item) => [item.id, item.answer])),
  );
  const [selectedNodeId, setSelectedNodeId] = useState("D-LIFECYCLE");
  const [previewTab, setPreviewTab] = useState("摘要");

  const activeQuestion = interviewItems.find((item) => item.id === activeQuestionId) ?? interviewItems[0];
  const selectedNode = reasonNodes.find((node) => node.id === selectedNodeId) ?? reasonNodes[0];
  const purposeText = `${answers["INT-002"]} 项目将建设统一、可追溯的 BIM 规划报建与智能审查平台，并以混合型生命周期平衡刚性治理与业务迭代。`;

  const goToRisk = () => {
    onContinue();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main>
      <section className="management-activity-intro">
        <div>
          <span className="section-index">项目整合管理 · 制定项目章程</span>
          <h1>访谈、推理树与项目章程</h1>
          <p>先追问事实，再解释判断，最后把管理决策自动带入项目章程；每个结论都能回到它的来源。</p>
        </div>
        <div className="management-intro-stats">
          <div><span>主要输入</span><strong>商业文件 · 协议</strong></div>
          <div><span>主要输出</span><strong>项目章程 · 假设日志</strong></div>
          <div><span>样本状态</span><strong>实时生成</strong></div>
        </div>
      </section>
      <ActivityInputOutputSummary process={managementAreaById.integration.processes[0]} />

      <section className="charter-workspace" aria-label="章程推演工作台">
        <aside className="panel interview-panel">
          <div className="panel-heading">
            <div>
              <span className="section-index">01 / 访谈</span>
              <h2>前辈会先问什么</h2>
            </div>
            <span className="progress-number">83%</span>
          </div>
          <div className="progress-track"><span style={{ width: "83%" }} /></div>
          <div className="interview-list" role="list">
            {interviewItems.map((item) => (
              <button
                key={item.id}
                className={`interview-item ${activeQuestionId === item.id ? "active" : ""}`}
                onClick={() => setActiveQuestionId(item.id)}
              >
                <span className="question-state">{item.status === "confirmed" ? "✓" : "·"}</span>
                <span>
                  <small>{item.group}</small>
                  <strong>{item.question}</strong>
                </span>
              </button>
            ))}
          </div>
          <div className="answer-editor">
            <div className="answer-meta">
              <StatusPill status={activeQuestion.status} />
              <span>将带入：{activeQuestion.mapsTo}</span>
            </div>
            <label htmlFor="active-answer">你的回答</label>
            <textarea
              id="active-answer"
              value={answers[activeQuestion.id]}
              onChange={(event) => setAnswers((current) => ({ ...current, [activeQuestion.id]: event.target.value }))}
              rows={6}
            />
            <div className="mentor-note">
              <span>前辈提示</span>
              <p>
                {activeQuestion.id === "INT-002"
                  ? "先说清楚现在的问题，再描述希望发生的变化。暂时不要急着列功能。"
                  : "给出可验证的事实；不确定也没关系，系统会把它保留为待确认假设。"}
              </p>
            </div>
          </div>
          <details className="open-questions">
            <summary>仍需追问的 3 个阻塞项</summary>
            <ol>{openQuestions.map((question) => <li key={question}>{question}</li>)}</ol>
          </details>
        </aside>

        <section className="panel reasoning-panel">
          <div className="panel-heading">
            <div>
              <span className="section-index">02 / 推理树</span>
              <h2>为什么会得出这个方案</h2>
            </div>
            <span className="live-indicator"><i /> 实时推演</span>
          </div>
          <div className="tree-legend">
            <span><i className="legend-fact" />事实</span>
            <span><i className="legend-judgment" />判断</span>
            <span><i className="legend-decision" />决策</span>
          </div>
          <div className="reason-tree">
            <div className="tree-column facts-column">
              {reasonNodes.filter((node) => node.kind === "fact").map((node) => (
                <button
                  key={node.id}
                  className={`reason-node node-${node.kind} ${selectedNodeId === node.id ? "active" : ""}`}
                  onClick={() => setSelectedNodeId(node.id)}
                >
                  <small>{node.eyebrow}</small><strong>{node.title}</strong>
                </button>
              ))}
            </div>
            <div className="tree-arrow" aria-hidden="true">→</div>
            <div className="tree-column judgments-column">
              {reasonNodes.filter((node) => node.kind === "judgment").map((node) => (
                <button
                  key={node.id}
                  className={`reason-node node-${node.kind} ${selectedNodeId === node.id ? "active" : ""}`}
                  onClick={() => setSelectedNodeId(node.id)}
                >
                  <small>{node.eyebrow}</small><strong>{node.title}</strong>
                </button>
              ))}
            </div>
            <div className="tree-arrow" aria-hidden="true">→</div>
            <div className="tree-column decision-column">
              {reasonNodes.filter((node) => node.kind === "decision" || node.kind === "activity").map((node) => (
                <button
                  key={node.id}
                  className={`reason-node node-${node.kind} ${selectedNodeId === node.id ? "active" : ""}`}
                  onClick={() => setSelectedNodeId(node.id)}
                >
                  <small>{node.eyebrow}</small><strong>{node.title}</strong>
                </button>
              ))}
            </div>
          </div>
          <div className="reason-detail">
            <div className="reason-detail-head">
              <StatusPill status={selectedNode.status} />
              <code>{selectedNode.id}</code>
            </div>
            <h3>{selectedNode.title}</h3>
            <p>{selectedNode.rationale}</p>
            <div className="evidence-chain">
              <span>依据链</span>
              {selectedNode.sources.map((source) => <code key={source}>{source}</code>)}
              <i>→</i><code>{selectedNode.id}</code>
            </div>
          </div>
          <div className="lifecycle-strip">
            <div><small>预测型基线</small><strong>合同 · 规则 · 验收</strong></div>
            <span>＋</span>
            <div><small>短周期迭代</small><strong>流程 · 引擎 · 交互</strong></div>
            <span>＋</span>
            <div><small>阶段门</small><strong>基线 · 试点 · 验收</strong></div>
          </div>
        </section>

        <aside className="panel preview-panel">
          <div className="panel-heading preview-heading">
            <div>
              <span className="section-index">03 / 实时预览</span>
              <h2>项目章程</h2>
            </div>
            <div className="document-health"><strong>26</strong><span>/ 30 字段</span></div>
          </div>
          <div className="preview-tabs" role="tablist" aria-label="章程章节">
            {["摘要", "目标与范围", "里程碑", "批准"].map((tab) => (
              <button
                role="tab"
                aria-selected={previewTab === tab}
                className={previewTab === tab ? "active" : ""}
                onClick={() => setPreviewTab(tab)}
                key={tab}
              >{tab}</button>
            ))}
          </div>
          <article className="document-sheet">
            <header className="document-coverline">
              <div><span>PROJECT CHARTER</span><small>推演草案 · v0.1</small></div>
              <strong>BIM规划报建<br />平台项目</strong>
            </header>

            {previewTab === "摘要" && (
              <div className="document-section">
                <FieldLabel label="项目目的" status="inferred" sources="INT-002 · D-LIFECYCLE" />
                <p className="document-lead">{purposeText}</p>
                <FieldLabel label="推荐管理方法" status="recommended" sources="D-LIFECYCLE" />
                <div className="method-card">
                  <span>混合型生命周期</span>
                  <p>关键约束预测治理，产品体验迭代验证，固定集成列车与阶段门衔接。</p>
                </div>
                <FieldLabel label="预期价值" status="assumed" sources="INT-005" />
                <ul className="clean-list">
                  <li>形成报建材料、BIM 模型、审查意见和法规依据的统一工作入口</li>
                  <li>缩短人工审查与反复沟通周期，提高审查标准化和透明度</li>
                  <li>沉淀可复用的规则引擎、模型底座与可追溯审查证据链</li>
                </ul>
              </div>
            )}

            {previewTab === "目标与范围" && (
              <div className="document-section">
                <FieldLabel label="可测量目标" status="assumed" sources="INT-009 · A-PILOT" />
                <div className="metric-grid">
                  <div><strong>≥ 98%</strong><span>智能审查准确率</span></div>
                  <div><strong>≤ 10min</strong><span>10G 模型审查</span></div>
                  <div><strong>≤ 3min</strong><span>10G 模型加载</span></div>
                  <div><strong>≥ 90</strong><span>试点用户满意度</span></div>
                </div>
                <FieldLabel label="主要可交付成果" status="inferred" sources="INT-003 · INT-018" />
                <ol className="number-list">{deliverables.map((item) => <li key={item}>{item}</li>)}</ol>
                <FieldLabel label="明确排除" status="assumed" sources="INT-008" />
                <p>不包含设计院 BIM 建模服务、建筑方案设计、施工阶段协同、工程造价管理和物业运维。</p>
              </div>
            )}

            {previewTab === "里程碑" && (
              <div className="document-section">
                <FieldLabel label="高层级里程碑" status="inferred" sources="INT-018 · D-LIFECYCLE" />
                <div className="milestone-list">
                  {milestones.map(([name, date], index) => (
                    <div key={name}><span>{String(index + 1).padStart(2, "0")}</span><strong>{name}</strong><time>{date}</time></div>
                  ))}
                </div>
                <FieldLabel label="试点与验收门槛" status="recommended" sources="A-PILOT" />
                <p>法规规则基线、数据安全、模型兼容性和性能评审通过后进入真实项目试点，以 30 天稳定运行和业务指标决定验收。</p>
              </div>
            )}

            {previewTab === "批准" && (
              <div className="document-section">
                <FieldLabel label="正式授权" status="missing" sources="OPEN-002" />
                <div className="missing-callout">
                  <span>批准前必须补齐</span>
                  <strong>发起人、项目经理姓名与授权边界</strong>
                  <p>这不会阻止继续推演，但导出时会保留醒目的待确认标记。</p>
                </div>
                <div className="signature-grid">
                  <div><span>项目发起人</span><i /><small>签字 / 日期</small></div>
                  <div><span>项目经理</span><i /><small>接受授权 / 日期</small></div>
                </div>
              </div>
            )}
          </article>
          <div className="preview-footer">
            <div className="completion-copy"><i /><span><strong>可继续推演</strong>4 个批准阻塞项保留为待确认</span></div>
            <button className="button button-dark" onClick={goToRisk}>继续：识别风险 <span>→</span></button>
          </div>
        </aside>
      </section>
      <DocumentWorkspace areaId="integration" />
    </main>
  );
}

function FieldLabel({
  label,
  status,
  sources,
}: {
  label: string;
  status: EvidenceStatus;
  sources: string;
}) {
  return (
    <div className="field-label">
      <strong>{label}</strong>
      <span>{statusLabels[status]} · {sources}</span>
    </div>
  );
}

function RiskPage() {
  const [risks, setRisks] = useState<Risk[]>(initialRisks);
  const [assessmentMode, setAssessmentMode] = useState<AssessmentMode>("inherent");
  const [selectedRiskId, setSelectedRiskId] = useState("RISK-002");
  const [ratingFilter, setRatingFilter] = useState<Rating | "All">("All");
  const [selectedCell, setSelectedCell] = useState<string | null>(null);

  const selectedRisk = risks.find((risk) => risk.id === selectedRiskId) ?? risks[0];
  const probabilities = [5, 4, 3, 2, 1];
  const impacts = [1, 2, 3, 4, 5];

  const getAssessment = (risk: Risk) =>
    assessmentMode === "inherent"
      ? { probability: risk.probability, impact: risk.impact, rating: risk.rating }
      : {
          probability: risk.residualProbability,
          impact: risk.residualImpact,
          rating: risk.residualRating,
        };

  const counts = useMemo(() => {
    const next: Record<Rating, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    risks.forEach((risk) => next[getAssessment(risk).rating]++);
    return next;
    // getAssessment changes with assessmentMode by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [risks, assessmentMode]);

  const filteredRisks = risks.filter((risk) => {
    const assessment = getAssessment(risk);
    const matchesRating = ratingFilter === "All" || assessment.rating === ratingFilter;
    const matchesCell = !selectedCell || selectedCell === `${assessment.probability}-${assessment.impact}`;
    return matchesRating && matchesCell;
  });

  const updateSelectedRisk = (patch: Partial<Risk>) => {
    setRisks((current) =>
      current.map((risk) => {
        if (risk.id !== selectedRiskId) return risk;
        const updated = { ...risk, ...patch };
        if (assessmentMode === "inherent") {
          updated.rating = ratingFor(updated.probability, updated.impact, updated.category);
        } else {
          updated.residualRating = ratingFor(
            updated.residualProbability,
            updated.residualImpact,
            updated.category,
          );
        }
        return updated;
      }),
    );
  };

  const addRisk = () => {
    const nextId = `RISK-${String(risks.length + 1).padStart(3, "0")}`;
    const nextRisk: Risk = {
      id: nextId,
      riskType: "threat",
      category: "待分类",
      title: "新风险：点击右侧补充描述",
      cause: "请补充风险原因。",
      owner: "待指定",
      strategy: "减轻",
      probability: 3,
      impact: 3,
      rating: "Medium",
      residualProbability: 2,
      residualImpact: 2,
      residualRating: "Low",
      status: "已识别",
    };
    setRisks((current) => [...current, nextRisk]);
    setSelectedRiskId(nextId);
    setSelectedCell(null);
  };

  const chooseCell = (probability: number, impact: number) => {
    const key = `${probability}-${impact}`;
    setSelectedCell((current) => (current === key ? null : key));
    setRatingFilter("All");
  };

  const activeAssessment = getAssessment(selectedRisk);

  return (
    <main>
      <section className="management-activity-intro">
        <div>
          <span className="section-index">项目风险管理 · 识别风险</span>
          <h1>风险登记册与概率影响矩阵</h1>
          <p>风险不只是清单。看清概率、影响与责任人，再比较应对前后位置是否真的发生变化。</p>
        </div>
        <div className="management-intro-stats">
          <div><span>已识别</span><strong>{risks.length}</strong></div>
          <div><span>威胁</span><strong>{risks.filter((risk) => risk.riskType === "threat").length}</strong></div>
          <div><span>机会</span><strong>{risks.filter((risk) => risk.riskType === "opportunity").length}</strong></div>
        </div>
      </section>
      <ActivityInputOutputSummary process={managementAreaById.risk.processes[1]} />

      <section className="risk-toolbar">
        <div className="risk-back-and-title">
          <div><span className="section-index">当前成果</span><h2>识别、评分并维护项目风险</h2></div>
        </div>
        <div className="assessment-toggle" aria-label="评估口径">
          <button
            className={assessmentMode === "inherent" ? "active" : ""}
            onClick={() => { setAssessmentMode("inherent"); setSelectedCell(null); }}
          >固有风险</button>
          <button
            className={assessmentMode === "residual" ? "active" : ""}
            onClick={() => { setAssessmentMode("residual"); setSelectedCell(null); }}
          >剩余风险</button>
        </div>
      </section>

      <section className="risk-stats" aria-label="风险等级概览">
        {(["Critical", "High", "Medium", "Low"] as Rating[]).map((rating) => (
          <button
            key={rating}
            className={`risk-stat risk-stat-${rating.toLowerCase()} ${ratingFilter === rating ? "active" : ""}`}
            onClick={() => { setRatingFilter((current) => current === rating ? "All" : rating); setSelectedCell(null); }}
          >
            <span>{ratingLabels[rating]}风险</span>
            <strong>{counts[rating]}</strong>
            <small>{assessmentMode === "inherent" ? "应对前" : "应对后"}</small>
          </button>
        ))}
        <div className="risk-stat-change">
          <span>结构变化</span>
          <strong>{assessmentMode === "inherent" ? "1 极高 → 0 极高" : "4 项降至中低"}</strong>
          <small>切换口径比较应对效果</small>
        </div>
      </section>

      <section className="risk-main-grid">
        <div className="panel matrix-panel">
          <div className="panel-heading">
            <div><span className="section-index">概率 × 影响</span><h2>{assessmentMode === "inherent" ? "固有" : "剩余"}风险矩阵</h2></div>
            {selectedCell && <button className="clear-filter" onClick={() => setSelectedCell(null)}>清除单元格筛选 ×</button>}
          </div>
          <div className="matrix-wrap">
            <div className="axis-label axis-probability">概率</div>
            <div className="matrix-y-labels" aria-hidden="true">
              {probabilities.map((probability) => <span key={probability}>{probability}<small>{["", "很低", "较低", "中等", "较高", "很高"][probability]}</small></span>)}
            </div>
            <div className="matrix-grid">
              {probabilities.flatMap((probability) =>
                impacts.map((impact) => {
                  const cellRisks = risks.filter((risk) => {
                    const assessment = getAssessment(risk);
                    return assessment.probability === probability && assessment.impact === impact;
                  });
                  const cellRating = ratingFor(probability, impact);
                  const key = `${probability}-${impact}`;
                  return (
                    <button
                      key={key}
                      className={`matrix-cell matrix-${cellRating.toLowerCase()} ${selectedCell === key ? "active" : ""}`}
                      onClick={() => chooseCell(probability, impact)}
                      aria-label={`概率 ${probability}，影响 ${impact}，${cellRisks.length} 项风险`}
                    >
                      <small>{probability * impact}</small>
                      <span className="risk-dots">
                        {cellRisks.map((risk) => (
                          <i className={risk.riskType === "opportunity" ? "opportunity" : ""} key={risk.id} title={risk.title}>
                            {risk.id.replace("RISK-", "")}
                          </i>
                        ))}
                      </span>
                    </button>
                  );
                }),
              )}
            </div>
            <div className="matrix-x-labels" aria-hidden="true">
              {impacts.map((impact) => <span key={impact}>{impact}<small>{["", "很低", "较低", "中等", "较高", "很高"][impact]}</small></span>)}
            </div>
            <div className="axis-label axis-impact">影响 →</div>
          </div>
          <div className="matrix-legend">
            <span><i className="legend-low" />低 1–4</span>
            <span><i className="legend-medium" />中 5–9</span>
            <span><i className="legend-high" />高 10–16</span>
            <span><i className="legend-critical" />极高 17–25</span>
            <p>安全/合规影响为 5 时，最低按“高”处理。</p>
          </div>
        </div>

        <aside className="panel risk-editor-panel">
          <div className="panel-heading">
            <div><span className="section-index">风险详情</span><h2>{selectedRisk.id}</h2></div>
            <RatingPill rating={activeAssessment.rating} />
          </div>
          <div className="risk-type-line">
            <span className={selectedRisk.riskType === "opportunity" ? "type-opportunity" : "type-threat"}>
              {selectedRisk.riskType === "opportunity" ? "+ 机会" : "− 威胁"}
            </span>
            <span>{selectedRisk.category}</span>
          </div>
          <label className="editor-field">
            <span>风险描述</span>
            <textarea value={selectedRisk.title} onChange={(event) => updateSelectedRisk({ title: event.target.value })} rows={3} />
          </label>
          <label className="editor-field">
            <span>原因</span>
            <textarea value={selectedRisk.cause} onChange={(event) => updateSelectedRisk({ cause: event.target.value })} rows={3} />
          </label>
          <div className="score-editor">
            <label>
              <span>概率</span>
              <select
                value={activeAssessment.probability}
                onChange={(event) =>
                  updateSelectedRisk(
                    assessmentMode === "inherent"
                      ? { probability: Number(event.target.value) }
                      : { residualProbability: Number(event.target.value) },
                  )
                }
              >
                {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <span>×</span>
            <label>
              <span>影响</span>
              <select
                value={activeAssessment.impact}
                onChange={(event) =>
                  updateSelectedRisk(
                    assessmentMode === "inherent"
                      ? { impact: Number(event.target.value) }
                      : { residualImpact: Number(event.target.value) },
                  )
                }
              >
                {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <span>=</span>
            <div className="score-result"><strong>{scoreFor(activeAssessment.probability, activeAssessment.impact)}</strong><small>{ratingLabels[activeAssessment.rating]}</small></div>
          </div>
          <div className="editor-two-col">
            <label className="editor-field"><span>责任人</span><input value={selectedRisk.owner} onChange={(event) => updateSelectedRisk({ owner: event.target.value })} /></label>
            <label className="editor-field"><span>应对策略</span><select value={selectedRisk.strategy} onChange={(event) => updateSelectedRisk({ strategy: event.target.value })}><option>规避</option><option>减轻</option><option>转移</option><option>接受</option><option>提高</option><option>分享</option></select></label>
          </div>
          <div className="score-explanation">
            <span>评分说明</span>
            <p>
              {selectedRisk.category.includes("安全") || selectedRisk.category.includes("合规")
                ? "该项触发安全/合规兜底规则：即使发生概率降低，影响为 5 时仍至少保留为高风险。"
                : `当前评分为 ${activeAssessment.probability} × ${activeAssessment.impact} = ${scoreFor(activeAssessment.probability, activeAssessment.impact)}，落入${ratingLabels[activeAssessment.rating]}风险区间。`}
            </p>
          </div>
        </aside>
      </section>

      <section className="panel register-panel">
        <div className="register-heading">
          <div>
            <span className="section-index">动态登记册</span>
            <h2>{selectedCell ? `矩阵位置 ${selectedCell.replace("-", " × ")} 的风险` : ratingFilter === "All" ? "全部风险" : `${ratingLabels[ratingFilter]}风险`}</h2>
          </div>
          <div className="register-actions">
            <span>显示 {filteredRisks.length} / {risks.length} 项</span>
            <button className="button button-dark button-small" onClick={addRisk}>＋ 添加风险</button>
          </div>
        </div>
        <div className="risk-table-wrap">
          <table className="risk-table">
            <thead><tr><th>编号</th><th>风险</th><th>类别</th><th>概率</th><th>影响</th><th>评分</th><th>等级</th><th>责任人</th><th>策略</th><th>状态</th></tr></thead>
            <tbody>
              {filteredRisks.map((risk) => {
                const assessment = getAssessment(risk);
                return (
                  <tr key={risk.id} className={selectedRiskId === risk.id ? "selected" : ""}>
                    <td><code>{risk.id}</code></td>
                    <td><button className="risk-title-button" onClick={() => setSelectedRiskId(risk.id)}><span>{risk.riskType === "opportunity" ? "+" : "−"}</span>{risk.title}</button></td>
                    <td>{risk.category}</td>
                    <td>{assessment.probability}</td>
                    <td>{assessment.impact}</td>
                    <td><strong>{scoreFor(assessment.probability, assessment.impact)}</strong></td>
                    <td><RatingPill rating={assessment.rating} /></td>
                    <td>{risk.owner}</td>
                    <td>{risk.strategy}</td>
                    <td><span className="table-status">{risk.status}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredRisks.length === 0 && <div className="empty-state"><strong>这里还没有风险</strong><p>清除筛选，或在这个位置添加一条新风险。</p></div>}
      </section>
      <DocumentWorkspace areaId="risk" />
    </main>
  );
}

export function PrototypeApp() {
  const [section, setSection] = useState<PrimarySection>("knowledge");
  const [page, setPage] = useState<ProductPage>("overview");
  const [toast, setToast] = useState<string | null>(null);

  const showExportToast = () => {
    window.dispatchEvent(new CustomEvent("pm-atlas-export-word"));
    setToast("正在生成当前文档 Word…");
    window.setTimeout(() => setToast(null), 3200);
  };

  const switchPage = (nextPage: ProductPage) => {
    setSection("lab");
    setPage(nextPage);
    window.history.replaceState(null, "", `#lab-${nextPage}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="app-shell">
      <AppHeader
        section={section}
        setSection={setSection}
        onExport={showExportToast}
        canExport={section === "lab" && page !== "overview"}
      />
      {section === "lab" && (
        <>
          <LabSubnav page={page} setPage={switchPage} />
          <ProjectContext page={page} />
          {page !== "overview" && <ManagementProcessStrip page={page} />}
        </>
      )}
      {section === "knowledge" ? (
        <KnowledgeLibrary />
      ) : page === "overview" ? (
        <ProjectInitiation onNavigate={switchPage} />
      ) : page === "integration" ? (
        <CharterPage onContinue={() => switchPage("risk")} />
      ) : page === "risk" ? (
        <RiskPage />
      ) : page === "stakeholder" ? (
        <StakeholderPage />
      ) : (
        <ManagementAreaPage area={managementAreaById[page]} />
      )}
      <footer className="app-footer">
        <span>PM Atlas · 信息系统项目管理知识实验室</span>
        <span>{section === "knowledge" ? "知识库 · 教材分类与关系模型" : `样本：${CASE_PROJECT_NAME} · 本地原型`}</span>
      </footer>
      {toast && <div className="toast" role="status"><i>✓</i>{toast}</div>}
    </div>
  );
}
