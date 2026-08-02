#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const [sourceArgument, outputArgument] = process.argv.slice(2);

if (!sourceArgument || !outputArgument) {
  console.error("Usage: node build-obsidian-knowledge-index.mjs <vault-directory> <output-directory>");
  process.exit(1);
}

const sourceDirectory = path.resolve(sourceArgument);
const outputDirectory = path.resolve(outputArgument);
const supportedExtensions = new Set([".md", ".base"]);
const ordinaryConceptTargets = new Set(["产品需求", "管理审查"]);

const catalogDefinitions = [
  { key: "processGroups", title: "5大管理过程组", expected: 5 },
  { key: "performanceDomains", title: "8大绩效域", expected: 8 },
  { key: "tailoringFactors", title: "10大管理需要裁剪因素", expected: 10 },
  { key: "knowledgeAreas", title: "10大知识领域", expected: 10 },
  { key: "projectDocuments", title: "32项目文件", expected: 32 },
  { key: "toolCategories", title: "133个工具和技术", expected: 7 },
];

const normalizePath = (value) => value.split(path.sep).join("/");
const stripExtension = (value) => value.replace(/\.(md|base)$/i, "");
const titleFromPath = (relativePath) => path.basename(relativePath, path.extname(relativePath));
const unique = (values) => [...new Set(values)];
const sortText = (left, right) => left.localeCompare(right, "zh-CN");

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => sortText(a.name, b.name))) {
    if (entry.name === ".obsidian" || entry.name === ".trash" || entry.name.startsWith(".")) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(absolutePath)));
    else if (supportedExtensions.has(path.extname(entry.name).toLowerCase())) files.push(absolutePath);
  }
  return files;
}

function removeCode(content) {
  return content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`\n]*`/g, " ");
}

function parseTags(content) {
  const withoutCode = removeCode(content);
  const tags = [];
  for (const match of withoutCode.matchAll(/(^|[\s,(，；;])#([\p{L}\p{N}_/-]+)/gu)) {
    tags.push(match[2].replace(/[，。；;、,.!?！？:：]+$/u, ""));
  }
  const frontmatter = content.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
  if (frontmatter) {
    const inline = frontmatter[1].match(/^tags\s*:\s*\[([^\]]*)\]/m);
    if (inline) {
      for (const tag of inline[1].split(",")) tags.push(tag.trim().replace(/^['"]|['"]$/g, ""));
    }
    const block = frontmatter[1].match(/^tags\s*:\s*\n((?:\s+-\s+.*\n?)*)/m);
    if (block) {
      for (const match of block[1].matchAll(/^\s+-\s+(.+)$/gm)) tags.push(match[1].trim().replace(/^['"]|['"]$/g, ""));
    }
  }
  return unique(tags.filter(Boolean)).sort(sortText);
}

function parseWikiLinks(content) {
  const links = [];
  const pattern = /(!)?\[\[([^\]]+)\]\]/g;
  for (const match of content.matchAll(pattern)) {
    const rawInner = match[2].trim();
    const [targetAndHeading, ...aliasParts] = rawInner.split("|");
    const [targetPart, ...headingParts] = targetAndHeading.split("#");
    const target = targetPart.trim();
    if (!target) continue;
    links.push({
      raw: match[0],
      rawTarget: target,
      alias: aliasParts.length ? aliasParts.join("|").trim() : null,
      heading: headingParts.length ? headingParts.join("#").trim() : null,
      embed: Boolean(match[1]),
      offset: match.index ?? null,
    });
  }
  return links;
}

function parseBaseRules(content) {
  const tags = [];
  for (const match of content.matchAll(/file\.tags\.contains\(\s*["']([^"']+)["']\s*\)/g)) tags.push(match[1]);
  return { requiredTags: unique(tags).sort(sortText) };
}

function buildResolver(nodes) {
  const byRelativePath = new Map();
  const byStem = new Map();
  const byTitle = new Map();
  for (const node of nodes) {
    const stem = stripExtension(node.relativePath);
    byRelativePath.set(node.relativePath, node.id);
    byRelativePath.set(stem, node.id);
    const stemKey = stem.toLocaleLowerCase("zh-CN");
    const titleKey = node.title.toLocaleLowerCase("zh-CN");
    if (!byStem.has(stemKey)) byStem.set(stemKey, []);
    if (!byTitle.has(titleKey)) byTitle.set(titleKey, []);
    byStem.get(stemKey).push(node.id);
    byTitle.get(titleKey).push(node.id);
  }

  return (sourceNode, rawTarget) => {
    const cleaned = normalizePath(rawTarget.replace(/^\.\//, "").trim());
    const sourceDirectoryName = path.posix.dirname(sourceNode.relativePath);
    const candidates = [
      cleaned,
      `${cleaned}.md`,
      `${cleaned}.base`,
      normalizePath(path.posix.join(sourceDirectoryName, cleaned)),
      normalizePath(path.posix.join(sourceDirectoryName, `${cleaned}.md`)),
      normalizePath(path.posix.join(sourceDirectoryName, `${cleaned}.base`)),
    ];
    for (const candidate of candidates) {
      if (byRelativePath.has(candidate)) return { id: byRelativePath.get(candidate), ambiguous: false, candidates: [] };
    }
    const stemMatches = byStem.get(stripExtension(cleaned).toLocaleLowerCase("zh-CN")) ?? [];
    if (stemMatches.length === 1) return { id: stemMatches[0], ambiguous: false, candidates: [] };
    const titleMatches = byTitle.get(path.posix.basename(stripExtension(cleaned)).toLocaleLowerCase("zh-CN")) ?? [];
    if (titleMatches.length === 1) return { id: titleMatches[0], ambiguous: false, candidates: [] };
    const matches = unique([...stemMatches, ...titleMatches]);
    return { id: null, ambiguous: matches.length > 1, candidates: matches.sort(sortText) };
  };
}

function directResolvedTargets(nodeId, edges, nodeById) {
  return unique(
    edges
      .filter((edge) => edge.source === nodeId && edge.target)
      .map((edge) => edge.target),
  )
    .map((id) => nodeById.get(id))
    .filter(Boolean);
}

function catalogEntry(definition, nodes, edges, nodeById, warnings) {
  const indexNode = nodes.find((node) => node.extension === ".md" && node.title === definition.title);
  if (!indexNode) {
    warnings.push({ type: "missing-catalog", catalog: definition.title });
    return { ...definition, sourceNodeId: null, members: [], actual: 0, matchesExpected: false };
  }
  const members = directResolvedTargets(indexNode.id, edges, nodeById)
    .filter((node) => node.extension === ".md")
    .map((node) => ({ id: node.id, title: node.title, relativePath: node.relativePath }));
  const result = { ...definition, sourceNodeId: indexNode.id, members, actual: members.length, matchesExpected: members.length === definition.expected };
  if (!result.matchesExpected) warnings.push({ type: "catalog-count-mismatch", catalog: definition.title, expected: definition.expected, actual: result.actual });
  return result;
}

const files = await walk(sourceDirectory);
const nodes = [];
for (const absolutePath of files) {
  const relativePath = normalizePath(path.relative(sourceDirectory, absolutePath));
  const content = await fs.readFile(absolutePath, "utf8");
  const extension = path.extname(relativePath).toLowerCase();
  nodes.push({
    id: relativePath,
    title: titleFromPath(relativePath),
    relativePath,
    extension,
    characterCount: [...content].length,
    tags: extension === ".md" ? parseTags(content) : [],
    baseRules: extension === ".base" ? parseBaseRules(content) : null,
    content,
  });
}
nodes.sort((a, b) => sortText(a.relativePath, b.relativePath));

const nodeById = new Map(nodes.map((node) => [node.id, node]));
const resolveTarget = buildResolver(nodes);
const edges = [];
for (const node of nodes) {
  if (node.extension !== ".md") continue;
  for (const [linkIndex, link] of parseWikiLinks(node.content).entries()) {
    const resolution = resolveTarget(node, link.rawTarget);
    edges.push({
      id: `${node.id}::wiki::${linkIndex}`,
      type: link.embed ? "embed" : "wiki-link",
      source: node.id,
      target: resolution.id,
      rawTarget: link.rawTarget,
      alias: link.alias,
      heading: link.heading,
      embed: link.embed,
      offset: link.offset,
      resolved: Boolean(resolution.id),
      ambiguous: resolution.ambiguous,
      candidates: resolution.candidates,
      resolutionDisposition: resolution.id ? "note" : ordinaryConceptTargets.has(link.rawTarget) ? "ordinary-concept" : "unresolved",
    });
  }
}

const baseMembershipEdges = [];
for (const baseNode of nodes.filter((node) => node.extension === ".base")) {
  const requiredTags = baseNode.baseRules?.requiredTags ?? [];
  for (const tag of requiredTags) {
    for (const member of nodes.filter((node) => node.extension === ".md" && node.tags.includes(tag))) {
      baseMembershipEdges.push({
        id: `${baseNode.id}::tag::${tag}::${member.id}`,
        type: "base-tag-membership",
        source: baseNode.id,
        target: member.id,
        tag,
        inferredFromRule: `file.tags.contains(\"${tag}\")`,
      });
    }
  }
}
baseMembershipEdges.sort((a, b) => sortText(a.id, b.id));

const warnings = [];
const catalogs = Object.fromEntries(
  catalogDefinitions.map((definition) => [definition.key, catalogEntry(definition, nodes, edges, nodeById, warnings)]),
);

// Some catalog notes contain explanatory links before their actual numbered list.
// Restrict the performance-domain catalog to the eight explicitly numbered entries.
const performanceIndexNode = nodes.find((node) => node.extension === ".md" && node.title === "8大绩效域");
if (performanceIndexNode) {
  const numberedTargets = [];
  for (const match of performanceIndexNode.content.matchAll(/^\s*\d+[.、]\s*!?\[\[([^\]]+)\]\]/gm)) {
    const rawTarget = match[1].split("|")[0].split("#")[0].trim();
    const resolution = resolveTarget(performanceIndexNode, rawTarget);
    if (resolution.id && nodeById.get(resolution.id)?.extension === ".md") numberedTargets.push(resolution.id);
  }
  const members = unique(numberedTargets).map((id) => {
    const node = nodeById.get(id);
    return { id, title: node.title, relativePath: node.relativePath };
  });
  catalogs.performanceDomains = {
    ...catalogs.performanceDomains,
    members,
    actual: members.length,
    matchesExpected: members.length === catalogs.performanceDomains.expected,
    extraction: "numbered-wiki-links",
  };
}

// The tailoring catalog is a Markdown table rather than a collection of note links.
const tailoringIndexNode = nodes.find((node) => node.extension === ".md" && node.title === "10大管理需要裁剪因素");
if (tailoringIndexNode) {
  const rows = [];
  for (const line of tailoringIndexNode.content.split(/\r?\n/)) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 2 || cells[0] === "领域" || /^-+$/.test(cells[0])) continue;
    rows.push({
      id: `${tailoringIndexNode.id}#${cells[0]}`,
      title: cells[0],
      relativePath: tailoringIndexNode.relativePath,
      considerations: cells[1] ?? "",
      mnemonic: cells[2] ?? "",
      inlineRecord: true,
    });
  }
  catalogs.tailoringFactors = {
    ...catalogs.tailoringFactors,
    members: rows,
    actual: rows.length,
    matchesExpected: rows.length === catalogs.tailoringFactors.expected,
    extraction: "markdown-table-rows",
  };
}

// Rebuild catalog-count warnings after the content-aware extraction above.
for (let index = warnings.length - 1; index >= 0; index -= 1) {
  if (warnings[index].type === "catalog-count-mismatch" && ["8大绩效域", "10大管理需要裁剪因素"].includes(warnings[index].catalog)) warnings.splice(index, 1);
}
for (const catalog of [catalogs.performanceDomains, catalogs.tailoringFactors]) {
  if (!catalog.matchesExpected) warnings.push({ type: "catalog-count-mismatch", catalog: catalog.title, expected: catalog.expected, actual: catalog.actual });
}

const processMemberIds = unique(
  catalogs.processGroups.members.flatMap((group) => directResolvedTargets(group.id, edges, nodeById).map((node) => node.id)),
);
catalogs.processes = {
  title: "49子过程",
  expected: 49,
  actual: processMemberIds.length,
  matchesExpected: processMemberIds.length === 49,
  members: processMemberIds.map((id) => {
    const node = nodeById.get(id);
    const parentGroups = catalogs.processGroups.members.filter((group) => directResolvedTargets(group.id, edges, nodeById).some((member) => member.id === id));
    return { id, title: node?.title ?? id, relativePath: node?.relativePath ?? id, processGroups: parentGroups.map((group) => group.title) };
  }),
};
if (!catalogs.processes.matchesExpected) warnings.push({ type: "catalog-count-mismatch", catalog: "49子过程", expected: 49, actual: catalogs.processes.actual });

const toolMembership = [];
for (const category of catalogs.toolCategories.members) {
  const categoryNode = nodeById.get(category.id);
  const directMembers = directResolvedTargets(category.id, edges, nodeById).filter((node) => node.extension === ".md");
  for (const member of directMembers) {
    toolMembership.push({ category: category.title, memberId: member.id, memberTitle: member.title, source: "direct-wiki-link", evidenceNodeId: category.id });
  }
  const embeddedBases = edges
    .filter((edge) => edge.source === category.id && edge.type === "embed" && edge.target && nodeById.get(edge.target)?.extension === ".base")
    .map((edge) => nodeById.get(edge.target));
  for (const base of embeddedBases) {
    for (const relation of baseMembershipEdges.filter((edge) => edge.source === base.id)) {
      const member = nodeById.get(relation.target);
      toolMembership.push({ category: category.title, memberId: member.id, memberTitle: member.title, source: "embedded-base-tag-rule", evidenceNodeId: base.id, tag: relation.tag });
    }
  }
  const expectedBaseTitle = `${category.title}的数据库`;
  const expectedBase = nodes.find((node) => node.extension === ".base" && node.title === expectedBaseTitle);
  if (expectedBase && !embeddedBases.some((base) => base.id === expectedBase.id)) {
    warnings.push({
      type: "category-base-mismatch",
      category: category.title,
      categoryNodeId: categoryNode?.id ?? category.id,
      embeddedBases: embeddedBases.map((base) => base.id),
      matchingBasePresentButNotEmbedded: expectedBase.id,
    });
  }
}

const uniqueToolIds = unique(toolMembership.map((entry) => entry.memberId));
catalogs.tools = {
  title: "133工具和技术",
  expected: 133,
  actualUnique: uniqueToolIds.length,
  actualMemberships: toolMembership.length,
  matchesExpected: uniqueToolIds.length === 133,
  members: uniqueToolIds.map((id) => ({ id, title: nodeById.get(id)?.title ?? id, relativePath: nodeById.get(id)?.relativePath ?? id })),
  memberships: toolMembership.sort((a, b) => sortText(`${a.category}/${a.memberTitle}`, `${b.category}/${b.memberTitle}`)),
};
if (!catalogs.tools.matchesExpected) warnings.push({ type: "catalog-count-mismatch", catalog: "133工具和技术", expected: 133, actual: catalogs.tools.actualUnique });

// Preserve a clearly labelled diagnostic view using the matching interpersonal Base.
// It is not treated as source truth because the category note embeds a different Base.
const interpersonalCategory = catalogs.toolCategories.members.find((member) => member.title === "人际关系和团队技能");
const interpersonalExpectedBase = nodes.find((node) => node.extension === ".base" && node.title === "人际关系和团队技能的数据库");
if (interpersonalCategory && interpersonalExpectedBase) {
  const correctedMembership = toolMembership.filter((entry) => entry.category !== interpersonalCategory.title);
  for (const relation of baseMembershipEdges.filter((edge) => edge.source === interpersonalExpectedBase.id)) {
    const member = nodeById.get(relation.target);
    correctedMembership.push({
      category: interpersonalCategory.title,
      memberId: member.id,
      memberTitle: member.title,
      source: "diagnostic-matching-base-tag-rule",
      evidenceNodeId: interpersonalExpectedBase.id,
      tag: relation.tag,
    });
  }
  catalogs.tools.diagnosticMatchingBase = {
    status: "not-authoritative; requires user confirmation",
    replacedEmbeddedBase: edges
      .filter((edge) => edge.source === interpersonalCategory.id && edge.type === "embed" && edge.target && nodeById.get(edge.target)?.extension === ".base")
      .map((edge) => edge.target),
    matchingBase: interpersonalExpectedBase.id,
    actualMemberships: correctedMembership.length,
    actualUnique: unique(correctedMembership.map((entry) => entry.memberId)).length,
  };
}

const unresolvedEdges = edges.filter((edge) => !edge.resolved);
for (const edge of unresolvedEdges) {
  if (edge.resolutionDisposition === "ordinary-concept") continue;
  warnings.push({ type: edge.ambiguous ? "ambiguous-wiki-link" : "unresolved-wiki-link", source: edge.source, rawTarget: edge.rawTarget, candidates: edge.candidates });
}

const inboundCounts = new Map(nodes.map((node) => [node.id, 0]));
const outboundCounts = new Map(nodes.map((node) => [node.id, 0]));
for (const edge of edges) {
  outboundCounts.set(edge.source, (outboundCounts.get(edge.source) ?? 0) + 1);
  if (edge.target) inboundCounts.set(edge.target, (inboundCounts.get(edge.target) ?? 0) + 1);
}
for (const node of nodes) {
  node.incomingWikiLinkCount = inboundCounts.get(node.id) ?? 0;
  node.outgoingWikiLinkCount = outboundCounts.get(node.id) ?? 0;
}

const index = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: {
    vaultName: path.basename(sourceDirectory),
    absolutePath: sourceDirectory,
    policy: "read-only source; generated files are derived copies",
  },
  statistics: {
    nodes: nodes.length,
    markdownNotes: nodes.filter((node) => node.extension === ".md").length,
    baseFiles: nodes.filter((node) => node.extension === ".base").length,
    wikiLinks: edges.length,
    resolvedWikiLinks: edges.filter((edge) => edge.resolved).length,
    unresolvedWikiLinks: unresolvedEdges.length,
    ordinaryConceptReferences: unresolvedEdges.filter((edge) => edge.resolutionDisposition === "ordinary-concept").length,
    actionableUnresolvedWikiLinks: unresolvedEdges.filter((edge) => edge.resolutionDisposition !== "ordinary-concept").length,
    embeddedBaseLinks: edges.filter((edge) => edge.type === "embed" && edge.target && nodeById.get(edge.target)?.extension === ".base").length,
    baseMembershipRelations: baseMembershipEdges.length,
    isolatedMarkdownNotes: nodes.filter((node) => node.extension === ".md" && (inboundCounts.get(node.id) ?? 0) === 0 && (outboundCounts.get(node.id) ?? 0) === 0).length,
  },
  catalogs,
  nodes,
  edges,
  baseMembershipEdges,
  warnings,
};

await fs.mkdir(outputDirectory, { recursive: true });
await fs.writeFile(path.join(outputDirectory, "obsidian-index.json"), `${JSON.stringify(index, null, 2)}\n`);

const catalogRows = [
  catalogs.processGroups,
  catalogs.performanceDomains,
  catalogs.tailoringFactors,
  catalogs.knowledgeAreas,
  catalogs.projectDocuments,
  catalogs.processes,
].map((catalog) => `| ${catalog.title} | ${catalog.expected} | ${catalog.actual} | ${catalog.matchesExpected ? "是" : "否"} |`);

const summary = `# Obsidian 项目管理知识库索引\n\n` +
`> 这是由原始 Obsidian 库生成的只读派生索引。原文、Wiki 双链和 Base 标签规则均可追溯；不在此文件中修正原资料。\n\n` +
`- 原始库：\`${sourceDirectory}\`\n` +
`- 生成时间：${index.generatedAt}\n` +
`- Markdown 笔记：${index.statistics.markdownNotes}\n` +
`- Base 文件：${index.statistics.baseFiles}\n` +
`- Wiki 链接：${index.statistics.wikiLinks}（已解析 ${index.statistics.resolvedWikiLinks}，未解析 ${index.statistics.unresolvedWikiLinks}）\n` +
`- Base 动态成员关系：${index.statistics.baseMembershipRelations}\n\n` +
`## 核心目录校验\n\n| 目录 | 期望 | 实际 | 一致 |\n|---|---:|---:|:---:|\n${catalogRows.join("\n")}\n` +
`| 133工具和技术（去重节点） | 133 | ${catalogs.tools.actualUnique} | ${catalogs.tools.matchesExpected ? "是" : "否"} |\n\n` +
`> 工具目录按原始链接展开为 ${catalogs.tools.actualMemberships} 条分类成员关系、${catalogs.tools.actualUnique} 个唯一节点。若仅在诊断视图中把“人际关系和团队技能”改用同名 Base，则为 ${catalogs.tools.diagnosticMatchingBase?.actualMemberships ?? "—"} 条关系、${catalogs.tools.diagnosticMatchingBase?.actualUnique ?? "—"} 个唯一节点；该结果仍未达到标题所写的 133，需由资料所有者确认。\n\n` +
`## 使用原则\n\n` +
`1. 内容事实以 \`obsidian-index.json\` 中每个节点的 \`content\` 和 \`relativePath\` 为准。\n` +
`2. \`edges\` 保存原始 Wiki 链接；\`baseMembershipEdges\` 保存由 Base 标签筛选规则展开的关系。\n` +
`3. \`warnings\` 中的问题需回到原始资料核实，不自动补写或更名。\n` +
`4. 重新同步时运行：\`node scripts/build-obsidian-knowledge-index.mjs <vault> knowledge-base\`。\n\n` +
`## 警告摘要\n\n` +
(warnings.length ? warnings.map((warning) => `- ${JSON.stringify(warning)}`).join("\n") : "- 无") +
`\n`;

await fs.writeFile(path.join(outputDirectory, "README.md"), summary);

const compactCatalogs = {
  schemaVersion: 1,
  generatedAt: index.generatedAt,
  source: index.source,
  catalogs,
  warnings,
};
await fs.writeFile(path.join(outputDirectory, "core-catalogs.json"), `${JSON.stringify(compactCatalogs, null, 2)}\n`);

console.log(JSON.stringify({ outputDirectory, statistics: index.statistics, catalogs: {
  processGroups: catalogs.processGroups.actual,
  performanceDomains: catalogs.performanceDomains.actual,
  tailoringFactors: catalogs.tailoringFactors.actual,
  knowledgeAreas: catalogs.knowledgeAreas.actual,
  projectDocuments: catalogs.projectDocuments.actual,
  processes: catalogs.processes.actual,
  tools: catalogs.tools.actualUnique,
}, warnings: warnings.length }, null, 2));
