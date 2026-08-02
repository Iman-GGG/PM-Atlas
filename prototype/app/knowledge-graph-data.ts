import { managementAreas } from "./management-area-data";
import {
  managementToolIdByTitle,
  managementToolCategories,
} from "./management-tool-data";
import { obsidianProjectDocuments as structuredProjectDocuments } from "./project-document-data";
import {
  authoritativeCoreNotes,
  authoritativeTools,
  authoritativeWikiRelations,
} from "./obsidian-knowledge.generated";

export type StructuredKnowledgeNodeType = "process-group" | "knowledge-area" | "process" | "document" | "tool";

export type StructuredKnowledgeNode = {
  id: string;
  title: string;
  type: StructuredKnowledgeNodeType;
  category: string;
  description: string;
  areaId?: string;
  areaTitle?: string;
  processGroup?: string;
  processId?: string;
  inputs?: string[];
  outputs?: string[];
  tools?: string[];
};

export type StructuredKnowledgeRelation =
  | "belongs-process-group"
  | "belongs-knowledge-area"
  | "input"
  | "output"
  | "uses"
  | "creates"
  | "updates"
  | "related";

export type StructuredKnowledgeEdge = {
  id: string;
  source: string;
  target: string;
  relation: StructuredKnowledgeRelation;
  label: string;
};

const processGroups = [
  { id: "init", title: "启动过程组", match: "启动", description: "定义新项目或新阶段并取得正式授权。" },
  { id: "plan", title: "规划过程组", match: "规划", description: "明确目标并制定实现目标所需的行动方案。" },
  { id: "execute", title: "执行过程组", match: "执行", description: "完成项目管理计划中确定的工作。" },
  { id: "monitor", title: "监控过程组", match: "监控", description: "跟踪、审查和调整项目进展与绩效。" },
  { id: "close", title: "收尾过程组", match: "收尾", description: "正式完成或结束项目、阶段或合同。" },
] as const;

const relationLabels: Record<StructuredKnowledgeRelation, string> = {
  "belongs-process-group": "所属过程组",
  "belongs-knowledge-area": "所属知识领域",
  input: "输入",
  output: "输出",
  uses: "使用工具",
  creates: "创建",
  updates: "更新",
  related: "知识链接",
};

const toolCategoryLabels = new Map(managementToolCategories.map((category) => [category.id, category.label]));
const authoritativeContent = new Map<string, (typeof authoritativeCoreNotes)[number]>(
  authoritativeCoreNotes.map((note) => [note.title, note]),
);
const contentFor = (title: string, fallback: string) => authoritativeContent.get(title)?.content || fallback;
const toolIndex = new Map<string, { id: string; category: (typeof authoritativeTools)[number]["categoryId"] }>(authoritativeTools.map((tool) => [
  tool.title,
  { id: managementToolIdByTitle.get(tool.title)!, category: tool.categoryId },
]));

function documentsMentionedBy(value: string) {
  if (value === "项目文件" || value === "项目文件更新") return [];
  return structuredProjectDocuments.filter((document) => document.aliases.some((alias) => value.includes(alias)));
}

function buildStructuredKnowledgeGraph() {
  const nodes: StructuredKnowledgeNode[] = [];
  const edges: StructuredKnowledgeEdge[] = [];
  const edgeKeys = new Set<string>();

  const addEdge = (source: string, target: string, relation: StructuredKnowledgeRelation) => {
    const key = `${source}|${target}|${relation}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push({ id: `edge:${edges.length + 1}`, source, target, relation, label: relationLabels[relation] });
  };

  processGroups.forEach((group) => nodes.push({
    id: `group:${group.id}`,
    title: group.title,
    type: "process-group",
    category: "过程组",
    description: contentFor(group.title, group.description),
    processGroup: group.match,
  }));

  managementAreas.forEach((area) => nodes.push({
    id: `area:${area.id}`,
    title: area.title,
    type: "knowledge-area",
    category: "管理过程",
    description: contentFor(area.title, area.description),
    areaId: area.id,
    areaTitle: area.title,
  }));

  managementAreas.forEach((area) => {
    area.processes.forEach((process) => {
      const nodeId = `process:${process.id}`;
      const tools = process.tools.filter((title) => toolIndex.has(title));
      nodes.push({
        id: nodeId,
        title: process.title,
        type: "process",
        category: "子过程",
        description: contentFor(process.title, process.purpose),
        areaId: area.id,
        areaTitle: area.title,
        processGroup: process.group,
        processId: process.id,
        inputs: process.inputs,
        outputs: process.outputs,
        tools,
      });
      const group = processGroups.find((item) => item.match === process.group)!;
      addEdge(`group:${group.id}`, nodeId, "belongs-process-group");
      addEdge(`area:${area.id}`, nodeId, "belongs-knowledge-area");

      process.inputs.forEach((input) => {
        documentsMentionedBy(input).forEach((document) => addEdge(`document:${document.id}`, nodeId, "input"));
      });
      process.outputs.forEach((output) => {
        documentsMentionedBy(output).forEach((document) => {
          addEdge(nodeId, `document:${document.id}`, "output");
          addEdge(nodeId, `document:${document.id}`, output.includes("更新") ? "updates" : "creates");
        });
      });
      tools.forEach((title) => addEdge(nodeId, toolIndex.get(title)!.id, "uses"));
    });
  });

  structuredProjectDocuments.forEach((document) => nodes.push({
    id: `document:${document.id}`,
    title: document.title,
    type: "document",
    category: "32项目文件",
    description: contentFor(document.title, `${document.title}是项目管理过程中创建、引用或持续更新的结构化项目文件。`),
  }));

  authoritativeTools.forEach((authoritativeTool) => nodes.push({
    id: toolIndex.get(authoritativeTool.title)!.id,
    title: authoritativeTool.title,
    type: "tool",
    category: toolCategoryLabels.get(authoritativeTool.categoryId) ?? authoritativeTool.category,
    description: authoritativeTool.content,
  }));

  const nodeIdsByTitle = new Map<string, string[]>();
  nodes.forEach((node) => nodeIdsByTitle.set(node.title, [...(nodeIdsByTitle.get(node.title) ?? []), node.id]));
  authoritativeWikiRelations.forEach((relation) => {
    const sourceIds = nodeIdsByTitle.get(relation.sourceTitle) ?? [];
    const targetIds = nodeIdsByTitle.get(relation.targetTitle) ?? [];
    sourceIds.forEach((source) => targetIds.forEach((target) => {
      if (source !== target) addEdge(source, target, "related");
    }));
  });

  return { nodes, edges };
}

export const structuredKnowledgeGraph = buildStructuredKnowledgeGraph();

export const structuredKnowledgeGraphStats = {
  processGroups: structuredKnowledgeGraph.nodes.filter((node) => node.type === "process-group").length,
  knowledgeAreas: structuredKnowledgeGraph.nodes.filter((node) => node.type === "knowledge-area").length,
  processes: structuredKnowledgeGraph.nodes.filter((node) => node.type === "process").length,
  documents: structuredKnowledgeGraph.nodes.filter((node) => node.type === "document").length,
  tools: structuredKnowledgeGraph.nodes.filter((node) => node.type === "tool").length,
  total: structuredKnowledgeGraph.nodes.length,
  relations: structuredKnowledgeGraph.edges.length,
};
