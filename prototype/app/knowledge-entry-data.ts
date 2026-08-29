import { structuredKnowledgeGraph, type StructuredKnowledgeNode } from "./knowledge-graph-data";
import { authoritativeCoreNotes, authoritativeTools } from "./obsidian-knowledge.generated";

export type KnowledgeEntry = {
  canonicalId: string;
  displayId: string;
  title: string;
  kind: string;
  category: string;
  content: string;
  sourcePath: string | null;
  related: StructuredKnowledgeNode[];
};

const nodeById = new Map(structuredKnowledgeGraph.nodes.map((node) => [node.id, node]));
const coreNoteByTitle = new Map(authoritativeCoreNotes.map((note) => [note.title, note]));
const toolById = new Map(authoritativeTools.map((tool, index) => [`tool:${String(index + 1).padStart(3, "0")}`, tool]));

const kindLabels: Record<StructuredKnowledgeNode["type"], string> = {
  "process-group": "过程组",
  "knowledge-area": "管理过程",
  process: "子过程",
  document: "项目文件",
  tool: "工具与技术",
};

export function normalizeKnowledgeReferenceId(referenceId: string): string | null {
  const value = referenceId.trim();
  if (/^D\d{2}$/i.test(value)) return `document:${value.toUpperCase()}`;
  if (/^T\d{3}$/i.test(value)) return `tool:${value.slice(1)}`;
  if (/^document:D\d{2}$/i.test(value)) return `document:${value.slice(-3).toUpperCase()}`;
  if (/^tool:\d{3}$/i.test(value)) return value.toLowerCase();
  return nodeById.has(value) ? value : null;
}

export function knowledgeReferenceExists(referenceId: string): boolean {
  const canonicalId = normalizeKnowledgeReferenceId(referenceId);
  return canonicalId !== null && nodeById.has(canonicalId);
}

function displayKnowledgeId(canonicalId: string): string {
  if (canonicalId.startsWith("document:")) return canonicalId.slice("document:".length);
  if (canonicalId.startsWith("tool:")) return `T${canonicalId.slice("tool:".length)}`;
  return canonicalId;
}

function cleanKnowledgeContent(content: string): string {
  return content
    .replace(/!\[\[[^\]]+\]\]/g, "")
    .replace(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g, (_match, target, alias) => alias ?? target)
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function resolveKnowledgeEntry(referenceId: string): KnowledgeEntry | null {
  const canonicalId = normalizeKnowledgeReferenceId(referenceId);
  if (!canonicalId) return null;
  const node = nodeById.get(canonicalId);
  if (!node) return null;

  const tool = toolById.get(canonicalId);
  const note = coreNoteByTitle.get(node.title);
  const relatedIds = new Set<string>();
  for (const edge of structuredKnowledgeGraph.edges) {
    if (edge.source === canonicalId) relatedIds.add(edge.target);
    if (edge.target === canonicalId) relatedIds.add(edge.source);
  }

  return {
    canonicalId,
    displayId: displayKnowledgeId(canonicalId),
    title: node.title,
    kind: kindLabels[node.type],
    category: node.category,
    content: cleanKnowledgeContent(tool?.content ?? note?.content ?? node.description),
    sourcePath: tool?.sourcePath ?? note?.sourcePath ?? null,
    related: [...relatedIds].flatMap((id) => {
      const relatedNode = nodeById.get(id);
      return relatedNode ? [relatedNode] : [];
    }).slice(0, 8),
  };
}
