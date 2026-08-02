"use client";

import {
  Fragment,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  knowledgeTopics,
  lifecycleActivities,
  lifecyclePhases,
  processGroupLanes,
  projectDocuments,
  type DocumentTouch,
  type KnowledgeTopic,
} from "./knowledge-data";
import {
  managementToolIdByTitle,
  managementToolNumberByTitle,
  managementToolCategories,
  managementToolInventoryCount,
} from "./management-tool-data";
import { managementAreas, type ManagementProcess } from "./management-area-data";
import { KnowledgeGraphCanvas } from "./knowledge-graph-canvas";
import {
  structuredKnowledgeGraph,
  structuredKnowledgeGraphStats,
  type StructuredKnowledgeNode,
} from "./knowledge-graph-data";
import { obsidianProjectDocuments } from "./project-document-data";
import { authoritativeTools } from "./obsidian-knowledge.generated";
import { documentTemplates, type DocumentTemplate } from "./document-templates";
import { knowledgeDossierSupplements } from "./knowledge-dossier-supplements";
import { ProjectDocumentFlowDiagram } from "./project-document-flow-diagram";

const kindLabels = {
  framework: "框架",
  "management-area": "管理过程",
  "process-group": "过程组",
  process: "子过程",
  artifact: "项目文档",
  tool: "工具与技术",
};

const touchLabels: Record<DocumentTouch, string> = {
  input: "输入",
  create: "输出·创建",
  update: "输出·更新",
};

const touchPriority: Record<DocumentTouch, number> = {
  create: 0,
  update: 1,
  input: 2,
};

const cardTouchPriority: Record<DocumentTouch, number> = {
  input: 0,
  create: 1,
  update: 2,
};

type TouchActivity = ManagementProcess & {
  area: string;
  areaId: string;
  knowledgeId: string;
};

type TouchSignal = {
  activityId: string;
  height: number;
  id: number;
  leftBranch: string;
  rightBranch: string;
  trunk: string;
  width: number;
};

const touchActivities: TouchActivity[] = managementAreas.flatMap((area) =>
  area.processes.map((item) => ({
    ...item,
    area: area.title,
    areaId: area.id,
    knowledgeId: `process:${item.id}`,
  })),
);

const lifecyclePhaseByProcessGroup: Record<ManagementProcess["group"], number> = {
  启动: 1,
  规划: 2,
  执行: 3,
  监控: 4,
  收尾: 5,
};

const subprocessNumbersByLifecycleSlot = new Map<string, string[]>();
const subprocessNumberById = new Map<string, string>();
touchActivities.forEach((activity, index) => {
  const phase = lifecyclePhaseByProcessGroup[activity.group];
  const key = `${activity.areaId}:${phase}`;
  const number = `S${String(index + 1).padStart(2, "0")}`;
  const numbers = subprocessNumbersByLifecycleSlot.get(key) ?? [];
  numbers.push(number);
  subprocessNumbersByLifecycleSlot.set(key, numbers);
  subprocessNumberById.set(activity.id, number);
});

const processGroupNumberByName = new Map<string, string>(
  ["启动", "规划", "执行", "监控", "收尾"].map((name, index) => [name, `G${String(index + 1).padStart(2, "0")}`]),
);

const managementProcessNumberByAreaId = new Map<string, string>(
  lifecycleActivities.map((activity, index) => [activity.id, `M${String(index + 1).padStart(2, "0")}`]),
);

const frameworkNumberById = new Map<string, string>([
  ["KB-PORTFOLIO", "F01"],
  ["KB-PROGRAM", "F02"],
  ["KB-ENTERPRISE-ENVIRONMENTAL-FACTORS", "F03"],
  ["KB-ORGANIZATIONAL-PROCESS-ASSETS", "F04"],
]);

const managementAreaKnowledgeTopics: KnowledgeTopic[] = managementAreas.map((area) => {
  const inputs = Array.from(new Set(area.processes.flatMap((process) => process.inputs))).slice(0, 8);
  const outputs = Array.from(new Set(area.processes.flatMap((process) => process.outputs))).slice(0, 8);
  const tools = Array.from(new Set(area.processes.flatMap((process) => process.tools))).slice(0, 10);
  const related = Array.from(new Set(area.processes.map((process) =>
    `process:${process.id}`,
  ))).slice(0, 6);
  const processGroups = Array.from(new Set(area.processes.map((process) => process.group)));
  const casePage: KnowledgeTopic["casePage"] = area.id === "stakeholder" ? "stakeholder" : area.id === "risk" ? "risk" : "overview";

  return {
    id: `KB-MA-${area.id.toUpperCase()}`,
    title: area.title,
    kind: "management-area",
    domain: "项目管理知识领域",
    definition: area.description,
    plainLanguage: `${area.tabLabel}管理把 ${area.processes.length} 个相关子过程连接起来，使计划、执行、监督与交付保持一致。`,
    timing: `主要在${processGroups.join("、")}过程组中开展，并随项目状态和信息变化持续更新。`,
    inputs,
    tools: tools.length ? tools : ["专家判断", "会议"],
    outputs,
    related,
    source: `《信息系统项目管理师教程（第4版）》· ${area.title}`,
    casePage,
  };
});

const graphTopicRelations = new Map<string, string[]>();
structuredKnowledgeGraph.edges.forEach((edge) => {
  const sourceRelated = graphTopicRelations.get(edge.source) ?? [];
  const targetRelated = graphTopicRelations.get(edge.target) ?? [];
  if (!sourceRelated.includes(edge.target)) sourceRelated.push(edge.target);
  if (!targetRelated.includes(edge.source)) targetRelated.push(edge.source);
  graphTopicRelations.set(edge.source, sourceRelated);
  graphTopicRelations.set(edge.target, targetRelated);
});

const graphKnowledgeTopics: KnowledgeTopic[] = structuredKnowledgeGraph.nodes.map((node) => {
  const casePage: KnowledgeTopic["casePage"] = node.areaId === "risk" ? "risk" : node.areaId === "stakeholder" ? "stakeholder" : "overview";
  const kind: KnowledgeTopic["kind"] = node.type === "knowledge-area"
    ? "management-area"
    : node.type === "process-group"
      ? "process-group"
      : node.type === "document"
        ? "artifact"
        : node.type;
  const related = (graphTopicRelations.get(node.id) ?? []).slice(0, 12);
  const readableSourceContent = node.description
    .replace(/!?\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g, (_match, target, alias) => alias ?? target)
    .replace(/^#{1,6}\s*/gm, "")
    .trim();
  const conciseDefinition = readableSourceContent.split(/\n\s*\n|\n/).find((line) => line.trim())?.trim() ?? node.title;

  return {
    id: node.id,
    title: node.title,
    kind,
    domain: node.areaTitle ?? node.category,
    processGroup: node.processGroup ? `${node.processGroup}过程组` : undefined,
    definition: conciseDefinition.length > 320 ? `${conciseDefinition.slice(0, 320)}…` : conciseDefinition,
    plainLanguage: node.type === "process"
      ? `它把${node.areaTitle ?? "项目管理"}中的目标转化为可执行的管理活动，并通过输入、输出和工具与其他知识点连接。`
      : `${node.title}在完整知识网络中与 ${(graphTopicRelations.get(node.id) ?? []).length} 个核心知识点直接关联。`,
    timing: node.processGroup ? `主要在${node.processGroup}过程组中开展。` : "在相关管理过程需要时创建、使用或更新。",
    inputs: node.inputs?.length ? node.inputs : related.slice(0, 6).map((id) => structuredKnowledgeGraph.nodes.find((item) => item.id === id)?.title ?? id),
    tools: node.tools?.length ? node.tools : [node.category],
    outputs: node.outputs?.length ? node.outputs : related.slice(6, 12).map((id) => structuredKnowledgeGraph.nodes.find((item) => item.id === id)?.title ?? id),
    related,
    source: `《信息系统项目管理师教程（第4版）》· ${node.category}`,
    sourceContent: readableSourceContent,
    casePage,
  };
});

const allKnowledgeTopics: KnowledgeTopic[] = [...knowledgeTopics, ...managementAreaKnowledgeTopics, ...graphKnowledgeTopics];

const documentAliases: Record<string, string[]> = Object.fromEntries(
  obsidianProjectDocuments.map((document) => [document.id, document.aliases]),
);

function touchesForActivity(activity: TouchActivity, documentId: string): DocumentTouch[] {
  const aliases = documentAliases[documentId] ?? [];
  const matches = (value: string) => aliases.includes(value);
  const touches: DocumentTouch[] = [];
  if (activity.documentCreates.some(matches)) touches.push("create");
  if (activity.documentUpdates.some(matches)) touches.push("update");
  if (activity.documentInputs.some(matches)) touches.push("input");
  return touches;
}

function dossierLabeledLine(content: string | undefined, label: string) {
  if (!content) return "";
  return content.match(new RegExp(`(?:^|\\n)${label}[：:]\\s*([^\\n]+)`))?.[1]?.trim() ?? "";
}

function dossierTiming(content: string | undefined) {
  if (!content) return "";
  const preface = content.split(/\n\s*---/)[0];
  return preface
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line && !/^(定义|作用)[：:]/.test(line) && /(开展|进行|发生|实施)/.test(line)) ?? "";
}

function dossierRemainingContent(content: string | undefined) {
  if (!content) return "";
  const lines = content.split("\n");
  const firstContentLine = lines.findIndex((line) => line.trim());
  if (firstContentLine < 0) return "";
  return lines.slice(firstContentLine + 1).join("\n").trim();
}

function dossierTemplateUsage(template: DocumentTemplate | undefined) {
  if (!template) return "";
  const structure = template.kind === "table"
    ? template.columns ?? []
    : template.fields?.map((field) => field.label) ?? [];
  const format = template.kind === "table" ? "表格" : "表单";
  return structure.length
    ? `表达方式：${format}\n模板结构：${structure.join("、")}`
    : `表达方式：${format}`;
}

function DossierTextField({ label, content, prominent = false }: { label: string; content?: string; prominent?: boolean }) {
  return (
    <section className="dossier-template-field">
      <span>{label}</span>
      <p className={prominent ? "dossier-definition" : ""}>{content ?? ""}</p>
    </section>
  );
}

function DossierListField({ label, items }: { label: string; items: string[] }) {
  return (
    <section className="dossier-template-field">
      <span>{label}</span>
      <ul className="dossier-template-list">{items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
    </section>
  );
}

function DossierUsageField({ content, image }: {
  content?: string;
  image?: { src: string; alt: string };
}) {
  return (
    <section className="dossier-template-field dossier-usage-field">
      <span>使用方法</span>
      {image && <img className="dossier-usage-image" src={image.src} alt={image.alt} loading="lazy" />}
      {!image && <p>{content ?? ""}</p>}
    </section>
  );
}

function DocumentTouchIcon({ touch }: { touch: DocumentTouch }) {
  if (touch === "input") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3v10" />
        <path d="m8 9 4 4 4-4" />
        <path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
      </svg>
    );
  }

  if (touch === "create") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v10M7 12h10" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17l-1 3Z" />
      <path d="m13.8 8.2 3 3" />
    </svg>
  );
}

export function KnowledgeLibrary() {
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState("KB-LIFECYCLE");
  const [selectedActivityId, setSelectedActivityId] = useState("develop-charter");
  const [selectedDocumentId, setSelectedDocumentId] = useState("D03");
  const [selectedToolTitle, setSelectedToolTitle] = useState("专家判断");
  const [showAllDocuments, setShowAllDocuments] = useState(false);
  const [showAllTools, setShowAllTools] = useState(false);
  const [touchSignal, setTouchSignal] = useState<TouchSignal | null>(null);
  const [selectedGraphId, setSelectedGraphId] = useState<string | null>(null);
  const mapRef = useRef<HTMLElement>(null);
  const touchRef = useRef<HTMLElement>(null);
  const graphRef = useRef<HTMLElement>(null);
  const dossierRef = useRef<HTMLElement>(null);
  const touchMapRef = useRef<HTMLDivElement>(null);
  const touchDetailRef = useRef<HTMLDivElement>(null);
  const documentTouchSectionRef = useRef<HTMLElement>(null);
  const toolTouchSectionRef = useRef<HTMLElement>(null);
  const touchSignalFrameRef = useRef<number | null>(null);
  const touchSignalScrollTimerRef = useRef<number | null>(null);
  const touchSignalTimerRef = useRef<number | null>(null);
  const touchSignalIdRef = useRef(0);

  useEffect(() => () => {
    if (touchSignalFrameRef.current !== null) window.cancelAnimationFrame(touchSignalFrameRef.current);
    if (touchSignalScrollTimerRef.current !== null) window.clearTimeout(touchSignalScrollTimerRef.current);
    if (touchSignalTimerRef.current !== null) window.clearTimeout(touchSignalTimerRef.current);
  }, []);

  const selectedTopic = allKnowledgeTopics.find((topic) => topic.id === selectedKnowledgeId) ?? allKnowledgeTopics[0];
  const selectedActivity = touchActivities.find((activity) => activity.id === selectedActivityId) ?? touchActivities[0];
  const selectedDocument = projectDocuments.find((document) => document.id === selectedDocumentId) ?? projectDocuments[0];
  const selectedStructuredNode = structuredKnowledgeGraph.nodes.find((node) => node.id === selectedTopic.id);
  const dossierProcessGroup = selectedStructuredNode?.processGroup
    ?? selectedTopic.processGroup?.replace(/过程组$/, "")
    ?? (selectedTopic.kind === "process-group" ? selectedTopic.title.replace(/过程组$/, "") : "");
  const dossierManagementArea = managementAreas.find((area) =>
    area.id === selectedStructuredNode?.areaId
    || area.title === selectedTopic.title
    || selectedTopic.id === `KB-MA-${area.id.toUpperCase()}`,
  );
  const dossierSubprocess = touchActivities.find((activity) =>
    activity.id === selectedStructuredNode?.processId
    || `process:${activity.id}` === selectedTopic.id
    || activity.title === selectedTopic.title,
  );
  const dossierDocument = obsidianProjectDocuments.find((document) =>
    `document:${document.id}` === selectedTopic.id || document.title === selectedTopic.title,
  );
  const dossierPresentationTemplate = documentTemplates.find((template) => template.title === selectedTopic.title);
  const dossierSupplement = knowledgeDossierSupplements[selectedTopic.id];
  const dossierKnowledgeNumber = selectedTopic.kind === "process-group"
    ? processGroupNumberByName.get(dossierProcessGroup)
    : selectedTopic.kind === "management-area"
      ? managementProcessNumberByAreaId.get(dossierManagementArea?.id ?? "")
      : selectedTopic.kind === "artifact"
        ? dossierDocument?.id
        : selectedTopic.kind === "process"
          ? subprocessNumberById.get(dossierSubprocess?.id ?? "")
          : selectedTopic.kind === "tool"
            ? (() => {
              const number = managementToolNumberByTitle.get(selectedTopic.title);
              return number ? `T${String(number).padStart(3, "0")}` : undefined;
            })()
            : frameworkNumberById.get(selectedTopic.id);
  const dossierDefinition = (dossierLabeledLine(selectedTopic.sourceContent, "定义") || selectedTopic.definition)
    .replace(/^定义[：:]\s*/, "");
  const dossierRole = dossierLabeledLine(selectedTopic.sourceContent, "作用");
  const processGroupActivities = dossierProcessGroup
    ? touchActivities
      .filter((activity) => activity.group === dossierProcessGroup)
      .map((activity) => `${subprocessNumberById.get(activity.id)} · ${activity.title}`)
    : [];
  const managementAreaActivities = dossierManagementArea
    ? dossierManagementArea.processes.map((activity) => `${subprocessNumberById.get(activity.id)} · ${activity.title}`)
    : [];
  const dossierUsageMethod = dossierTemplateUsage(dossierPresentationTemplate);

  const openDossier = (knowledgeId: string, shouldScroll = true) => {
    setSelectedKnowledgeId(knowledgeId);
    if (shouldScroll) {
      window.requestAnimationFrame(() => dossierRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };

  const selectGraphNode = (node: StructuredKnowledgeNode, shouldScroll: boolean) => {
    setSelectedGraphId(node.id);
    openDossier(node.id, shouldScroll);
  };

  const scrollTo = (target: "map" | "touch" | "touchpoints" | "graph" | "dossier") => {
    const refs = { map: mapRef, touch: touchRef, touchpoints: touchDetailRef, graph: graphRef, dossier: dossierRef };
    refs[target].current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const selectTouchActivity = (activityId: string, source: HTMLButtonElement) => {
    setSelectedActivityId(activityId);
    openDossier(`process:${activityId}`, false);
    setTouchSignal(null);

    if (touchSignalFrameRef.current !== null) window.cancelAnimationFrame(touchSignalFrameRef.current);
    if (touchSignalScrollTimerRef.current !== null) window.clearTimeout(touchSignalScrollTimerRef.current);
    if (touchSignalTimerRef.current !== null) window.clearTimeout(touchSignalTimerRef.current);

    touchSignalFrameRef.current = window.requestAnimationFrame(() => {
      const map = touchMapRef.current;
      const documentTarget = documentTouchSectionRef.current;
      const toolTarget = toolTouchSectionRef.current;
      if (!map || !documentTarget || !toolTarget) return;

      const mapRect = map.getBoundingClientRect();
      const sourceRect = source.getBoundingClientRect();
      const documentRect = documentTarget.getBoundingClientRect();
      const toolRect = toolTarget.getBoundingClientRect();
      const sourceX = sourceRect.left - mapRect.left + sourceRect.width / 2;
      const sourceY = sourceRect.bottom - mapRect.top - 2;
      const documentX = documentRect.left - mapRect.left + documentRect.width / 2;
      const toolX = toolRect.left - mapRect.left + toolRect.width / 2;
      const targetY = Math.min(documentRect.top, toolRect.top) - mapRect.top + 5;
      const splitX = (documentX + toolX) / 2;
      const splitY = Math.max(sourceY + 42, targetY - 48);
      const trunk = `M ${sourceX} ${sourceY} C ${sourceX} ${sourceY + 30}, ${splitX} ${splitY - 34}, ${splitX} ${splitY}`;
      const leftBranch = `M ${splitX} ${splitY} C ${splitX} ${splitY + 24}, ${documentX} ${targetY - 28}, ${documentX} ${targetY}`;
      const rightBranch = `M ${splitX} ${splitY} C ${splitX} ${splitY + 24}, ${toolX} ${targetY - 28}, ${toolX} ${targetY}`;

      touchSignalIdRef.current += 1;
      setTouchSignal({
        activityId,
        height: map.scrollHeight,
        id: touchSignalIdRef.current,
        leftBranch,
        rightBranch,
        trunk,
        width: map.scrollWidth,
      });
      touchSignalScrollTimerRef.current = window.setTimeout(() => {
        touchDetailRef.current?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
          block: "end",
        });
      }, 610);
      touchSignalTimerRef.current = window.setTimeout(() => setTouchSignal(null), 2100);
    });
  };

  const activeTouches = projectDocuments.flatMap((document) =>
    touchesForActivity(selectedActivity, document.id).map((touch) => ({ documentId: document.id, touch })),
  );
  const selectedDocumentHistory = touchActivities.flatMap((activity, activityIndex) => {
    const rawTouches = touchesForActivity(activity, selectedDocumentId).map((touch) => ({ documentId: selectedDocumentId, touch }));
    const priority = rawTouches.length
      ? Math.min(...rawTouches.map((item) => touchPriority[item.touch]))
      : Number.POSITIVE_INFINITY;
    const touches = rawTouches.sort((left, right) => cardTouchPriority[left.touch] - cardTouchPriority[right.touch]);
    return touches.length ? [{ activity, activityIndex, priority, touches }] : [];
  }).sort((left, right) => left.priority - right.priority || left.activityIndex - right.activityIndex);
  const documentInventory = projectDocuments.map((document, documentIndex) => {
    const touches = activeTouches
      .filter((item) => item.documentId === document.id)
      .map((item) => item.touch)
      .sort((left, right) => cardTouchPriority[left] - cardTouchPriority[right]);
    return {
      document,
      documentIndex,
      priority: touches.length ? cardTouchPriority[touches[0]] : Number.POSITIVE_INFINITY,
      touches,
    };
  });
  const visibleDocumentInventory = showAllDocuments
    ? documentInventory
    : documentInventory
      .filter((item) => item.touches.length)
      .sort((left, right) => left.priority - right.priority || left.documentIndex - right.documentIndex);
  const authoritativeToolByTitle = new Map<string, (typeof authoritativeTools)[number]>(
    authoritativeTools.map((tool) => [tool.title, tool]),
  );
  const activeManagementTools = selectedActivity.tools.map((title) => ({
    title,
    category: authoritativeToolByTitle.get(title)!.categoryId,
    relatedForm: false,
  }));
  const activeManagementToolTitles = new Set(activeManagementTools.map((tool) => tool.title));
  const toolInventoryCategories = managementToolCategories.map((category) => ({
    ...category,
    tools: authoritativeTools.filter((tool) => tool.categoryId === category.id),
  }));
  const visibleToolCategories = toolInventoryCategories
    .map((category) => ({
      ...category,
      tools: showAllTools
        ? category.tools
        : category.tools.filter((tool) => activeManagementToolTitles.has(tool.title)),
    }))
    .filter((category) => category.tools.length);
  const selectedTool = authoritativeToolByTitle.get(selectedToolTitle) ?? authoritativeTools[0];
  const selectedToolUsage = touchActivities.filter((activity) => activity.tools.includes(selectedTool.title));

  const toggleToolInventory = () => {
    if (showAllTools && !activeManagementToolTitles.has(selectedTool.title) && activeManagementTools[0]) {
      setSelectedToolTitle(activeManagementTools[0].title);
    }
    setShowAllTools((current) => !current);
  };

  const toggleDocumentInventory = () => {
    if (showAllDocuments && !documentInventory.find((item) => item.document.id === selectedDocumentId)?.touches.length) {
      const firstTouchedDocument = documentInventory.find((item) => item.touches.length);
      if (firstTouchedDocument) setSelectedDocumentId(firstTouchedDocument.document.id);
    }
    setShowAllDocuments((current) => !current);
  };

  return (
    <main className="knowledge-library">
      <section className="knowledge-hero">
        <div>
          <span className="hero-kicker">知识库 · 教材结构化模型</span>
          <h1>项目管理渐进式学习</h1>
          <p>用同一条时间轴理解阶段、管理过程、过程组和项目文档，再沿关系图谱进入知识档案。</p>
        </div>
        <div className="knowledge-hero-counts">
          <div><strong>5</strong><span>过程组</span></div>
          <div><strong>10</strong><span>管理过程</span></div>
          <div><strong>32</strong><span>项目文档</span></div>
          <div><strong>49</strong><span>子过程</span></div>
          <div><strong>{managementToolInventoryCount}</strong><span>工具和技术</span></div>
        </div>
      </section>

      <nav className="knowledge-section-nav" aria-label="知识库分区">
        <button onClick={() => scrollTo("map")}><span>01</span>生命周期地图</button>
        <button onClick={() => scrollTo("touch")}><span>02</span>管理子过程</button>
        <button onClick={() => scrollTo("touchpoints")}><span>03</span>文档和工具触点</button>
        <button onClick={() => scrollTo("graph")}><span>04</span>全局关系图谱</button>
        <button onClick={() => scrollTo("dossier")}><span>05</span>知识档案</button>
      </nav>

      <section className="knowledge-section" ref={mapRef}>
        <div className="knowledge-section-heading">
          <div><span className="section-index">01 / 生命周期地图</span><h2>阶段、管理过程与过程组在同一条轴上</h2></div>
        </div>

        <div className="knowledge-map-subsection">
          <div className="knowledge-map-subheading">
            <div><span>01</span><h3>生命周期管理过程地图</h3></div>
            <p>先沿生命周期看阶段，再看管理过程如何落位，以及过程组如何交叠介入。</p>
          </div>
          <div className="lifecycle-map panel">
            <div className="map-layer map-phase-layer">
              <div className="map-layer-label"><strong>生命周期阶段</strong></div>
              <div className="phase-columns">
                {lifecyclePhases.map((phase, index) => <div key={phase.id}><span>{index + 1}</span><strong>{phase.title}</strong><small>{phase.subtitle}</small></div>)}
              </div>
            </div>
            <div className="management-activity-lanes">
              {lifecycleActivities.map((activity, index) => (
                <div className="management-activity-row" key={activity.id}>
                  <button className="management-activity-name" onClick={() => openDossier(activity.knowledgeId)}>
                    <small>M{String(index + 1).padStart(2, "0")}</small><span>{activity.title}</span>
                  </button>
                  <div className="management-activity-grid" aria-label={`${activity.title}参与阶段：${activity.phases.join("、")}`}>
                    {activity.phases.map((phase) => {
                      const subprocessNumbers = subprocessNumbersByLifecycleSlot.get(`${activity.id}:${phase}`) ?? [];
                      return (
                        <span
                          className={`management-stage-block${phase === 1 && "halfStart" in activity && activity.halfStart ? " stage-half-start" : ""}${phase === 5 && "halfEnd" in activity && activity.halfEnd ? " stage-half-end" : ""}`}
                          key={phase}
                          style={{
                            gridColumn: `${(phase - 1) * 2 + 1} / span 2`,
                            gridTemplateColumns: `repeat(${Math.max(subprocessNumbers.length, 1)}, minmax(0, 1fr))`,
                          }}
                        >
                          {subprocessNumbers.map((number) => <small key={number}>{number}</small>)}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="map-process-matrix">
              {processGroupLanes.map((lane) => (
                <Fragment key={lane.id}>
                  <button className="process-name" onClick={() => openDossier(lane.knowledgeId)}>{lane.title}</button>
                  <div className="process-cells">
                    {lane.cells.map((cell, index) => (
                      <button key={`${lane.id}-${index}`} className={`process-cell process-${cell.state}`} onClick={() => openDossier(lane.knowledgeId)}>
                        {cell.label}
                      </button>
                    ))}
                  </div>
                </Fragment>
              ))}
            </div>
          </div>
        </div>

      </section>

      <section className="knowledge-section" ref={touchRef}>
        <div className="knowledge-section-heading">
          <div><span className="section-index">02 / 管理子过程</span><h2>49 个子过程与项目文档、管理工具的关系</h2></div>
          <span className="graph-current">当前活动：{selectedActivity.title}</span>
        </div>
        <div className="knowledge-map-subsection document-map-subsection">
          <div className="knowledge-map-subheading">
            <div><span>49</span><h3>完整管理子过程</h3></div>
            <p>选择任一子过程，在下方同时查看项目文档触点和工具与技术触点。</p>
          </div>
          <div className="document-touch-map panel" ref={touchMapRef}>
            {touchSignal && (
              <svg
                className="touch-signal-overlay"
                width={touchSignal.width}
                height={touchSignal.height}
                viewBox={`0 0 ${touchSignal.width} ${touchSignal.height}`}
                aria-hidden="true"
                key={touchSignal.id}
              >
                {["aura", "core"].map((layer) => (
                  <Fragment key={layer}>
                    <path className={`touch-signal-path touch-signal-${layer} touch-signal-trunk`} d={touchSignal.trunk} pathLength="1" />
                    <path className={`touch-signal-path touch-signal-${layer} touch-signal-branch`} d={touchSignal.leftBranch} pathLength="1" />
                    <path className={`touch-signal-path touch-signal-${layer} touch-signal-branch`} d={touchSignal.rightBranch} pathLength="1" />
                  </Fragment>
                ))}
              </svg>
            )}
            <div className="touch-activity-strip">
              {touchActivities.map((activity, index) => (
                <button
                  key={activity.id}
                  className={`${selectedActivityId === activity.id ? "active" : ""}${touchSignal?.activityId === activity.id ? " signal-origin" : ""}`}
                  onClick={(event) => selectTouchActivity(activity.id, event.currentTarget)}
                >
                  <small>S{String(index + 1).padStart(2, "0")} · {activity.area} · {activity.group}</small><strong>{activity.title}</strong>
                </button>
              ))}
            </div>
            <div className="touch-detail-grid" ref={touchDetailRef}>
              <section className={`document-touch-section${touchSignal ? " touch-target-flash" : ""}`} aria-labelledby="document-touch-title" ref={documentTouchSectionRef}>
                <div className="touch-panel-heading">
                  <div className="touch-title-row">
                    <h3 id="document-touch-title">项目文档</h3>
                    <button className="touch-view-toggle" onClick={toggleDocumentInventory}>{showAllDocuments ? "仅看触点" : "展开全部"}</button>
                  </div>
                  <strong>{activeTouches.length}<small> / {projectDocuments.length} 项</small></strong>
                </div>
                <div className="document-card-grid">
                  {visibleDocumentInventory.map(({ document, touches }) => {
                    const visualTouch = touches.includes("create") ? "create" : touches.includes("update") ? "update" : touches.includes("input") ? "input" : "none";
                    return (
                      <button
                        key={document.id}
                        className={`document-touch-card document-${visualTouch} ${selectedDocumentId === document.id ? "selected" : ""}`}
                        onClick={() => { setSelectedDocumentId(document.id); openDossier(document.knowledgeId, false); }}
                        aria-label={`${document.title}，${document.category}，${touches.length ? touches.map((touch) => touchLabels[touch]).join("，") : "不涉及"}`}
                      >
                        <small>{document.id}</small>
                        <strong>{document.title}</strong>
                        {touches.length > 0 && (
                          <span className="document-touch-icons" aria-hidden="true">
                            {touches.map((touch) => <DocumentTouchIcon key={touch} touch={touch} />)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="document-history">
                  <div><span className="section-index">文档演进路径<b className="path-trigger-count">{selectedDocumentHistory.length}</b></span><h3>{selectedDocument.title}</h3></div>
                  <div className="document-history-track">
                    {selectedDocumentHistory.map(({ activity, touches }) => (
                      <button
                        key={activity.id}
                        onClick={() => setSelectedActivityId(activity.id)}
                        aria-label={`${activity.title}，${touches.map((item) => touchLabels[item.touch]).join("，")}`}
                      >
                        <small>{activity.area} · {activity.group}</small><strong>{activity.title}</strong>
                        <span className="document-history-touch-icons" aria-hidden="true">
                          {touches.map((item) => <DocumentTouchIcon key={item.touch} touch={item.touch} />)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section className={`tool-touch-section${touchSignal ? " touch-target-flash" : ""}`} aria-labelledby="tool-touch-title" ref={toolTouchSectionRef}>
                <div className="touch-panel-heading">
                  <div className="touch-title-row">
                    <h3 id="tool-touch-title">工具与技术</h3>
                    <button className="touch-view-toggle" onClick={toggleToolInventory}>{showAllTools ? "仅看触点" : "展开全部"}</button>
                  </div>
                  <strong>{activeManagementTools.length}<small> / {managementToolInventoryCount} 项</small></strong>
                </div>

                <div className="tool-inventory-grid" aria-live="polite" aria-label={`${showAllTools ? "全部133项工具与技术" : "当前工具触点"}；${selectedActivity.title}触发${activeManagementTools.length}项`}>
                  {visibleToolCategories.map((category) => (
                    <section className={`tool-inventory-category tool-category-${category.id}`} key={category.id}>
                      <header><span>{category.label}</span><strong>{category.tools.length}</strong></header>
                      <div className="tool-chip-grid">
                        {category.tools.map((tool) => {
                          const isActive = activeManagementToolTitles.has(tool.title);
                          const isSelected = selectedTool.title === tool.title;
                          const toolNumber = managementToolNumberByTitle.get(tool.title);
                          const toolKnowledgeId = managementToolIdByTitle.get(tool.title);
                          return (
                            <button
                              className={`tool-chip${isActive ? " active" : ""}${isSelected ? " selected" : ""}`}
                              key={tool.title}
                              onClick={() => {
                                setSelectedToolTitle(tool.title);
                                if (toolKnowledgeId) openDossier(toolKnowledgeId, false);
                              }}
                              aria-pressed={isSelected}
                            >
                              <small className="tool-chip-number">T{String(toolNumber).padStart(3, "0")}</small>
                              <strong>{tool.title}</strong>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
                <div className="document-history tool-history">
                  <div><span className="section-index">工具使用路径<b className="path-trigger-count">{selectedToolUsage.length}</b></span><h3>{selectedTool.title}</h3></div>
                  <div className="document-history-track tool-history-track">
                    {selectedToolUsage.length ? selectedToolUsage.map((activity) => (
                      <button key={activity.id} onClick={() => setSelectedActivityId(activity.id)}>
                        <small>{activity.area} · {activity.group}</small><strong>{activity.title}</strong><span>使用该工具</span>
                      </button>
                    )) : <div className="tool-history-empty">暂无子过程触点</div>}
                  </div>
                </div>
              </section>
            </div>
            <ProjectDocumentFlowDiagram
              selectedKnowledgeId={selectedKnowledgeId}
              onSelectKnowledge={(knowledgeId) => openDossier(knowledgeId, false)}
            />
          </div>
        </div>
      </section>

      <section className="knowledge-section" ref={graphRef}>
        <div className="knowledge-section-heading">
          <div><span className="section-index">04 / 全局关系图谱</span><h2>缩小看全局，放大进入知识点</h2></div>
          <span className="graph-current">
            {selectedGraphId
              ? `当前聚焦：${structuredKnowledgeGraph.nodes.find((node) => node.id === selectedGraphId)?.title}`
              : `${structuredKnowledgeGraphStats.total} 个核心节点 · 全局网络`}
          </span>
        </div>
        <div className="knowledge-graph panel">
          <KnowledgeGraphCanvas
            edges={structuredKnowledgeGraph.edges}
            nodes={structuredKnowledgeGraph.nodes}
            onSelect={selectGraphNode}
            selectedId={selectedGraphId}
          />
          <div className="graph-footer">
            <span>5 过程组 + 10 管理过程 + 49 子过程 + 32 项目文档 + 133 工具与技术 = {structuredKnowledgeGraphStats.total} 个核心节点</span>
            <span>点击激活滚轮 · 拖动节点改变局部网络 · 双击打开知识档案</span>
          </div>
        </div>
      </section>

      <section className="knowledge-section knowledge-dossier-section" ref={dossierRef}>
        <div className="knowledge-section-heading">
          <div><span className="section-index">05 / 知识档案</span><h2>{dossierKnowledgeNumber && <small className="dossier-knowledge-number">{dossierKnowledgeNumber}</small>}{selectedTopic.title}</h2></div>
          <span className="dossier-location">知识库内连续阅读 · 不跳转项目实验室</span>
        </div>
        <article className="knowledge-dossier panel">
          <aside className="dossier-index">
            <span className={`dossier-kind kind-${selectedTopic.kind}`}>{kindLabels[selectedTopic.kind]}</span>
            <dl>
              <div><dt>知识领域</dt><dd>{selectedTopic.domain}</dd></div>
              {selectedTopic.processGroup && <div><dt>所属过程组</dt><dd>{selectedTopic.processGroup}</dd></div>}
              <div><dt>教材依据</dt><dd>{selectedTopic.source}</dd></div>
            </dl>
          </aside>
          <div className="dossier-content">
            {selectedTopic.kind === "process-group" && (
              <>
                <DossierTextField label="定义" content={dossierDefinition} prominent />
                <DossierTextField label="作用" content={dossierRole || selectedTopic.plainLanguage} />
                <DossierListField label="包含的项目活动" items={processGroupActivities} />
              </>
            )}

            {selectedTopic.kind === "management-area" && (
              <>
                <DossierTextField label="定义" content={dossierDefinition} prominent />
                <DossierTextField label="作用" content={dossierRole || selectedTopic.plainLanguage} />
                <DossierListField label="包含的项目活动" items={managementAreaActivities} />
                <DossierTextField label="裁剪考虑因素" content="" />
              </>
            )}

            {selectedTopic.kind === "artifact" && (
              <>
                <DossierTextField label="定义" content={dossierDefinition} prominent />
                <DossierTextField label="作用" content={dossierSupplement?.role || dossierRole} />
                <DossierTextField label="包含内容" content={dossierRemainingContent(selectedTopic.sourceContent)} />
                <DossierUsageField content={dossierUsageMethod} image={dossierSupplement?.usageImage} />
              </>
            )}

            {selectedTopic.kind === "process" && (
              <>
                <DossierTextField label="定义" content={dossierDefinition} prominent />
                <DossierTextField label="作用" content={dossierRole || dossierSubprocess?.purpose} />
                <DossierTextField label="开展时机" content={dossierTiming(selectedTopic.sourceContent) || selectedTopic.timing} />
                <div className="itto-columns">
                  <section><span>输入</span><ul>{(dossierSubprocess?.inputs ?? selectedTopic.inputs).map((item) => <li key={item}>{item}</li>)}</ul></section>
                  <section><span>工具与技术</span><ul>{(dossierSubprocess?.tools ?? selectedTopic.tools).map((item) => <li key={item}>{item}</li>)}</ul></section>
                  <section><span>输出</span><ul>{(dossierSubprocess?.outputs ?? selectedTopic.outputs).map((item) => <li key={item}>{item}</li>)}</ul></section>
                </div>
              </>
            )}

            {selectedTopic.kind === "tool" && (
              <>
                <DossierTextField label="定义" content={dossierSupplement?.definition || dossierDefinition} prominent />
                <DossierTextField label="作用" content={dossierSupplement?.role || dossierRole} />
                <DossierTextField label="包含内容" content={dossierSupplement?.contents || dossierRemainingContent(selectedTopic.sourceContent)} />
                <DossierUsageField content={dossierSupplement?.usageMethod || dossierUsageMethod} image={dossierSupplement?.usageImage} />
              </>
            )}

            {selectedTopic.kind === "framework" && (
              <>
                <DossierTextField label="定义" content={dossierDefinition} prominent />
                <DossierTextField label="作用" content={selectedTopic.plainLanguage} />
              </>
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
