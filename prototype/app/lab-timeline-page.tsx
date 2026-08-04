"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

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

type BaselineWeek = {
  week: number;
  sprint: string | null;
  plannedTeamPersonDays: number;
  cumulativePlannedValueCny: number;
  cumulativeEarnedValueCny: number;
  cumulativeActualCostCny: number;
  spi: number;
  cpi: number;
  rolePersonDays: Record<string, number>;
  workPackagePersonDays: Record<string, number>;
};

type WorkPackage = {
  id: string;
  title: string;
  startWeek: number;
  endWeek: number;
};

type ScheduleActivity = {
  id: string;
  parentId: string;
  title: string;
  startWeek: number;
  endWeek: number;
  predecessors?: Array<{ activityId: string; type: string; lagWeeks: number }>;
};

type Stakeholder = {
  id: string;
  title: string;
  initialEngagement: {
    power: number;
    interest: number;
    current: string;
    desired: string;
  };
};

type StakeholderEvent = {
  week: number;
  stakeholderId: string;
  current: string;
  desired?: string;
  evidence: string[];
};

type RaciRow = {
  workPackageId: string;
  A: string[];
  R: string[];
  C: string[];
  I: string[];
};

type ProjectDocument = {
  id: string;
  title: string;
  coverage: string;
  createdWeek: number;
};

type DocumentEvent = {
  id: string;
  week: number;
  reason: string;
  [key: string]: unknown;
};

type DocumentRelation = {
  id: string;
  fromDocumentId: string;
  toDocumentId: string;
  type: string;
  reason: string;
  effectiveWeek: number;
};

type RiskItem = {
  id: string;
  title: string;
  owner: string;
  inherent: { probability: number; impact: number };
  residual: { probability: number; impact: number };
};

type RiskEvent = {
  week: number;
  riskIds: string[];
  toLifecycleState: string;
  controlStatus?: string;
};

type QualitySeries = {
  metricId: string;
  interpolation: "linear" | "step";
  anchors: Array<{ week: number; value: number | boolean }>;
};

type NetworkActivity = {
  activityId: string;
  earliestStart: number;
  earliestFinish: number;
  latestStart: number;
  latestFinish: number;
  totalFloat: number;
  freeFloat: number;
  isCritical: boolean;
};

type MainlineData = {
  workload: {
    budgetAtCompletionCny: number;
    roles: Array<{ id: string; title: string }>;
    workPackages: WorkPackage[];
  };
  schedule: { activities: ScheduleActivity[] };
  stakeholders: {
    stakeholders: Stakeholder[];
    mainlineEngagementEvents: StakeholderEvent[];
    workPackageRaci: RaciRow[];
  };
  documents: {
    documents: ProjectDocument[];
    mainlineEvents: DocumentEvent[];
    relations: DocumentRelation[];
  };
  risks: {
    initialRisks: RiskItem[];
    mainlineLifecycleEvents: RiskEvent[];
  };
  quality: { mainlineSeries: QualitySeries[] };
  baselineWorkload: {
    totalPlannedPersonDays: number;
    weeks: BaselineWeek[];
    scheduleNetwork: {
      deadlineWeek: number;
      calculatedProjectFinishWeek: number;
      criticalActivityIds: string[];
      activities: NetworkActivity[];
    };
  };
};

type MainlineResponse = {
  week: number | null;
  sections: MainlineData;
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
    entrySignals?: string[];
    availableMaterialCount?: number;
    cardsUnlocked?: boolean;
  };
};

type DashboardId =
  | "spi"
  | "cpi"
  | "bac"
  | "ac"
  | "gantt"
  | "workload"
  | "engagement"
  | "raci"
  | "risk-matrix"
  | "requirements"
  | "burndown"
  | "ccb"
  | "network"
  | "wbs"
  | "risk-status";

type ManagementArea = {
  id: string;
  index: string;
  title: string;
  shortTitle: string;
  documentIds: string[];
};

const caseId = "car-control";
const caseVersion = "v1";
const mainlineSections = "workload,schedule,stakeholders,documents,risks,quality,baselineWorkload";
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
  evidence_document: "项目文件",
  tool_technique: "工具与技术",
  execution_action: "执行行动",
  stakeholder: "干系人",
};
const engagementScores: Record<string, number> = {
  unaware: 1,
  resistant: 2,
  neutral: 3,
  supportive: 4,
  leading: 5,
};
const managementAreas: ManagementArea[] = [
  { id: "integration", index: "01", title: "项目整合管理", shortTitle: "整合", documentIds: ["D03", "D05", "D08", "D09", "D10", "D13"] },
  { id: "scope", index: "02", title: "项目范围管理", shortTitle: "范围", documentIds: ["D02", "D16", "D21", "D22"] },
  { id: "schedule", index: "03", title: "项目进度管理", shortTitle: "进度", documentIds: ["D01", "D02", "D04", "D07", "D10", "D12", "D14", "D15", "D28", "D29"] },
  { id: "cost", index: "04", title: "项目成本管理", shortTitle: "成本", documentIds: ["D04", "D06"] },
  { id: "quality", index: "05", title: "项目质量管理", shortTitle: "质量", documentIds: ["D18", "D19", "D20", "D32"] },
  { id: "resource", index: "06", title: "项目资源管理", shortTitle: "资源", documentIds: ["D11", "D17", "D23", "D24", "D25", "D31"] },
  { id: "communication", index: "07", title: "项目沟通管理", shortTitle: "沟通", documentIds: ["D08", "D13", "D30"] },
  { id: "risk", index: "08", title: "项目风险管理", shortTitle: "风险", documentIds: ["D03", "D08", "D26", "D27"] },
  { id: "procurement", index: "09", title: "项目采购管理", shortTitle: "采购", documentIds: ["D05", "D08", "D13", "D25"] },
  { id: "stakeholder", index: "10", title: "项目干系人管理", shortTitle: "干系人", documentIds: ["D13", "D30"] },
];
const dashboardTitles: Record<DashboardId, string> = {
  spi: "进度绩效指数 SPI",
  cpi: "成本绩效指数 CPI",
  bac: "项目预算 BAC",
  ac: "项目实际花费 AC",
  gantt: "里程碑甘特图",
  workload: "项目工作量",
  engagement: "干系人参与度",
  raci: "干系人 RACI 矩阵",
  "risk-matrix": "风险影响概率矩阵",
  requirements: "需求状态统计",
  burndown: "当前迭代燃尽图",
  ccb: "CCB 待办项状态",
  network: "时标网络图",
  wbs: "WBS",
  "risk-status": "风险状态统计",
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
  window.location.href = `/signin-with-chatgpt?return_to=${encodeURIComponent(window.location.pathname + window.location.search + window.location.hash)}`;
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

function formatMoney(value: number): string {
  return `${(value / 10000).toFixed(value >= 1000000 ? 0 : 1)} 万`;
}

function projectStage(week: number): string {
  if (week <= 8) return "需求与范围基线";
  if (week <= 12) return "架构、接口与安全基线";
  if (week <= 20) return "核心能力开发";
  if (week <= 28) return "集成测试与试点";
  return "上线、移交与收尾";
}

function interpolateSeries(series: QualitySeries | undefined, week: number): number | boolean | null {
  if (!series) return null;
  const anchors = [...series.anchors].sort((left, right) => left.week - right.week);
  if (week < anchors[0].week) return null;
  const previous = [...anchors].reverse().find((anchor) => anchor.week <= week) ?? anchors[0];
  if (series.interpolation === "step" || typeof previous.value === "boolean") return previous.value;
  const next = anchors.find((anchor) => anchor.week > week);
  if (!next || typeof next.value !== "number" || typeof previous.value !== "number") return previous.value;
  const ratio = (week - previous.week) / (next.week - previous.week);
  return previous.value + (next.value - previous.value) * ratio;
}

function documentActions(event: DocumentEvent, documentId: string): string[] {
  return Object.entries(event)
    .filter(([, value]) => Array.isArray(value) && value.includes(documentId))
    .map(([key]) => key);
}

function documentStatus(document: ProjectDocument, events: DocumentEvent[], week: number): string {
  if (document.createdWeek > week) return "未创建";
  const history = events.filter((event) => event.week <= week && documentActions(event, document.id).length > 0);
  const actions = history.flatMap((event) => documentActions(event, document.id));
  if (actions.some((action) => action.toLowerCase().includes("archived"))) return "已归档";
  const latestActions = history.length ? documentActions(history[history.length - 1], document.id) : [];
  if (latestActions.some((action) => action.toLowerCase().includes("baseline"))) return "已基线";
  if (latestActions.some((action) => action.toLowerCase().includes("approved"))) return "已批准";
  if (latestActions.length > 0) return "已更新";
  return "已创建";
}

function Sparkline({ values, target = 1 }: { values: number[]; target?: number }) {
  const width = 220;
  const height = 62;
  const minimum = Math.min(...values, target) - 0.015;
  const maximum = Math.max(...values, target) + 0.015;
  const span = Math.max(maximum - minimum, 0.01);
  const points = values.map((value, index) => {
    const pointX = values.length === 1 ? width : (index / (values.length - 1)) * width;
    const pointY = height - ((value - minimum) / span) * height;
    return `${pointX.toFixed(1)},${pointY.toFixed(1)}`;
  }).join(" ");
  const targetY = height - ((target - minimum) / span) * height;
  return (
    <svg className="lab-v2-sparkline" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="趋势图">
      <line x1="0" x2={width} y1={targetY} y2={targetY} />
      <polyline points={points} />
    </svg>
  );
}

function MiniBars({ values }: { values: number[] }) {
  const maximum = Math.max(...values, 1);
  return <div className="lab-v2-mini-bars">{values.map((value, index) => <i key={`${index}-${value}`} style={{ height: `${Math.max(8, value / maximum * 100)}%` }} />)}</div>;
}

type NetworkLayoutActivity = ScheduleActivity & NetworkActivity & {
  lane: number;
  rowY: number;
};

function WbsCards({ workPackages, activities, selectedWeek }: {
  workPackages: WorkPackage[];
  activities: ScheduleActivity[];
  selectedWeek: number;
}) {
  return (
    <div className="lab-v2-wbs-cards">
        {workPackages.map((workPackage) => {
          const packageActivities = activities.filter((activity) => activity.parentId === workPackage.id);
          const packageCompleted = workPackage.endWeek < selectedWeek;
          const packageActive = workPackage.startWeek <= selectedWeek && workPackage.endWeek >= selectedWeek;
          const packageState = packageCompleted ? "done" : packageActive ? "active" : "planned";
          return (
            <article key={workPackage.id} className={packageState}>
              <header>
                <span><strong>{workPackage.id}</strong><small>{workPackage.title}</small></span>
                <i>{packageCompleted ? "✓ 已完成" : packageActive ? "● 进行中" : "○ 未开始"} · W{workPackage.startWeek}–W{workPackage.endWeek}</i>
              </header>
              <ol>
                {packageActivities.map((activity, activityIndex) => {
                  const completed = activity.endWeek < selectedWeek;
                  const active = activity.startWeek <= selectedWeek && activity.endWeek >= selectedWeek;
                  return (
                    <li key={activity.id} className={completed ? "done" : active ? "active" : "planned"}>
                      <b>{String(activityIndex + 1).padStart(2, "0")}</b>
                      <span>{activity.title}</span>
                      <i>W{activity.startWeek}–W{activity.endWeek}</i>
                    </li>
                  );
                })}
              </ol>
            </article>
          );
        })}
    </div>
  );
}

function TimeScaledNetwork({
  activities,
  network,
  workPackages,
  selectedWeek,
}: {
  activities: ScheduleActivity[];
  network: MainlineData["baselineWorkload"]["scheduleNetwork"];
  workPackages: WorkPackage[];
  selectedWeek: number;
}) {
  const labelWidth = 190;
  const weekWidth = 36;
  const laneHeight = 34;
  const groupGap = 12;
  const topOffset = 42;
  const layout = useMemo(() => {
    const networkById = new Map(network.activities.map((activity) => [activity.activityId, activity]));
    const layoutActivities: NetworkLayoutActivity[] = [];
    const groupBounds: Array<{ id: string; title: string; top: number; bottom: number }> = [];
    let currentY = topOffset;

    for (const workPackage of workPackages) {
      const groupedActivities = activities
        .filter((activity) => activity.parentId === workPackage.id)
        .sort((left, right) => left.startWeek - right.startWeek || left.endWeek - right.endWeek);
      const laneEnds: number[] = [];
      const groupTop = currentY;

      for (const activity of groupedActivities) {
        const networkActivity = networkById.get(activity.id);
        if (!networkActivity) continue;
        let lane = laneEnds.findIndex((endWeek) => endWeek < activity.startWeek);
        if (lane === -1) {
          lane = laneEnds.length;
          laneEnds.push(activity.endWeek);
        } else {
          laneEnds[lane] = activity.endWeek;
        }
        layoutActivities.push({ ...activity, ...networkActivity, lane, rowY: currentY + lane * laneHeight });
      }

      const laneCount = Math.max(laneEnds.length, 1);
      currentY += laneCount * laneHeight;
      groupBounds.push({ id: workPackage.id, title: workPackage.title, top: groupTop, bottom: currentY });
      currentY += groupGap;
    }

    return { activities: layoutActivities, groups: groupBounds, height: currentY + 12 };
  }, [activities, network.activities, workPackages]);
  const layoutById = new Map(layout.activities.map((activity) => [activity.id, activity]));
  const totalWidth = labelWidth + weekWidth * 32 + 18;
  const weekX = (week: number) => labelWidth + (week - 1) * weekWidth;

  return (
    <div className="lab-v2-network-scroll">
      <svg
        className="lab-v2-time-network"
        viewBox={`0 0 ${totalWidth} ${layout.height}`}
        role="img"
        aria-label="完整项目时标网络图"
      >
        <defs>
          <marker id="lab-v2-network-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" />
          </marker>
        </defs>
        <rect className="network-background" x="0" y="0" width={totalWidth} height={layout.height} />
        {Array.from({ length: 32 }, (_, index) => index + 1).map((week) => (
          <g key={week}>
            <line className={`network-week-line ${week === selectedWeek ? "selected" : ""}`} x1={weekX(week)} x2={weekX(week)} y1="28" y2={layout.height} />
            <text className={`network-week-label ${week === selectedWeek ? "selected" : ""}`} x={weekX(week) + weekWidth / 2} y="20">W{week}</text>
          </g>
        ))}
        <line className="network-week-line" x1={weekX(32) + weekWidth} x2={weekX(32) + weekWidth} y1="28" y2={layout.height} />
        {layout.groups.map((group) => (
          <g key={group.id}>
            <line className="network-group-line" x1="0" x2={totalWidth} y1={group.bottom + groupGap / 2} y2={group.bottom + groupGap / 2} />
            <text className="network-group-id" x="8" y={group.top + 13}>{group.id}</text>
            <text className="network-group-title" x="8" y={group.top + 28}>{group.title}</text>
          </g>
        ))}
        <g className="network-connections">
          {layout.activities.flatMap((activity) => (activity.predecessors ?? []).flatMap((predecessor) => {
            const predecessorActivity = layoutById.get(predecessor.activityId);
            if (!predecessorActivity) return [];
            const startX = weekX(predecessorActivity.endWeek) + weekWidth / 2;
            const startY = predecessorActivity.rowY + 13;
            const endX = weekX(activity.startWeek) + weekWidth / 2;
            const endY = activity.rowY + 13;
            const turnX = Math.max(startX + 10, (startX + endX) / 2);
            const critical = predecessorActivity.isCritical && activity.isCritical;
            return [<path key={`${predecessor.activityId}-${activity.id}`} className={critical ? "critical" : ""} d={`M ${startX} ${startY} L ${turnX} ${startY} L ${turnX} ${endY} L ${endX} ${endY}`} />];
          }))}
        </g>
        <g className="network-activities">
          {layout.activities.map((activity) => {
            const nodeX = weekX(activity.startWeek) + 2;
            const nodeWidth = Math.max(30, (activity.endWeek - activity.startWeek + 1) * weekWidth - 4);
            const completed = activity.endWeek < selectedWeek;
            const active = activity.startWeek <= selectedWeek && activity.endWeek >= selectedWeek;
            return (
              <g key={activity.id} className={`${activity.isCritical ? "critical" : ""} ${completed ? "completed" : active ? "active" : "planned"}`}>
                <title>{`${activity.id} ${activity.title}；W${activity.startWeek}–W${activity.endWeek}；ES ${activity.earliestStart} / EF ${activity.earliestFinish} / LS ${activity.latestStart} / LF ${activity.latestFinish} / TF ${activity.totalFloat} / FF ${activity.freeFloat}`}</title>
                <rect x={nodeX} y={activity.rowY} width={nodeWidth} height="26" rx="4" />
                <text x={nodeX + 7} y={activity.rowY + 17}>{completed ? "✓ " : active ? "● " : ""}{activity.id}</text>
                {!activity.isCritical && nodeWidth >= 80 ? <text className="network-float" x={nodeX + nodeWidth - 7} y={activity.rowY + 17}>TF {activity.totalFloat}</text> : null}
              </g>
            );
          })}
        </g>
        <line className="network-now-line" x1={weekX(selectedWeek) + weekWidth / 2} x2={weekX(selectedWeek) + weekWidth / 2} y1="28" y2={layout.height} />
      </svg>
    </div>
  );
}

function DashboardCard({
  id,
  eyebrow,
  title,
  value,
  note,
  className = "",
  onOpen,
  children,
}: {
  id: DashboardId;
  eyebrow: string;
  title: string;
  value?: string;
  note?: string;
  className?: string;
  onOpen: (id: DashboardId) => void;
  children?: ReactNode;
}) {
  return (
    <button className={`lab-v2-widget ${className}`} onClick={() => onOpen(id)}>
      <header><span>{eyebrow}</span><b>↗</b></header>
      <h3>{title}</h3>
      {value && <strong className="lab-v2-widget-value">{value}</strong>}
      {children}
      {note && <footer>{note}</footer>}
    </button>
  );
}

export function LabTimelinePage() {
  const [manifest, setManifest] = useState<CaseManifest | null>(null);
  const [mainline, setMainline] = useState<MainlineData | null>(null);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedWidget, setSelectedWidget] = useState<DashboardId | null>(null);
  const [documentDrawerOpen, setDocumentDrawerOpen] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState("D14");
  const [managementFilter, setManagementFilter] = useState<string | null>(null);
  const [branch, setBranch] = useState<BranchContext | null>(null);
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [scenarioTitle, setScenarioTitle] = useState<string | null>(null);
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
        const [nextManifest, mainlineResponse] = await Promise.all([
          apiJson<CaseManifest>(`/api/lab/cases/${caseId}/${caseVersion}`),
          apiJson<MainlineResponse>(`/api/lab/cases/${caseId}/${caseVersion}/mainline?sections=${mainlineSections}`),
        ]);
        if (cancelled) return;
        setManifest(nextManifest);
        setMainline(mainlineResponse.sections);
        const restored = branchFromHash();
        if (!restored) return;
        const projection = await apiJson<{ branch: BranchContext; scenario: { title: string; cards: PublicCard[] } }>(
          `/api/lab/branches/${encodeURIComponent(restored.branchId)}/scenarios/${encodeURIComponent(restored.scenarioId)}/projection`,
        );
        if (cancelled) return;
        setBranch(projection.branch);
        setSelectedWeek(projection.branch.currentWeek);
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
    setSelectedWeek(point.week);
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
      setSelectedMaterial(null);
      setCards([]);
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}#lab-schedule?branch=${encodeURIComponent(created.branch.id)}&scenario=${encodeURIComponent(created.scenario.id)}`,
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

  const weekState = useMemo(() => mainline?.baselineWorkload.weeks.find((item) => item.week === selectedWeek) ?? null, [mainline, selectedWeek]);
  const visibleWeeks = useMemo(() => mainline?.baselineWorkload.weeks.filter((item) => item.week <= selectedWeek) ?? [], [mainline, selectedWeek]);
  const activeWorkPackages = useMemo(() => mainline?.workload.workPackages.filter((item) => item.startWeek <= selectedWeek && item.endWeek >= selectedWeek) ?? [], [mainline, selectedWeek]);
  const activeActivities = useMemo(() => mainline?.schedule.activities.filter((item) => item.startWeek <= selectedWeek && item.endWeek >= selectedWeek) ?? [], [mainline, selectedWeek]);
  const currentTakeoverPoint = manifest?.takeoverPoints.find((point) => point.week === selectedWeek) ?? null;

  const stakeholderState = useMemo(() => {
    if (!mainline) return [];
    const currentById = new Map(mainline.stakeholders.stakeholders.map((item) => [item.id, item.initialEngagement.current]));
    for (const event of mainline.stakeholders.mainlineEngagementEvents.filter((item) => item.week <= selectedWeek)) {
      currentById.set(event.stakeholderId, event.current);
    }
    return mainline.stakeholders.stakeholders.map((item) => ({ ...item, current: currentById.get(item.id) ?? item.initialEngagement.current }));
  }, [mainline, selectedWeek]);

  const engagementPercent = useMemo(() => {
    if (!stakeholderState.length) return 0;
    const score = stakeholderState.reduce((sum, item) => sum + (engagementScores[item.current] ?? 1), 0);
    return Math.round(score / (stakeholderState.length * 5) * 100);
  }, [stakeholderState]);

  const riskState = useMemo(() => {
    if (!mainline) return [];
    const lifecycleById = new Map(mainline.risks.initialRisks.map((risk) => [risk.id, "identified"]));
    for (const event of mainline.risks.mainlineLifecycleEvents.filter((item) => item.week <= selectedWeek)) {
      for (const riskId of event.riskIds) lifecycleById.set(riskId, event.toLifecycleState);
    }
    return mainline.risks.initialRisks.map((risk) => ({ ...risk, lifecycle: lifecycleById.get(risk.id) ?? "identified" }));
  }, [mainline, selectedWeek]);

  const documentState = useMemo(() => {
    if (!mainline) return [];
    return mainline.documents.documents.map((document) => {
      const history = mainline.documents.mainlineEvents.filter((event) => event.week <= selectedWeek && documentActions(event, document.id).length > 0);
      return {
        ...document,
        status: documentStatus(document, mainline.documents.mainlineEvents, selectedWeek),
        history,
        version: document.createdWeek <= selectedWeek ? 1 + history.length : 0,
      };
    });
  }, [mainline, selectedWeek]);

  const selectedDocument = documentState.find((document) => document.id === selectedDocumentId) ?? documentState[0];
  const relatedDocumentIds = useMemo(() => {
    if (!mainline || !selectedDocument) return new Set<string>();
    return new Set(mainline.documents.relations
      .filter((relation) => relation.effectiveWeek <= selectedWeek && (relation.fromDocumentId === selectedDocument.id || relation.toDocumentId === selectedDocument.id))
      .flatMap((relation) => [relation.fromDocumentId, relation.toDocumentId]));
  }, [mainline, selectedDocument, selectedWeek]);
  const filteredDocuments = managementFilter
    ? documentState.filter((document) => managementAreas.find((area) => area.id === managementFilter)?.documentIds.includes(document.id))
    : documentState;

  const cardsByColumn = useMemo(() => Object.fromEntries(
    Object.keys(cardColumnLabels).map((column) => [column, cards.filter((card) => card.column === column)]),
  ) as Record<PublicCard["column"], PublicCard[]>, [cards]);

  if (!mainline || !manifest || !weekState) {
    return <main className="lab-v2-page"><div className="lab-v2-loading"><i /><strong>正在装载 32 周项目主线</strong><span>读取绩效、风险、干系人与项目文件状态…</span></div></main>;
  }

  const progressPercent = weekState.cumulativeEarnedValueCny / mainline.workload.budgetAtCompletionCny * 100;
  const completedRiskCount = riskState.filter((risk) => risk.lifecycle === "closed").length;
  const openRiskCount = riskState.length - completedRiskCount;
  const qualityPassRate = interpolateSeries(mainline.quality.mainlineSeries.find((series) => series.metricId === "core_test_pass_rate"), selectedWeek);
  const blockerDefects = interpolateSeries(mainline.quality.mainlineSeries.find((series) => series.metricId === "blocker_defects"), selectedWeek);
  const requirementTotal = 24;
  const requirementBaselined = Math.min(requirementTotal, Math.round(requirementTotal * Math.min(selectedWeek / 8, 1)));
  const developmentProgress = Math.max(0, Math.min(1, (selectedWeek - 8) / 20));
  const requirementCompleted = Math.round(requirementTotal * developmentProgress);
  const requirementVerified = Math.round(requirementCompleted * (typeof qualityPassRate === "number" ? qualityPassRate : 0));
  const completedGates = milestones.filter((milestone) => milestone.week <= selectedWeek).length;
  const nextGate = milestones.find((milestone) => milestone.week > selectedWeek);
  const currentSprintNumber = selectedWeek < 9 ? 0 : Math.min(10, Math.floor((selectedWeek - 9) / 2) + 1);
  const sprintProgress = selectedWeek < 9 ? 0 : ((selectedWeek - 9) % 2 + 1) / 2;
  const sprintRemaining = Math.round(34 * (1 - sprintProgress));
  const currentRaci = mainline.stakeholders.workPackageRaci.find((row) => activeWorkPackages.some((item) => item.id === row.workPackageId)) ?? mainline.stakeholders.workPackageRaci[0];
  const criticalNow = mainline.baselineWorkload.scheduleNetwork.activities.filter((activity) => activity.isCritical && activity.earliestStart <= selectedWeek && activity.earliestFinish >= selectedWeek);
  const dashboardDetailFacts: Record<DashboardId, string[]> = {
    spi: [`当前 SPI ${weekState.spi.toFixed(3)}`, `累计挣值 ${formatMoney(weekState.cumulativeEarnedValueCny)}`, `累计计划价值 ${formatMoney(weekState.cumulativePlannedValueCny)}`],
    cpi: [`当前 CPI ${weekState.cpi.toFixed(3)}`, `累计实际成本 ${formatMoney(weekState.cumulativeActualCostCny)}`, `BAC ${formatMoney(mainline.workload.budgetAtCompletionCny)}`],
    bac: [`批准预算 ${formatMoney(mainline.workload.budgetAtCompletionCny)}`, `当前完成度 ${progressPercent.toFixed(1)}%`, `预算基线贯穿 W1–W32`],
    ac: [`累计 AC ${formatMoney(weekState.cumulativeActualCostCny)}`, `本周团队投入 ${weekState.plannedTeamPersonDays} 人日`, `剩余预算 ${formatMoney(mainline.workload.budgetAtCompletionCny - weekState.cumulativeActualCostCny)}`],
    gantt: [`当前活跃工作包 ${activeWorkPackages.length} 个`, `当前活跃活动 ${activeActivities.length} 项`, `下一阶段门 ${nextGate ? `W${nextGate.week} ${nextGate.label}` : "项目已收尾"}`],
    workload: [`全项目计划工作量 ${mainline.baselineWorkload.totalPlannedPersonDays} 人日`, `本周计划 ${weekState.plannedTeamPersonDays} 人日`, `当前投入峰值 ${Math.max(...visibleWeeks.map((item) => item.plannedTeamPersonDays))} 人日/周`],
    engagement: [`总体参与度 ${engagementPercent}%`, `领先参与 ${stakeholderState.filter((item) => item.current === "leading").length} 人`, `支持参与 ${stakeholderState.filter((item) => item.current === "supportive").length} 人`],
    raci: [`当前工作包 ${currentRaci.workPackageId}`, `A：${currentRaci.A.join("、")}`, `R：${currentRaci.R.join("、")}`],
    "risk-matrix": [`开放风险 ${openRiskCount} 项`, `已关闭风险 ${completedRiskCount} 项`, `高影响开放风险 ${riskState.filter((risk) => risk.lifecycle !== "closed" && risk.residual.impact >= 4).length} 项`],
    requirements: [`需求总数 ${requirementTotal}`, `已基线 ${requirementBaselined}`, `已完成 ${requirementCompleted}，已验证 ${requirementVerified}`, `阻断缺陷 ${typeof blockerDefects === "number" ? Math.round(blockerDefects) : 0} 个`],
    burndown: [currentSprintNumber ? `当前 S${currentSprintNumber}` : "尚未进入迭代", `迭代剩余 ${sprintRemaining} 点`, `当前周 W${selectedWeek}`],
    ccb: [`已完成阶段门 ${completedGates} 个`, `下一阶段门 ${nextGate ? `W${nextGate.week}` : "无"}`, `当前待办 ${nextGate && nextGate.week - selectedWeek <= 1 ? 1 : 0} 项`],
    network: [`当前关键活动 ${criticalNow.length} 项`, `关键活动总数 ${mainline.baselineWorkload.scheduleNetwork.criticalActivityIds.length}`, `主线预测完工 W${mainline.baselineWorkload.scheduleNetwork.calculatedProjectFinishWeek}`],
    wbs: [`工作包总数 ${mainline.workload.workPackages.length}`, `进行中 ${activeWorkPackages.length}`, `已完成 ${mainline.workload.workPackages.filter((item) => item.endWeek < selectedWeek).length}`],
    "risk-status": [`识别风险 ${riskState.length} 项`, `监控中 ${riskState.filter((risk) => risk.lifecycle === "monitoring").length} 项`, `已关闭 ${completedRiskCount} 项`],
  };

  return (
    <main className="lab-v2-page">
      <section className="lab-v2-project-head">
        <div>
          <span>PROJECT LAB / LEARNING MODE</span>
          <h1>车主远程控车应用项目</h1>
          <p>完整主线回放 · 8 人团队 · 32 周 · BAC 260 万</p>
        </div>
        <div className="lab-v2-head-status">
          <span>当前观察位置</span>
          <strong>W{selectedWeek.toString().padStart(2, "0")}</strong>
          <small>{projectStage(selectedWeek)}</small>
        </div>
      </section>

      <section className="lab-v2-timeline-panel" aria-label="项目主线进度条">
        <header>
          <div><span>MAINLINE / 最短成功路径</span><strong>拖动进度条，观察项目状态与文件版本同步变化</strong></div>
          <div className="lab-v2-playback-status"><i />主线回放</div>
        </header>
        <div className="lab-v2-range-wrap">
          <div className="lab-v2-range-fill" style={{ width: `${((selectedWeek - 1) / 31) * 100}%` }} />
          <input
            type="range"
            min="1"
            max="32"
            step="1"
            value={selectedWeek}
            onChange={(event) => setSelectedWeek(Number(event.target.value))}
            aria-label="项目周次"
          />
          {milestones.map((milestone) => (
            <button
              key={milestone.week}
              className={`lab-v2-milestone ${selectedWeek >= milestone.week ? "passed" : ""}`}
              style={{ left: `${((milestone.week - 1) / 31) * 100}%` }}
              onClick={() => setSelectedWeek(milestone.week)}
            >
              <i /><span>W{milestone.week}</span><small>{milestone.label}</small>
            </button>
          ))}
          {manifest.takeoverPoints.map((point) => (
            <button
              key={point.scenarioId}
              className={`lab-v2-takeover-marker ${selectedWeek === point.week ? "active" : ""}`}
              style={{ left: `${((point.week - 1) / 31) * 100}%` }}
              onClick={() => setSelectedWeek(point.week)}
              aria-label={`查看第${point.week}周接手点`}
            >
              <span>接手点</span><b>W{point.week}</b>
            </button>
          ))}
        </div>
        <div className="lab-v2-timeline-meta">
          <span>W01</span>
          <strong>{progressPercent.toFixed(1)}% 项目价值已完成</strong>
          <span>W32</span>
        </div>
        {currentTakeoverPoint && !branch && (
          <div className="lab-v2-takeover-callout">
            <div><span>SCENARIO AVAILABLE</span><strong>{scenarioLabels[currentTakeoverPoint.scenarioId]}</strong><small>在 W{currentTakeoverPoint.week} 复制主线状态，建立你的个人分支。</small></div>
            <button disabled={loadingScenarioId !== null} onClick={() => void takeover(currentTakeoverPoint)}>
              {loadingScenarioId === currentTakeoverPoint.scenarioId ? "正在创建分支…" : "从这里接手 →"}
            </button>
          </div>
        )}
      </section>

      {error && <div className="lab-v2-error" role="alert"><strong>暂时无法继续</strong><span>{error}</span></div>}

      <section className="lab-v2-dashboard-heading">
        <div><span>PROJECT CONTROL CENTER</span><h2>项目总仪表盘</h2></div>
        <p>所有指标均为主线在 W{selectedWeek} 的状态。点击任一仪表查看详细数据。</p>
      </section>

      <section className="lab-v2-dashboard-grid">
        <DashboardCard id="spi" eyebrow="EARNED VALUE" title="SPI" value={weekState.spi.toFixed(3)} note={weekState.spi >= 1 ? "进度符合基线" : "轻微落后，主线可控"} onOpen={setSelectedWidget}>
          <Sparkline values={visibleWeeks.map((item) => item.spi)} />
        </DashboardCard>
        <DashboardCard id="cpi" eyebrow="EARNED VALUE" title="CPI" value={weekState.cpi.toFixed(3)} note={weekState.cpi >= 1 ? "成本效率良好" : "成本效率需关注"} onOpen={setSelectedWidget}>
          <Sparkline values={visibleWeeks.map((item) => item.cpi)} />
        </DashboardCard>
        <DashboardCard id="bac" eyebrow="COST BASELINE" title="BAC" value={formatMoney(mainline.workload.budgetAtCompletionCny)} note="批准项目预算" onOpen={setSelectedWidget}>
          <div className="lab-v2-progress"><i style={{ width: `${progressPercent}%` }} /></div>
        </DashboardCard>
        <DashboardCard id="ac" eyebrow="ACTUAL COST" title="AC" value={formatMoney(weekState.cumulativeActualCostCny)} note={`预算消耗 ${(weekState.cumulativeActualCostCny / mainline.workload.budgetAtCompletionCny * 100).toFixed(1)}%`} onOpen={setSelectedWidget}>
          <div className="lab-v2-cost-comparison"><i style={{ width: `${weekState.cumulativeActualCostCny / mainline.workload.budgetAtCompletionCny * 100}%` }} /><b style={{ left: `${progressPercent}%` }} /></div>
        </DashboardCard>

        <DashboardCard id="gantt" eyebrow="SCHEDULE" title="里程碑甘特图" className="full gantt-widget" note={`完整 11 个一级工作包 · ${activeWorkPackages.length} 个进行中`} onOpen={setSelectedWidget}>
          <div className="lab-v2-gantt">
            <div className="lab-v2-gantt-axis"><span>一级 WBS</span><i>{[1, 4, 8, 12, 16, 20, 24, 28, 32].map((week) => <b key={week} style={{ left: `${((week - 0.5) / 32) * 100}%` }}>W{week}</b>)}</i></div>
            {mainline.workload.workPackages.map((item) => {
              const completed = item.endWeek < selectedWeek;
              const active = item.startWeek <= selectedWeek && item.endWeek >= selectedWeek;
              return (
                <div key={item.id} className={completed ? "done" : active ? "active" : "planned"}>
                  <span><b>{completed ? "✓" : active ? "●" : "○"}</b><i><strong>{item.id}</strong><small>{item.title}</small></i></span>
                  <em><b style={{ left: `${((item.startWeek - 1) / 32) * 100}%`, width: `${((item.endWeek - item.startWeek + 1) / 32) * 100}%` }} /></em>
                </div>
              );
            })}
            <mark><i style={{ left: `${((selectedWeek - 0.5) / 32) * 100}%` }} /></mark>
          </div>
        </DashboardCard>
        <DashboardCard id="workload" eyebrow="CAPACITY" title="项目工作量" value={`${weekState.plannedTeamPersonDays} 人日`} note={`全项目 ${mainline.baselineWorkload.totalPlannedPersonDays} 人日`} onOpen={setSelectedWidget}>
          <MiniBars values={mainline.baselineWorkload.weeks.map((item) => item.plannedTeamPersonDays)} />
        </DashboardCard>
        <DashboardCard id="engagement" eyebrow="STAKEHOLDERS" title="干系人参与度" value={`${engagementPercent}%`} note={`${stakeholderState.filter((item) => item.current === "leading").length} 人处于领导参与`} onOpen={setSelectedWidget}>
          <div className="lab-v2-engagement-dots">{stakeholderState.slice(0, 14).map((item) => <i key={item.id} className={item.current} title={`${item.title}：${item.current}`} />)}</div>
        </DashboardCard>

        <DashboardCard id="raci" eyebrow="RESPONSIBILITY" title="RACI 矩阵" className="wide" note={`当前工作包 ${currentRaci.workPackageId}`} onOpen={setSelectedWidget}>
          <div className="lab-v2-raci">
            {(["A", "R", "C", "I"] as const).map((role) => <div key={role}><b>{role}</b><span>{currentRaci[role].slice(0, role === "C" || role === "I" ? 3 : 2).join(" / ") || "—"}</span></div>)}
          </div>
        </DashboardCard>
        <DashboardCard id="risk-matrix" eyebrow="RISK EXPOSURE" title="风险影响概率矩阵" note={`${openRiskCount} 项风险仍在监控`} onOpen={setSelectedWidget}>
          <div className="lab-v2-risk-matrix">
            {Array.from({ length: 25 }, (_, cellIndex) => {
              const probability = 5 - Math.floor(cellIndex / 5);
              const impact = cellIndex % 5 + 1;
              const count = riskState.filter((risk) => risk.lifecycle !== "closed" && risk.residual.probability === probability && risk.residual.impact === impact).length;
              return <i key={`${probability}-${impact}`} className={probability * impact >= 12 ? "high" : probability * impact >= 6 ? "medium" : "low"}>{count || ""}</i>;
            })}
          </div>
        </DashboardCard>
        <DashboardCard id="requirements" eyebrow="SCOPE CONTROL" title="需求状态统计" value={`${requirementVerified}/${requirementTotal}`} note={`${requirementBaselined} 条已进入基线`} onOpen={setSelectedWidget}>
          <div className="lab-v2-stacked"><i style={{ width: `${requirementVerified / requirementTotal * 100}%` }} /><b style={{ width: `${Math.max(0, requirementCompleted - requirementVerified) / requirementTotal * 100}%` }} /><em /></div>
          <div className="lab-v2-legend"><span>已验证 {requirementVerified}</span><span>开发完成 {requirementCompleted}</span><span>总计 {requirementTotal}</span></div>
        </DashboardCard>

        <DashboardCard id="burndown" eyebrow="ITERATION" title="当前迭代燃尽图" value={currentSprintNumber ? `S${currentSprintNumber}` : "未开始"} note={currentSprintNumber ? `剩余 ${sprintRemaining} 点` : "W9 进入首个开发迭代"} onOpen={setSelectedWidget}>
          <Sparkline values={currentSprintNumber ? [34, 30, 26, 20, 16, 12, sprintRemaining] : [34, 34, 34, 34]} target={0} />
        </DashboardCard>
        <DashboardCard id="ccb" eyebrow="GOVERNANCE" title="CCB 待办项" value={nextGate && nextGate.week - selectedWeek <= 1 ? "1" : "0"} note={nextGate ? `下一阶段门 W${nextGate.week}` : "所有阶段门已完成"} onOpen={setSelectedWidget}>
          <div className="lab-v2-gates">{milestones.slice(1).map((item) => <i key={item.week} className={item.week <= selectedWeek ? "done" : item.week - selectedWeek <= 1 ? "pending" : ""}><b>W{item.week}</b><span>{item.label}</span></i>)}</div>
        </DashboardCard>
        <DashboardCard id="network" eyebrow="SCHEDULE NETWORK" title="时标网络图" className="full network-widget" note={`完整 35 项活动 · ${mainline.baselineWorkload.scheduleNetwork.criticalActivityIds.length} 项关键活动 · W32 完工`} onOpen={setSelectedWidget}>
          <TimeScaledNetwork activities={mainline.schedule.activities} network={mainline.baselineWorkload.scheduleNetwork} workPackages={mainline.workload.workPackages} selectedWeek={selectedWeek} />
        </DashboardCard>
        <DashboardCard id="wbs" eyebrow="DELIVERABLES" title="WBS" className="full wbs-widget" note={`11 个一级工作包 · 纵向展开 ${mainline.schedule.activities.length} 项二级子任务`} onOpen={setSelectedWidget}>
          <WbsCards workPackages={mainline.workload.workPackages} activities={mainline.schedule.activities} selectedWeek={selectedWeek} />
        </DashboardCard>
        <DashboardCard id="risk-status" eyebrow="RISK REGISTER" title="风险状态统计" value={`${openRiskCount} 开放`} note={`${completedRiskCount}/${riskState.length} 已关闭`} onOpen={setSelectedWidget}>
          <div className="lab-v2-risk-status"><i style={{ width: `${completedRiskCount / riskState.length * 100}%` }} /></div>
          <div className="lab-v2-legend"><span>已关闭 {completedRiskCount}</span><span>监控中 {openRiskCount}</span></div>
        </DashboardCard>
      </section>

      <section className="lab-v2-management">
        <header><div><span>10 MANAGEMENT AREAS</span><h2>管理领域</h2></div><p>点击领域卡片，在项目文件抽屉中查看该领域当前可用文件。</p></header>
        <div>
          {managementAreas.map((area) => {
            const createdCount = documentState.filter((document) => area.documentIds.includes(document.id) && document.createdWeek <= selectedWeek).length;
            return (
              <button key={area.id} onClick={() => { setManagementFilter(area.id); setDocumentDrawerOpen(true); }}>
                <span>{area.index}</span><strong>{area.title}</strong><small>{createdCount}/{area.documentIds.length} 份文件可用</small><i>→</i>
              </button>
            );
          })}
        </div>
      </section>

      {branch && (
        <section className="lab-v2-branch-workspace">
          <header>
            <div><span>PERSONAL BRANCH / W{branch.currentWeek}</span><h2>{scenarioTitle}</h2><p>事件材料需要逐项打开；系统只呈现客观事实，不提示正确答案。</p></div>
            <div><strong>{materials?.openedCount ?? 0}/{materials?.totalCount ?? 0}</strong><span>材料已查看</span><small>{materials?.cardsUnlocked ? "行动卡已解锁" : "继续观察线索"}</small></div>
          </header>
          <div className="lab-v2-material-layout">
            <aside>
              <span>项目经理收件箱</span>
              {materials?.materials.map((material) => (
                <button
                  key={material.id}
                  className={`${material.opened ? "opened" : ""} ${selectedMaterial?.id === material.id ? "active" : ""}`}
                  disabled={openingMaterialId !== null}
                  onClick={() => void openMaterial(material)}
                >
                  <i>{material.opened ? "✓" : "·"}</i><span><small>{materialGroupLabels[material.group] ?? material.type}</small><strong>{material.title}</strong><em>{material.channel ?? "项目仪表盘"}</em></span><b>{openingMaterialId === material.id ? "读取中" : "打开"}</b>
                </button>
              ))}
            </aside>
            <article>
              {selectedMaterial ? (
                <>
                  <span>{selectedMaterial.id} / 已记录查看</span>
                  <h3>{selectedMaterial.subject ?? selectedMaterial.displayLabel ?? "项目状态信号"}</h3>
                  <small>{selectedMaterial.channel ? `来源：${selectedMaterial.channel}` : "来源：项目仪表盘"}</small>
                  {selectedMaterial.facts?.length ? <ul>{selectedMaterial.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul> : null}
                  {selectedMaterial.documentIds?.length ? <div className="lab-v2-material-docs">{selectedMaterial.documentIds.map((documentId) => <button key={documentId} onClick={() => { setSelectedDocumentId(documentId); setManagementFilter(null); setDocumentDrawerOpen(true); }}>{documentId} 查看关联文件</button>)}</div> : null}
                </>
              ) : <div className="lab-v2-empty-material"><b>01</b><h3>打开第一条工作材料</h3><p>从邮件、消息、报告和异常数据中识别项目发生了什么。</p></div>}
            </article>
          </div>
          <div className={`lab-v2-action-cards ${materials?.cardsUnlocked ? "unlocked" : ""}`}>
            <header><div><span>ACTION CHAIN</span><h3>{materials?.cardsUnlocked ? "候选行动卡" : "查看全部材料后解锁行动链"}</h3></div><strong>{materials?.cardsUnlocked ? `${cards.length} 张` : "LOCKED"}</strong></header>
            {materials?.cardsUnlocked ? <div>{(Object.keys(cardColumnLabels) as PublicCard["column"][]).map((column) => <section key={column}><span>{cardColumnLabels[column]}</span>{cardsByColumn[column].map((card) => <article key={card.id}><small>{card.id}</small><strong>{card.title}</strong></article>)}</section>)}</div> : <p>仍有 {(materials?.totalCount ?? 0) - (materials?.openedCount ?? 0)} 条材料未查看。</p>}
          </div>
        </section>
      )}

      <button className={`lab-v2-drawer-tab ${documentDrawerOpen ? "open" : ""}`} onClick={() => setDocumentDrawerOpen((current) => !current)}>
        <i>32</i><span>项目文件</span><b>{documentState.filter((document) => document.createdWeek <= selectedWeek).length}</b>
      </button>

      {documentDrawerOpen && (
        <div className="lab-v2-drawer-backdrop" onClick={() => setDocumentDrawerOpen(false)}>
          <aside className="lab-v2-document-drawer" onClick={(event) => event.stopPropagation()}>
            <header>
              <div><span>PROJECT FILE DRAWER / W{selectedWeek}</span><h2>32 份项目文件</h2><p>{managementFilter ? `${managementAreas.find((area) => area.id === managementFilter)?.title}筛选` : "全部文件"} · 选择文件查看当前版本和历史。</p></div>
              <button onClick={() => setDocumentDrawerOpen(false)}>关闭</button>
            </header>
            <div className="lab-v2-document-layout">
              <nav>
                <div className="lab-v2-document-filter"><button className={!managementFilter ? "active" : ""} onClick={() => setManagementFilter(null)}>全部 32</button>{managementAreas.map((area) => <button key={area.id} className={managementFilter === area.id ? "active" : ""} onClick={() => setManagementFilter(area.id)}>{area.shortTitle}</button>)}</div>
                <div className="lab-v2-document-list">
                  {filteredDocuments.map((document) => (
                    <button
                      key={document.id}
                      className={`${selectedDocument?.id === document.id ? "active" : ""} ${relatedDocumentIds.has(document.id) ? "related" : ""} ${document.status === "未创建" ? "locked" : ""}`}
                      onClick={() => setSelectedDocumentId(document.id)}
                    >
                      <b>{document.id}</b><span><strong>{document.title}</strong><small>v{document.version} · {document.status}</small></span><i />
                    </button>
                  ))}
                </div>
              </nav>
              <article>
                {selectedDocument && (
                  <>
                    <div className="lab-v2-document-title"><span>{selectedDocument.id} / W{selectedWeek} 主线版本</span><h3>{selectedDocument.title}</h3><div><b>{selectedDocument.status}</b><i>v{selectedDocument.version}</i><small>创建于 W{selectedDocument.createdWeek}</small></div></div>
                    {selectedDocument.status === "未创建" ? <div className="lab-v2-document-locked"><strong>该文件尚未创建</strong><p>将时间轴拖动到 W{selectedDocument.createdWeek} 后查看首个版本。</p></div> : <>
                      <section className="lab-v2-document-summary"><span>当前内容摘要</span><dl><div><dt>文件用途</dt><dd>{selectedDocument.coverage === "dynamic_full_history" ? "动态管理文件，保留完整更新历史" : "支持性文件，在关键阶段形成版本"}</dd></div><div><dt>当前阶段</dt><dd>{projectStage(selectedWeek)}</dd></div><div><dt>最近变更</dt><dd>{selectedDocument.history[selectedDocument.history.length - 1]?.reason ?? `W${selectedDocument.createdWeek} 创建初始版本`}</dd></div><div><dt>版本依据</dt><dd>主线事件、阶段门审批与关联文件变化</dd></div></dl></section>
                      <section className="lab-v2-document-relations"><span>关联文件</span><div>{mainline.documents.relations.filter((relation) => relation.effectiveWeek <= selectedWeek && (relation.fromDocumentId === selectedDocument.id || relation.toDocumentId === selectedDocument.id)).map((relation) => { const relatedId = relation.fromDocumentId === selectedDocument.id ? relation.toDocumentId : relation.fromDocumentId; const related = documentState.find((document) => document.id === relatedId); return <button key={relation.id} onClick={() => setSelectedDocumentId(relatedId)}><b>{relatedId}</b><span>{related?.title}</span><small>{relation.reason}</small></button>; })}</div></section>
                      <section className="lab-v2-document-history"><span>版本历史</span><ol><li><b>v1</b><div><strong>W{selectedDocument.createdWeek} · 创建</strong><p>形成首个可引用版本。</p></div></li>{selectedDocument.history.map((historyEvent, historyIndex) => <li key={historyEvent.id}><b>v{historyIndex + 2}</b><div><strong>W{historyEvent.week} · {documentActions(historyEvent, selectedDocument.id).join(" / ")}</strong><p>{historyEvent.reason}</p></div></li>)}</ol></section>
                    </>}
                  </>
                )}
              </article>
            </div>
          </aside>
        </div>
      )}

      {selectedWidget && (
        <div className="lab-v2-modal-backdrop" onClick={() => setSelectedWidget(null)}>
          <section className="lab-v2-widget-modal" onClick={(event) => event.stopPropagation()}>
            <header><div><span>W{selectedWeek} / DASHBOARD DETAIL</span><h2>{dashboardTitles[selectedWidget]}</h2></div><button onClick={() => setSelectedWidget(null)}>关闭</button></header>
            <div>{dashboardDetailFacts[selectedWidget].map((fact, index) => <article key={fact}><span>{String(index + 1).padStart(2, "0")}</span><strong>{fact}</strong></article>)}</div>
            <footer>数据来自当前主线状态。拖动项目进度条后，该仪表详情会同步更新。</footer>
          </section>
        </div>
      )}
    </main>
  );
}
