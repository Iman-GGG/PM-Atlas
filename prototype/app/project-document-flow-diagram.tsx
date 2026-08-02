"use client";

type PyramidLevel = {
  points: string;
  label: string;
  x: number;
  y: number;
  className: string;
  number?: string;
  knowledgeId?: string;
  numberX?: number;
};

const pyramidLevels: PyramidLevel[] = [
  { points: "245,32 375,32 394,96 226,96", label: "项目战略", x: 310, y: 64, className: "level-1 level-inverse" },
  { points: "221,104 399,104 421,168 199,168", label: "项目组合", x: 320, y: 136, className: "level-2 level-inverse", number: "F01", knowledgeId: "KB-PORTFOLIO", numberX: 242 },
  { points: "193,176 427,176 451,240 169,240", label: "项目集", x: 320, y: 208, className: "level-3 level-inverse", number: "F02", knowledgeId: "KB-PROGRAM", numberX: 218 },
  { points: "165,248 455,248 481,312 139,312", label: "项目", x: 310, y: 280, className: "level-4" },
  { points: "136,320 484,320 512,384 108,384", label: "工作包", x: 310, y: 352, className: "level-5" },
];

const hierarchyTransfers = [
  { path: "M389 78 C470 78 470 122 405 122", x: 495, y: 102 },
  { path: "M415 150 C500 150 500 194 434 194", x: 522, y: 174 },
  { path: "M444 222 C530 222 530 266 462 266", x: 550, y: 246 },
  { path: "M474 294 C557 294 557 338 492 338", x: 577, y: 318 },
];

const documentInputs = ["项目文档 1", "项目文档 2", "项目文档 3", "项目文档 4"];
const documentOutputs = ["新项目文档 5", "新项目文档 6", "项目文档 1 更新", "项目文档 2 更新"];
const documentInputRows = [35, 97, 159, 221];
const documentOutputRows = [85, 155, 225, 295];

const foundationInputs = [
  { id: "F03", title: "事业环境因素", knowledgeId: "KB-ENTERPRISE-ENVIRONMENTAL-FACTORS", y: 283 },
  { id: "F04", title: "组织过程资产", knowledgeId: "KB-ORGANIZATIONAL-PROCESS-ASSETS", y: 345 },
];

const flowPaths = [
  "M210 60 H220 C238 60 232 105 250 105",
  "M210 122 H220 C238 122 232 149 250 149",
  "M210 184 H226 C238 184 238 193 250 193",
  "M210 246 H226 C238 246 238 237 250 237",
  "M210 308 H220 C238 308 232 281 250 281",
  "M210 370 H220 C238 370 232 325 250 325",
  "M450 110 H490",
  "M450 180 H490",
  "M450 250 H490",
  "M450 320 H490",
];

type ProjectDocumentFlowDiagramProps = {
  selectedKnowledgeId: string;
  onSelectKnowledge: (knowledgeId: string) => void;
};

export function ProjectDocumentFlowDiagram({ selectedKnowledgeId, onSelectKnowledge }: ProjectDocumentFlowDiagramProps) {
  return (
    <section className="project-document-flow" aria-label="管理层级、项目文档与工具技术关系示意图">
      <div className="project-document-flow-grid">
        <svg className="project-hierarchy-diagram" viewBox="0 0 620 410" role="img" aria-label="从项目战略到工作包的五层管理层级，层级之间通过项目文档双向传递">
          <defs>
            <marker id="project-hierarchy-arrow-start" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" />
            </marker>
            <marker id="project-hierarchy-arrow-end" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" />
            </marker>
          </defs>

          <text className="project-flow-heading" x="310" y="17">项目管理层级</text>
          <text className="project-flow-heading project-transfer-heading" x="397" y="17">管理层级之间通过项目文档继承和反馈</text>

          <g className="project-pyramid">
            {pyramidLevels.map((level) => {
              const isInteractive = Boolean(level.knowledgeId);
              const isSelected = selectedKnowledgeId === level.knowledgeId;
              return (
              <g
                className={`${isInteractive ? "project-level-interactive" : ""}${isSelected ? " selected" : ""}`}
                key={level.label}
                role={isInteractive ? "button" : undefined}
                tabIndex={isInteractive ? 0 : undefined}
                aria-label={isInteractive ? `${level.number} ${level.label}，打开知识档案` : undefined}
                aria-pressed={isInteractive ? isSelected : undefined}
                onClick={() => level.knowledgeId && onSelectKnowledge(level.knowledgeId)}
                onKeyDown={(event) => {
                  if (level.knowledgeId && (event.key === "Enter" || event.key === " ")) {
                    event.preventDefault();
                    onSelectKnowledge(level.knowledgeId);
                  }
                }}
              >
                <polygon className={`project-level ${level.className}`} points={level.points} />
                {level.number && <text className={`project-level-number ${level.className.includes("level-inverse") ? "level-inverse" : ""}`} x={level.numberX} y={level.y}>{level.number}</text>}
                <text className={`project-level-text ${level.className.includes("level-inverse") ? "level-inverse" : ""}`} x={level.x} y={level.y}>{level.label}</text>
              </g>
              );
            })}
          </g>

          <g className="project-document-transfers">
            {hierarchyTransfers.map((transfer) => (
              <g key={transfer.path}>
                <path d={transfer.path} />
                <text x={transfer.x} y={transfer.y}>项目文档</text>
              </g>
            ))}
          </g>
        </svg>

        <svg className="project-itto-diagram" viewBox="0 0 700 410" role="img" aria-label="项目文档一至四、事业环境因素和组织过程资产输入工具与技术，形成新项目文档五、新项目文档六，并更新项目文档一和项目文档二">
          <defs>
            <marker id="project-flow-arrow-end" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" />
            </marker>
          </defs>

          <text className="project-flow-heading" x="115" y="17">项目文档输入</text>
          <text className="project-flow-heading" x="585" y="17">项目文档输出</text>

          <g className="project-input-nodes">
            {documentInputRows.map((y, index) => (
              <g key={documentInputs[index]}>
                <rect x="20" y={y} width="190" height="50" rx="13" />
                <text x="115" y={y + 25}>{documentInputs[index]}</text>
              </g>
            ))}
          </g>

          <g className="project-foundation-inputs">
            {foundationInputs.map((item) => (
              <g
                className={selectedKnowledgeId === item.knowledgeId ? "selected" : ""}
                key={item.id}
                role="button"
                tabIndex={0}
                aria-label={`${item.id} ${item.title}，打开知识档案`}
                aria-pressed={selectedKnowledgeId === item.knowledgeId}
                onClick={() => onSelectKnowledge(item.knowledgeId)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectKnowledge(item.knowledgeId);
                  }
                }}
              >
                <rect x="20" y={item.y} width="190" height="50" rx="13" />
                <text className="project-foundation-number" x="48" y={item.y + 25}>{item.id}</text>
                <text x="128" y={item.y + 25}>{item.title}</text>
              </g>
            ))}
          </g>

          <g className="project-tool-node">
            <rect x="250" y="65" width="200" height="300" rx="22" />
            <text x="350" y="215">工具与技术</text>
          </g>

          <g className="project-output-nodes">
            {documentOutputRows.map((y, index) => (
              <g key={documentOutputs[index]}>
                <rect className={index < 2 ? "output-new" : "output-update"} x="490" y={y} width="190" height="50" rx="13" />
                <text className={index < 2 ? "output-new-text" : ""} x="585" y={y + 25}>{documentOutputs[index]}</text>
              </g>
            ))}
          </g>

          <g className="project-flow-lines">
            {flowPaths.map((path) => <path d={path} key={path} />)}
          </g>
        </svg>
      </div>
    </section>
  );
}
