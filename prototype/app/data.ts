export const CASE_PROJECT_NAME = "BIM规划报建平台";

export type EvidenceStatus = "confirmed" | "inferred" | "assumed" | "missing" | "recommended";

export type InterviewItem = {
  id: string;
  group: string;
  question: string;
  answer: string;
  status: EvidenceStatus;
  mapsTo: string;
};

export const interviewItems: InterviewItem[] = [
  {
    id: "INT-001",
    group: "项目意图",
    question: "这个项目暂时叫什么？",
    answer: `${CASE_PROJECT_NAME}项目`,
    status: "confirmed",
    mapsTo: "项目名称",
  },
  {
    id: "INT-002",
    group: "项目意图",
    question: "为什么要做这个项目？当前用户和业务面临什么问题？",
    answer:
      "规划报建仍依赖多套系统和线下材料流转，BIM 模型、图纸、审查意见与法规依据难以统一关联；人工审查周期长、重复沟通多，过程状态和审查证据也不易追溯。",
    status: "assumed",
    mapsTo: "项目目的、业务需求",
  },
  {
    id: "INT-003",
    group: "交付边界",
    question: "准备交付什么产品或服务？",
    answer:
      "建设面向住建部门、审查人员和设计院的一体化 BIM 规划报建平台，覆盖项目申报、模型与材料管理、智能合规审查、三维批注、审查流程、报告生成、数据归档和统计分析。",
    status: "assumed",
    mapsTo: "高层级需求、主要可交付成果",
  },
  {
    id: "INT-006",
    group: "关键能力",
    question: "第一阶段必须具备哪些能力？",
    answer:
      "统一报建受理、BIM 模型上传与轻量化预览、模型规整校验、规划条文规则管理、智能审查、在线批注、意见闭环、审查报告生成、权限控制和操作审计。",
    status: "assumed",
    mapsTo: "范围边界、高层级需求",
  },
  {
    id: "INT-009",
    group: "成功标准",
    question: "怎样判断项目真的成功？",
    answer:
      "智能审查准确率不低于 98%，10G 级模型审查不超过 10 分钟、加载不超过 3 分钟；核心报建审查流程全部走通，试点业务人员满意度不低于 90 分。",
    status: "assumed",
    mapsTo: "可测量目标、成功标准",
  },
  {
    id: "INT-018",
    group: "时间与治理",
    question: "关键时间窗口和上线约束是什么？",
    answer:
      "合同生效后 12 个月内完成开发、测试和验收；试点前必须完成法规规则基线、数据安全、模型兼容性、性能和审查结果可追溯性评审。",
    status: "assumed",
    mapsTo: "里程碑、总体项目风险",
  },
];

export const openQuestions = [
  "合同生效日期及 12 个月交付周期从哪一天开始计算？",
  "项目发起人、项目经理及双方决策授权边界是什么？",
  "首批覆盖的行政区域、建筑类型、设计院和规划审查规则范围是什么？",
];

export type ReasonNode = {
  id: string;
  kind: "fact" | "judgment" | "decision" | "activity";
  eyebrow: string;
  title: string;
  status: EvidenceStatus;
  rationale: string;
  sources: string[];
};

export const reasonNodes: ReasonNode[] = [
  {
    id: "F-COMPLIANCE",
    kind: "fact",
    eyebrow: "事实 01",
    title: "审查结果直接影响规划报建审批",
    status: "assumed",
    rationale: "规则解释、审查结论和证据链必须准确、可追溯，不能仅按一般信息展示功能管理。",
    sources: ["INT-003", "INT-006"],
  },
  {
    id: "F-MODEL-DATA",
    kind: "fact",
    eyebrow: "事实 02",
    title: "多设计院 BIM 模型格式与建模习惯存在差异",
    status: "inferred",
    rationale: "模型规整、兼容性和数据质量将直接影响智能审查准确率与处理性能。",
    sources: ["INT-003", "INT-009"],
  },
  {
    id: "F-INTEGRATION",
    kind: "fact",
    eyebrow: "事实 03",
    title: "报建、审查、规则、模型与归档跨系统协同",
    status: "assumed",
    rationale: "交付链跨越业务、BIM 引擎、规则库和外部平台，接口基线与数据语义是主要不确定性来源。",
    sources: ["INT-003"],
  },
  {
    id: "J-GOVERNANCE",
    kind: "judgment",
    eyebrow: "判断 01",
    title: "法规规则、数据安全、接口和验收门槛必须前置治理",
    status: "inferred",
    rationale: "高影响约束不能等到开发末期才验证，需要先建立规则基线、模型标准和不可逾越的验收门槛。",
    sources: ["F-COMPLIANCE", "F-MODEL-DATA", "F-INTEGRATION"],
  },
  {
    id: "J-ITERATION",
    kind: "judgment",
    eyebrow: "判断 02",
    title: "审查流程、批注体验和规则能力适合迭代验证",
    status: "inferred",
    rationale: "业务人员和设计院需要通过真实案例持续校准流程与规则，能力可以按场景拆分并逐步验证。",
    sources: ["INT-009", "F-INTEGRATION"],
  },
  {
    id: "D-LIFECYCLE",
    kind: "decision",
    eyebrow: "管理决策",
    title: "采用混合型生命周期",
    status: "recommended",
    rationale:
      "合同、法规规则、总体架构和验收采用预测型治理；审查流程、智能规则和交互按短周期迭代；通过基线评审、试点和验收阶段门衔接。",
    sources: ["J-GOVERNANCE", "J-ITERATION"],
  },
  {
    id: "A-PILOT",
    kind: "activity",
    eyebrow: "下一步活动",
    title: "真实项目试点，以指标决定验收",
    status: "recommended",
    rationale: "用审查准确率、模型处理性能、流程完整性和业务满意度共同验证技术与业务价值。",
    sources: ["D-LIFECYCLE", "INT-009", "INT-018"],
  },
];

export type Risk = {
  id: string;
  riskType: "threat" | "opportunity";
  category: string;
  title: string;
  cause: string;
  owner: string;
  strategy: string;
  probability: number;
  impact: number;
  rating: "Critical" | "High" | "Medium" | "Low";
  residualProbability: number;
  residualImpact: number;
  residualRating: "Critical" | "High" | "Medium" | "Low";
  status: string;
};

export const initialRisks: Risk[] = [
  {
    id: "RISK-001",
    riskType: "threat",
    category: "法规与合规",
    title: "规划规则库错误或更新滞后造成错误审查结论",
    cause: "条文解释、参数化规则、版本生效范围或专家复核机制不完整。",
    owner: "规划法规负责人",
    strategy: "规避",
    probability: 2,
    impact: 5,
    rating: "High",
    residualProbability: 1,
    residualImpact: 5,
    residualRating: "High",
    status: "应对已规划",
  },
  {
    id: "RISK-002",
    riskType: "threat",
    category: "数据安全",
    title: "报建材料与 BIM 模型数据泄露或越权访问",
    cause: "项目材料包含敏感空间、产权和设计信息，权限、留存或访问审计边界不清晰。",
    owner: "信息安全负责人",
    strategy: "规避",
    probability: 4,
    impact: 5,
    rating: "Critical",
    residualProbability: 2,
    residualImpact: 5,
    residualRating: "High",
    status: "应对进行中",
  },
  {
    id: "RISK-003",
    riskType: "threat",
    category: "数据与集成",
    title: "设计院模型格式与建模标准不一致",
    cause: "不同设计院使用的软件版本、构件命名和交付深度存在差异。",
    owner: "BIM 技术负责人",
    strategy: "减轻",
    probability: 4,
    impact: 4,
    rating: "High",
    residualProbability: 2,
    residualImpact: 3,
    residualRating: "Medium",
    status: "应对已规划",
  },
  {
    id: "RISK-004",
    riskType: "threat",
    category: "供应商",
    title: "轻量化引擎或智能审查组件交付延期",
    cause: "关键能力依赖外部引擎、SDK 版本及供应商专项开发。",
    owner: "采购与供应商负责人",
    strategy: "转移",
    probability: 3,
    impact: 4,
    rating: "High",
    residualProbability: 2,
    residualImpact: 3,
    residualRating: "Medium",
    status: "已识别",
  },
  {
    id: "RISK-005",
    riskType: "threat",
    category: "技术",
    title: "超大 BIM 模型处理性能未达到验收指标",
    cause: "模型构件数量、几何复杂度和并发审查量超过算法与基础设施容量。",
    owner: "平台技术负责人",
    strategy: "减轻",
    probability: 4,
    impact: 4,
    rating: "High",
    residualProbability: 2,
    residualImpact: 3,
    residualRating: "Medium",
    status: "应对已规划",
  },
  {
    id: "RISK-006",
    riskType: "threat",
    category: "质量",
    title: "不同专家对规划条文的解释存在冲突",
    cause: "规则口径、例外条件和历史审查经验尚未形成统一知识基线。",
    owner: "业务与质量负责人",
    strategy: "减轻",
    probability: 4,
    impact: 3,
    rating: "High",
    residualProbability: 2,
    residualImpact: 3,
    residualRating: "Medium",
    status: "已识别",
  },
  {
    id: "RISK-007",
    riskType: "threat",
    category: "外部",
    title: "控规库或政务平台接口进度影响联调",
    cause: "外部系统改造窗口、接口审批和测试环境不受本项目直接控制。",
    owner: "集成负责人",
    strategy: "减轻",
    probability: 2,
    impact: 3,
    rating: "Medium",
    residualProbability: 1,
    residualImpact: 2,
    residualRating: "Low",
    status: "已识别",
  },
  {
    id: "RISK-008",
    riskType: "threat",
    category: "安全",
    title: "审查流程权限配置错误导致越权审批",
    cause: "组织、岗位、项目和流程节点的授权模型复杂，配置校验或审计不足。",
    owner: "平台运维负责人",
    strategy: "规避",
    probability: 2,
    impact: 5,
    rating: "High",
    residualProbability: 1,
    residualImpact: 5,
    residualRating: "High",
    status: "已识别",
  },
  {
    id: "RISK-009",
    riskType: "opportunity",
    category: "平台能力",
    title: "规则引擎与模型底座可复用于更多建设审批场景",
    cause: "项目建立了统一模型标准、规则执行框架和可追溯审查证据链。",
    owner: "总体技术负责人",
    strategy: "提高",
    probability: 3,
    impact: 3,
    rating: "Medium",
    residualProbability: 4,
    residualImpact: 3,
    residualRating: "High",
    status: "应对已规划",
  },
];

export const milestones = [
  ["需求与总体架构基线", "合同后 1 个月"],
  ["智能审查引擎完成", "合同后 5 个月"],
  ["集成测试与业务试点", "合同后 11 个月"],
  ["项目验收与移交", "合同后 12 个月"],
];

export const deliverables = [
  "BIM 规划报建业务平台",
  "智能审查规则引擎",
  "模型轻量化、批注与文件管理能力",
  "审查报告、数据大屏与系统集成",
  "系统源码、项目文档、培训与运维移交包",
];
