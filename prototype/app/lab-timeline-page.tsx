"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type TakeoverPoint = {
  scenarioId: string;
  week: number;
  label: string;
};

type CaseManifest = {
  caseId: string;
  caseVersion: string;
  totalWeeks: number;
  takeoverPoints: TakeoverPoint[];
};

type BranchContext = {
  id: string;
  currentWeek: number;
  currentRoundNumber: number;
  status: string;
};

type MaterialSummary = {
  id: string;
  group: string;
  type: string;
  channel: string | null;
  title: string;
  opened: boolean;
};

type MaterialList = {
  openedCount: number;
  totalCount: number;
  cardsUnlocked: boolean;
  materials: MaterialSummary[];
};

type PublicCard = {
  id: string;
  column: "evidence_document" | "tool_technique" | "execution_action" | "stakeholder";
  referenceId: string;
  title: string;
};

type OpenedMaterial = {
  id: string;
  subject?: string;
  displayLabel?: string;
  channel?: string;
  facts?: string[];
  documentIds?: string[];
  [key: string]: unknown;
};

type BranchCreation = {
  branch: BranchContext;
  scenario: {
    id: string;
    week: number;
    title: string;
    entrySignals: string[];
    availableMaterialCount: number;
    cardsUnlocked: boolean;
  };
  initialState: {
    baseline: Record<string, unknown>;
    scenario: { initialImpact: Record<string, unknown> };
  };
};

const caseId = "car-control";
const caseVersion = "v1";
const milestones = [
  { week: 1, label: "启动" },
  { week: 8, label: "范围基线" },
  { week: 12, label: "架构门" },
  { week: 20, label: "集成门" },
  { week: 28, label: "上线门" },
  { week: 32, label: "收尾" },
];
const scenarioLabels: Record<string, string> = {
  "scenario-1": "需求变更",
  "scenario-2": "供应与资源",
  "scenario-3": "安全发布",
};
const materialGroupLabels: Record<string, string> = {
  primaryClues: "主要线索",
  corroboratingClues: "交叉验证",
  dashboardAnomalies: "仪表盘告警",
};
const cardColumnLabels: Record<PublicCard["column"], string> = {
  evidence_document: "证据文档",
  tool_technique: "工具与技术",
  execution_action: "执行行动",
  stakeholder: "干系人",
};

function branchFromHash(): { branchId: string; scenarioId: string } | null {
  if (typeof window === "undefined") return null;
  const query = window.location.hash.split("?", 2)[1];
  if (!query) return null;
  const parameters = new URLSearchParams(query);
  const branchId = parameters.get("branch");
  const scenarioId = parameters.get("scenario");
  return branchId && scenarioId ? { branchId, scenarioId } : null;
}

function signIn() {
  window.location.href = `/signin-with-chatgpt?return_to=${encodeURIComponent(window.location.pathname + window.location.hash)}`;
}

async function apiJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (response.status === 401) {
    signIn();
    throw new Error("需要登录后继续");
  }
  const body = await response.json() as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message ?? "请求失败，请稍后重试");
  return body;
}

function formatMoney(value: unknown): string {
  return typeof value === "number" ? `${(value / 10000).toFixed(1)} 万` : "—";
}

export function LabTimelinePage() {
  const [manifest, setManifest] = useState<CaseManifest | null>(null);
  const [branch, setBranch] = useState<BranchContext | null>(null);
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [scenarioTitle, setScenarioTitle] = useState<string | null>(null);
  const [initialState, setInitialState] = useState<BranchCreation["initialState"] | null>(null);
  const [materials, setMaterials] = useState<MaterialList | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<OpenedMaterial | null>(null);
  const [cards, setCards] = useState<PublicCard[]>([]);
  const [loadingScenarioId, setLoadingScenarioId] = useState<string | null>(null);
  const [openingMaterialId, setOpeningMaterialId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const idempotencyKeys = useRef(new Map<string, string>());

  const loadMaterials = async (branchId: string, nextScenarioId: string) => {
    const list = await apiJson<MaterialList>(
      `/api/lab/branches/${encodeURIComponent(branchId)}/scenarios/${encodeURIComponent(nextScenarioId)}/materials`,
    );
    setMaterials(list);
    if (list.cardsUnlocked) {
      const projection = await apiJson<{ scenario: { cards: PublicCard[]; title: string } }>(
        `/api/lab/branches/${encodeURIComponent(branchId)}/scenarios/${encodeURIComponent(nextScenarioId)}/projection`,
      );
      setCards(projection.scenario.cards);
      setScenarioTitle(projection.scenario.title);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
      try {
        const nextManifest = await apiJson<CaseManifest>(`/api/lab/cases/${caseId}/${caseVersion}`);
        if (cancelled) return;
        setManifest(nextManifest);
        const restored = branchFromHash();
        if (!restored) return;
        const projection = await apiJson<{ branch: BranchContext; scenario: { title: string; cards: PublicCard[] } }>(
          `/api/lab/branches/${encodeURIComponent(restored.branchId)}/scenarios/${encodeURIComponent(restored.scenarioId)}/projection`,
        );
        if (cancelled) return;
        setBranch(projection.branch);
        setScenarioId(restored.scenarioId);
        setScenarioTitle(projection.scenario.title);
        setCards(projection.scenario.cards);
        await loadMaterials(restored.branchId, restored.scenarioId);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "无法加载项目实验室");
      }
    };
    void initialize();
    return () => {
      cancelled = true;
    };
  }, []);

  const takeover = async (point: TakeoverPoint) => {
    setLoadingScenarioId(point.scenarioId);
    setError(null);
    try {
      let idempotencyKey = idempotencyKeys.current.get(point.scenarioId);
      if (!idempotencyKey) {
        idempotencyKey = crypto.randomUUID();
        idempotencyKeys.current.set(point.scenarioId, idempotencyKey);
      }
      const created = await apiJson<BranchCreation>(`/api/lab/cases/${caseId}/${caseVersion}/branches`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenarioId: point.scenarioId, idempotencyKey }),
      });
      setBranch(created.branch);
      setScenarioId(created.scenario.id);
      setScenarioTitle(created.scenario.title);
      setInitialState(created.initialState);
      setSelectedMaterial(null);
      setCards([]);
      window.history.replaceState(
        null,
        "",
        `#lab-schedule?branch=${encodeURIComponent(created.branch.id)}&scenario=${encodeURIComponent(created.scenario.id)}`,
      );
      await loadMaterials(created.branch.id, created.scenario.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "无法创建个人分支");
    } finally {
      setLoadingScenarioId(null);
    }
  };

  const openMaterial = async (material: MaterialSummary) => {
    if (!branch || !scenarioId) return;
    setOpeningMaterialId(material.id);
    setError(null);
    try {
      const opened = await apiJson<{
        material: OpenedMaterial;
        openedCount: number;
        totalCount: number;
        cardsUnlocked: boolean;
        cards: PublicCard[];
      }>(
        `/api/lab/branches/${encodeURIComponent(branch.id)}/scenarios/${encodeURIComponent(scenarioId)}/materials/${encodeURIComponent(material.id)}/view`,
        { method: "POST" },
      );
      setSelectedMaterial(opened.material);
      setMaterials((current) => current ? {
        ...current,
        openedCount: opened.openedCount,
        totalCount: opened.totalCount,
        cardsUnlocked: opened.cardsUnlocked,
        materials: current.materials.map((item) => item.id === material.id ? { ...item, opened: true } : item),
      } : current);
      if (opened.cardsUnlocked) setCards(opened.cards);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "无法打开材料");
    } finally {
      setOpeningMaterialId(null);
    }
  };

  const cardsByColumn = useMemo(() => Object.fromEntries(
    Object.keys(cardColumnLabels).map((column) => [column, cards.filter((card) => card.column === column)]),
  ) as Record<PublicCard["column"], PublicCard[]>, [cards]);
  const baseline = initialState?.baseline ?? {};
  const scenarioImpact = initialState?.scenario.initialImpact ?? {};

  return (
    <main className="lab-timeline-page">
      <section className="lab-timeline-hero">
        <div>
          <span className="section-index">项目实验室 · 学习模式 · car-control:v1</span>
          <h1>先看最优解，再从关键节点接手。</h1>
          <p>拖看 32 周主线，在三个高价值情景点建立个人分支。事件不会直接告诉你答案，需要逐项打开工作材料、识别信号，再进入行动链。</p>
        </div>
        <div className="lab-timeline-hero-stats">
          <div><span>项目周期</span><strong>32 周</strong></div>
          <div><span>核心团队</span><strong>8 人</strong></div>
          <div><span>项目预算</span><strong>260 万</strong></div>
          <div><span>推演情景</span><strong>3 个</strong></div>
        </div>
      </section>

      <section className="lab-mainline-panel panel" aria-label="项目主线时间轴">
        <header className="lab-mainline-heading">
          <div><span className="section-index">主线 · 最短成功路径</span><h2>车主远程控车应用项目</h2></div>
          <span className="lab-mainline-status"><i /> 主线已完成</span>
        </header>
        <div className="lab-mainline-track" aria-label="第1周至第32周">
          <div className="lab-mainline-rail" />
          {milestones.map((milestone) => (
            <div className="lab-milestone" key={milestone.week} style={{ left: `${((milestone.week - 1) / 31) * 100}%` }}>
              <i /><strong>W{milestone.week}</strong><span>{milestone.label}</span>
            </div>
          ))}
          {manifest?.takeoverPoints.map((point) => (
            <button
              className={`lab-takeover-point ${scenarioId === point.scenarioId ? "active" : ""}`}
              key={point.scenarioId}
              style={{ left: `${((point.week - 1) / 31) * 100}%` }}
              disabled={Boolean(branch) || loadingScenarioId !== null}
              onClick={() => void takeover(point)}
              aria-label={`第${point.week}周${point.label}：${scenarioLabels[point.scenarioId]}`}
            >
              <span>{loadingScenarioId === point.scenarioId ? "正在接手…" : point.label}</span>
              <strong>W{point.week}</strong>
              <small>{scenarioLabels[point.scenarioId]}</small>
            </button>
          ))}
        </div>
        <div className="lab-week-scale" aria-hidden="true">
          {Array.from({ length: manifest?.totalWeeks ?? 32 }, (_, index) => <span key={index}>{index + 1}</span>)}
        </div>
      </section>

      {error && <div className="lab-api-error" role="alert"><strong>暂时无法继续</strong><span>{error}</span></div>}

      {!branch ? (
        <section className="lab-takeover-guide">
          <span>01</span><div><strong>选择一个“从这里接手”节点</strong><p>系统会复制该周主线状态，创建只属于你的不可变分支根节点。</p></div>
          <span>02</span><div><strong>逐项打开真实工作材料</strong><p>供应商邮件、测试报告、干系人消息和仪表盘告警将按工作方式出现。</p></div>
          <span>03</span><div><strong>识别充分后构建行动链</strong><p>全部必要信号被观察后，才会开放文档、工具、行动和干系人卡片。</p></div>
        </section>
      ) : (
        <>
          <section className="lab-branch-banner">
            <div><span>个人分支</span><strong>{scenarioTitle}</strong><small>{branch.id}</small></div>
            <div><span>当前位置</span><strong>W{branch.currentWeek} · 回合 {branch.currentRoundNumber}</strong><small>学习模式 · 云端已保存</small></div>
            <div><span>材料进度</span><strong>{materials?.openedCount ?? 0} / {materials?.totalCount ?? 0}</strong><small>{materials?.cardsUnlocked ? "行动卡已解锁" : "请继续观察线索"}</small></div>
          </section>

          {initialState && (
            <section className="lab-takeover-dashboard">
              <div><span>SPI</span><strong>{String(baseline.spi ?? "—")}</strong><small>主线接手周</small></div>
              <div><span>CPI</span><strong>{String(baseline.cpi ?? "—")}</strong><small>主线接手周</small></div>
              <div><span>累计 AC</span><strong>{formatMoney(baseline.cumulativeActualCostCny)}</strong><small>BAC 260 万</small></div>
              <div><span>预测完工</span><strong>W{String(scenarioImpact.forecastCompletionWeek ?? 32)}</strong><small>初始客观冲击</small></div>
            </section>
          )}

          <section className="lab-material-workspace">
            <aside className="lab-material-inbox panel">
              <header><div><span className="section-index">事件材料</span><h2>项目经理收件箱</h2></div><strong>{materials?.openedCount ?? 0}/{materials?.totalCount ?? 0}</strong></header>
              <div className="lab-material-list">
                {materials?.materials.map((material) => (
                  <button
                    className={`${material.opened ? "opened" : ""} ${selectedMaterial?.id === material.id ? "active" : ""}`}
                    key={material.id}
                    disabled={openingMaterialId !== null}
                    onClick={() => void openMaterial(material)}
                  >
                    <i>{material.opened ? "✓" : "·"}</i>
                    <span><small>{materialGroupLabels[material.group] ?? material.type}</small><strong>{material.title}</strong><em>{material.channel ?? "项目仪表盘"}</em></span>
                    <b>{openingMaterialId === material.id ? "读取中" : material.opened ? "再看" : "打开"}</b>
                  </button>
                ))}
              </div>
            </aside>

            <article className="lab-material-reader panel">
              {selectedMaterial ? (
                <>
                  <header><span className="section-index">{selectedMaterial.id} · 已记录查看</span><h2>{selectedMaterial.subject ?? selectedMaterial.displayLabel ?? "项目状态信号"}</h2><p>{selectedMaterial.channel ? `来源：${selectedMaterial.channel}` : "来源：项目仪表盘"}</p></header>
                  {selectedMaterial.facts?.length ? <ul>{selectedMaterial.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul> : null}
                  {selectedMaterial.documentIds?.length ? <div className="lab-material-docs"><span>关联文件</span>{selectedMaterial.documentIds.map((id) => <strong key={id}>{id}</strong>)}</div> : null}
                  <footer><span>系统只呈现客观事实，不提示风险类别或正确决策。</span></footer>
                </>
              ) : (
                <div className="lab-material-empty"><span>未读</span><h2>点击左侧材料开始观察</h2><p>先看事实，再判断风险或根因；所有查看记录会进入最终 AI 复盘证据。</p></div>
              )}
            </article>
          </section>

          <section className={`lab-card-unlock ${materials?.cardsUnlocked ? "unlocked" : ""}`}>
            <header>
              <div><span className="section-index">行动链电池组</span><h2>{materials?.cardsUnlocked ? "候选卡已解锁" : "观察完成后解锁行动卡"}</h2></div>
              <strong>{materials?.cardsUnlocked ? `${cards.length} 张候选卡` : `${materials?.openedCount ?? 0}/${materials?.totalCount ?? 0} 条材料`}</strong>
            </header>
            {materials?.cardsUnlocked ? (
              <div className="lab-card-columns">
                {(Object.keys(cardColumnLabels) as PublicCard["column"][]).map((column) => (
                  <section key={column}><span>{cardColumnLabels[column]}</span>{cardsByColumn[column].map((card) => <article key={card.id}><small>{card.id}</small><strong>{card.title}</strong></article>)}</section>
                ))}
              </div>
            ) : (
              <div className="lab-card-locked"><i>锁定</i><p>还有 {(materials?.totalCount ?? 0) - (materials?.openedCount ?? 0)} 条材料未查看。</p></div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
