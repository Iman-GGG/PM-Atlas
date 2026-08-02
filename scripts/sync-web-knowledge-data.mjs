#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const indexPath = path.join(projectRoot, "knowledge-base", "obsidian-index.json");
const outputPath = path.join(projectRoot, "prototype", "app", "obsidian-knowledge.generated.ts");
const index = JSON.parse(await fs.readFile(indexPath, "utf8"));

const categoryIds = {
  数据收集: "collection",
  数据分析: "analysis",
  数据表现: "representation",
  决策: "decision",
  沟通: "communication",
  人际关系和团队技能: "interpersonal",
  其他工具和技术: "other",
};

const correctionPolicy = {
  excludedFromCoreTools: new Set(["气泡图"]),
  addedCoreTools: [
    {
      title: "会议",
      category: "其他工具和技术",
      content: "会议是为达成项目目标而组织相关人员进行讨论、决策、协调或信息交流的工具与技术。原始知识领域正文已多次将其列入工具与技术。",
      sourcePath: "项目整合管理.md 等知识领域正文",
    },
    {
      title: "测试/产品评估",
      category: "其他工具和技术",
      content: "测试/产品评估是有组织、结构化的调查，用于依据项目需求提供有关被测产品或可交付成果质量的客观信息。原始项目质量管理正文写作“测试产品评估”。",
      sourcePath: "项目质量管理.md",
    },
  ],
};

const nodeById = new Map(index.nodes.map((node) => [node.id, node]));
const catalogKeys = ["processGroups", "knowledgeAreas", "projectDocuments", "processes"];
const coreIds = new Set(catalogKeys.flatMap((key) => index.catalogs[key].members.map((member) => member.id)));

const tools = index.catalogs.tools.memberships
  .filter((membership) => !correctionPolicy.excludedFromCoreTools.has(membership.memberTitle))
  .map((membership) => {
    const node = nodeById.get(membership.memberId);
    return {
      title: membership.memberTitle,
      category: membership.category,
      categoryId: categoryIds[membership.category],
      content: node?.content?.trim() || `${membership.memberTitle}是${membership.category}中的工具与技术。`,
      sourcePath: node?.relativePath || membership.memberId,
    };
  });

for (const added of correctionPolicy.addedCoreTools) {
  tools.push({ ...added, categoryId: categoryIds[added.category] });
}

const uniqueTools = [];
const seenToolTitles = new Set();
for (const tool of tools) {
  if (seenToolTitles.has(tool.title)) continue;
  seenToolTitles.add(tool.title);
  uniqueTools.push(tool);
}

const toolTitleAliases = new Map([
  ["检查单", "核查表"],
  ["箭线图法（双代号网络图）", "箭线图法"],
  ["三点估算", "计划评审技术"],
  ["测试产品评估", "测试/产品评估"],
]);
const canonicalToolTitles = new Set(uniqueTools.map((tool) => tool.title));
const projectDocumentTitles = new Set(index.catalogs.projectDocuments.members.map((member) => member.title));
const processTitles = new Set(index.catalogs.processes.members.map((member) => member.title));

const linkTargets = (line) => [...line.matchAll(/!?\[\[([^\]]+)\]\]/g)]
  .map((match) => match[1].split("|")[0].split("#")[0].trim());
const lineIndent = (line) => {
  const prefix = line.match(/^[\t ]*/)?.[0] ?? "";
  return [...prefix].reduce((total, character) => total + (character === "\t" ? 4 : 1), 0);
};
const uniqueText = (values) => [...new Set(values.filter(Boolean))];

const processDetails = [];
for (const area of index.catalogs.knowledgeAreas.members) {
  const areaNode = nodeById.get(area.id);
  if (!areaNode) continue;
  const lines = areaNode.content.split(/\r?\n/);
  const starts = [];
  lines.forEach((line, lineIndex) => {
    const target = linkTargets(line).find((title) => processTitles.has(title));
    if (target && lineIndent(line) === 0) starts.push({ lineIndex, title: target });
  });

  starts.forEach((start, startIndex) => {
    const end = starts[startIndex + 1]?.lineIndex ?? lines.length;
    const inputs = [];
    const outputs = [];
    const toolsForProcess = [];
    const documentInputs = [];
    const documentCreates = [];
    const documentUpdates = [];
    const outputStack = [];
    let section = null;

    for (const line of lines.slice(start.lineIndex + 1, end)) {
      const trimmed = line.trim().replace(/^[-*]\s*/, "");
      if (/^输入\s*$/.test(trimmed)) { section = "input"; continue; }
      if (/^(工具和技术|工具与技术)\s*$/.test(trimmed)) { section = "tool"; continue; }
      if (/^输出\s*$/.test(trimmed)) { section = "output"; outputStack.length = 0; continue; }
      if (!section || trimmed === "---") continue;

      const targets = linkTargets(line);
      const indent = lineIndent(line);
      if (section === "output") {
        while (outputStack.length && outputStack.at(-1).indent >= indent) outputStack.pop();
      }
      const hasUpdateMarker = /[（(]更新[）)]|更新$/.test(trimmed);
      const inheritedUpdate = section === "output" && outputStack.some((entry) => entry.update);
      const isUpdate = hasUpdateMarker || inheritedUpdate;

      if (section === "input") {
        inputs.push(...targets);
        targets.filter((title) => projectDocumentTitles.has(title)).forEach((title) => documentInputs.push(title));
      } else if (section === "output") {
        outputs.push(...targets.map((title) => isUpdate ? `${title}（更新）` : title));
        targets.filter((title) => projectDocumentTitles.has(title)).forEach((title) => {
          (isUpdate ? documentUpdates : documentCreates).push(title);
        });
        if (targets.length) outputStack.push({ indent, update: isUpdate });
      } else if (section === "tool") {
        for (const target of targets) {
          const normalized = toolTitleAliases.get(target) ?? target;
          if (canonicalToolTitles.has(normalized)) toolsForProcess.push(normalized);
        }
        const plainCandidate = toolTitleAliases.get(trimmed) ?? trimmed;
        if (canonicalToolTitles.has(plainCandidate)) toolsForProcess.push(plainCandidate);
      }
    }

    processDetails.push({
      title: start.title,
      areaTitle: area.title,
      inputs: uniqueText(inputs),
      outputs: uniqueText(outputs),
      tools: uniqueText(toolsForProcess),
      documentInputs: uniqueText(documentInputs),
      documentCreates: uniqueText(documentCreates),
      documentUpdates: uniqueText(documentUpdates),
      sourcePath: areaNode.relativePath,
    });
  });
}

const processDetailByTitle = new Map();
for (const detail of processDetails) {
  const score = detail.inputs.length + detail.outputs.length + detail.tools.length;
  const previous = processDetailByTitle.get(detail.title);
  const previousScore = previous ? previous.inputs.length + previous.outputs.length + previous.tools.length : -1;
  if (score > previousScore) processDetailByTitle.set(detail.title, detail);
}
const authoritativeProcessDetails = [...processDetailByTitle.values()];
if (authoritativeProcessDetails.length !== 49) throw new Error(`Expected 49 process details, received ${authoritativeProcessDetails.length}`);

for (const membership of index.catalogs.tools.memberships) {
  if (!correctionPolicy.excludedFromCoreTools.has(membership.memberTitle)) coreIds.add(membership.memberId);
}

const coreNotes = [...coreIds]
  .map((id) => nodeById.get(id))
  .filter(Boolean)
  .map((node) => ({ title: node.title, content: node.content.trim(), sourcePath: node.relativePath }));

for (const added of correctionPolicy.addedCoreTools) {
  coreNotes.push({ title: added.title, content: added.content, sourcePath: added.sourcePath });
}

const coreTitles = new Set(coreNotes.map((note) => note.title));
const titleById = new Map(index.nodes.map((node) => [node.id, node.title]));
const wikiRelations = [];
const relationKeys = new Set();
for (const edge of index.edges) {
  const sourceTitle = titleById.get(edge.source);
  const targetTitle = edge.target ? titleById.get(edge.target) : null;
  if (!sourceTitle || !targetTitle || !coreTitles.has(sourceTitle) || !coreTitles.has(targetTitle)) continue;
  const key = `${sourceTitle}|${targetTitle}`;
  if (relationKeys.has(key)) continue;
  relationKeys.add(key);
  wikiRelations.push({ sourceTitle, targetTitle, embed: edge.embed });
}

const categories = Object.entries(categoryIds).map(([label, id]) => ({
  id,
  label,
  count: uniqueTools.filter((tool) => tool.category === label).length,
}));

if (uniqueTools.length !== 133) throw new Error(`Expected 133 corrected tools, received ${uniqueTools.length}`);
if (coreNotes.length !== 229) throw new Error(`Expected 229 core notes, received ${coreNotes.length}`);

const generated = `// Generated by scripts/sync-web-knowledge-data.mjs. Do not edit by hand.\n\n` +
  `export type AuthoritativeToolCategoryId = ${JSON.stringify(Object.values(categoryIds)).replaceAll('"', '\"').replace(/^\[/, "").replace(/\]$/, "").split(",").join(" | ")};\n\n` +
  `export const authoritativeToolCategories = ${JSON.stringify(categories, null, 2)} as const;\n\n` +
  `export const authoritativeTools = ${JSON.stringify(uniqueTools, null, 2)} as const;\n\n` +
  `export const authoritativeCoreNotes = ${JSON.stringify(coreNotes, null, 2)} as const;\n\n` +
  `export const authoritativeWikiRelations = ${JSON.stringify(wikiRelations, null, 2)} as const;\n\n` +
  `export const authoritativeProcessDetails = ${JSON.stringify(authoritativeProcessDetails, null, 2)} as const;\n\n` +
  `export const authoritativeCoreStats = ${JSON.stringify({
    processGroups: 5,
    knowledgeAreas: 10,
    projectDocuments: 32,
    processes: 49,
    tools: uniqueTools.length,
    total: coreNotes.length,
  }, null, 2)} as const;\n`;

await fs.writeFile(outputPath, generated);
console.log(JSON.stringify({ outputPath, categories, coreNotes: coreNotes.length, processDetails: authoritativeProcessDetails.length, wikiRelations: wikiRelations.length }, null, 2));
