import { authoritativeProcessDetails } from "./obsidian-knowledge.generated";

export type LabAreaId =
  | "overview"
  | "integration"
  | "scope"
  | "schedule"
  | "cost"
  | "quality"
  | "resource"
  | "communication"
  | "risk"
  | "procurement"
  | "stakeholder";

export type ManagementProcess = {
  id: string;
  title: string;
  group: "启动" | "规划" | "执行" | "监控" | "收尾";
  purpose: string;
  inputs: string[];
  outputs: string[];
  tools: string[];
  documentInputs: string[];
  documentCreates: string[];
  documentUpdates: string[];
};

export type ManagementArea = {
  id: Exclude<LabAreaId, "overview">;
  title: string;
  tabLabel: string;
  description: string;
  focusProcessId: string;
  processes: ManagementProcess[];
};

const process = (
  id: string,
  title: string,
  group: ManagementProcess["group"],
  purpose: string,
  inputs: string[],
  outputs: string[],
): ManagementProcess => {
  const authoritative = authoritativeProcessDetails.find((detail) => detail.title === title);
  return {
    id,
    title,
    group,
    purpose,
    inputs: authoritative?.inputs.length ? [...authoritative.inputs] : inputs,
    outputs: authoritative?.outputs.length ? [...authoritative.outputs] : outputs,
    tools: authoritative ? [...authoritative.tools] : [],
    documentInputs: authoritative ? [...authoritative.documentInputs] : [],
    documentCreates: authoritative ? [...authoritative.documentCreates] : [],
    documentUpdates: authoritative ? [...authoritative.documentUpdates] : [],
  };
};

export const managementAreas: ManagementArea[] = [
  {
    id: "integration",
    title: "项目整合管理",
    tabLabel: "整合",
    description: "把分散的管理工作连成一个整体，建立授权、计划、执行、变更与收尾的主干。",
    focusProcessId: "develop-charter",
    processes: [
      process("develop-charter", "制定项目章程", "启动", "正式授权项目，并明确高层级目标与边界。", ["商业文件", "协议", "事业环境因素"], ["项目章程", "假设日志"]),
      process("develop-plan", "制定项目管理计划", "规划", "整合各子计划和基准，形成统一执行依据。", ["项目章程", "其他过程的输出"], ["项目管理计划"]),
      process("direct-work", "指导与管理项目工作", "执行", "按计划完成工作并实施已批准变更。", ["项目管理计划", "批准的变更请求"], ["可交付成果", "工作绩效数据", "问题日志"]),
      process("manage-knowledge", "管理项目知识", "执行", "利用既有知识并沉淀新的经验。", ["项目管理计划", "项目文件", "可交付成果"], ["经验教训登记册", "组织过程资产更新"]),
      process("monitor-work", "监控项目工作", "监控", "比较计划与实际，预测趋势并提出调整。", ["项目管理计划", "工作绩效信息"], ["工作绩效报告", "变更请求"]),
      process("change-control", "实施整体变更控制", "监控", "统一评审、批准和跟踪变更。", ["项目管理计划", "变更请求", "工作绩效报告"], ["批准的变更请求", "变更日志"]),
      process("close-project", "结束项目或阶段", "收尾", "完成验收、移交、归档和复盘。", ["项目章程", "验收的可交付成果", "商业文件"], ["最终成果移交", "最终报告", "组织过程资产更新"]),
    ],
  },
  {
    id: "scope",
    title: "项目范围管理",
    tabLabel: "范围",
    description: "明确项目做什么、不做什么，并把需求分解成可交付、可验收的工作。",
    focusProcessId: "create-wbs",
    processes: [
      process("plan-scope", "规划范围管理", "规划", "规定范围和需求将如何定义、确认与控制。", ["项目章程", "项目管理计划"], ["范围管理计划", "需求管理计划"]),
      process("collect-requirements", "收集需求", "规划", "识别干系人的需要并形成可追踪需求。", ["项目章程", "干系人登记册"], ["需求文件", "需求跟踪矩阵"]),
      process("define-scope", "定义范围", "规划", "形成项目和产品边界的详细描述。", ["项目章程", "需求文件"], ["项目范围说明书", "项目文件更新"]),
      process("create-wbs", "创建 WBS", "规划", "把范围分解到可估算、可分派的工作包。", ["范围管理计划", "项目范围说明书", "需求文件"], ["范围基准", "项目文件更新"]),
      process("validate-scope", "确认范围", "监控", "由客户或发起人正式验收已完成成果。", ["范围基准", "核实的可交付成果", "工作绩效数据"], ["验收的可交付成果", "变更请求"]),
      process("control-scope", "控制范围", "监控", "监督范围状态并管理范围基准变更。", ["范围基准", "需求文件", "工作绩效数据"], ["工作绩效信息", "变更请求", "范围基准更新"]),
    ],
  },
  {
    id: "schedule",
    title: "项目进度管理",
    tabLabel: "进度",
    description: "把工作包变成有顺序、有资源约束、有目标日期的可执行时间计划。",
    focusProcessId: "develop-schedule",
    processes: [
      process("plan-schedule", "规划进度管理", "规划", "规定进度计划的编制、维护和控制方法。", ["项目章程", "项目管理计划"], ["进度管理计划"]),
      process("define-activities", "定义活动", "规划", "把工作包继续拆成可安排的具体活动。", ["范围基准", "进度管理计划"], ["活动清单", "活动属性", "里程碑清单"]),
      process("sequence-activities", "排列活动顺序", "规划", "识别活动间的逻辑依赖关系。", ["活动清单", "里程碑清单", "假设日志"], ["项目进度网络图", "项目文件更新"]),
      process("estimate-duration", "估算活动持续时间", "规划", "结合资源与风险估算每项活动所需时间。", ["活动清单", "资源需求", "资源日历"], ["持续时间估算", "估算依据"]),
      process("develop-schedule", "制定进度计划", "规划", "综合顺序、工期和资源形成批准的时间基准。", ["网络图", "持续时间估算", "资源日历"], ["进度基准", "项目进度计划", "进度数据"]),
      process("control-schedule", "控制进度", "监控", "跟踪状态、预测完工日期并控制进度变更。", ["进度基准", "项目进度计划", "工作绩效数据"], ["进度预测", "工作绩效信息", "变更请求"]),
    ],
  },
  {
    id: "cost",
    title: "项目成本管理",
    tabLabel: "成本",
    description: "建立资金估算和成本基准，并持续判断项目是否仍能在批准预算内完成。",
    focusProcessId: "determine-budget",
    processes: [
      process("plan-cost", "规划成本管理", "规划", "规定成本估算、预算和控制的方法。", ["项目章程", "项目管理计划"], ["成本管理计划"]),
      process("estimate-costs", "估算成本", "规划", "估算完成项目工作所需的货币资源。", ["成本管理计划", "范围基准", "进度计划"], ["成本估算", "估算依据"]),
      process("determine-budget", "制定预算", "规划", "汇总活动和工作包成本，建立批准的成本基准。", ["成本估算", "进度计划", "商业文件"], ["成本基准", "项目资金需求"]),
      process("control-costs", "控制成本", "监控", "监督成本状态、预测完工成本并管理基准变更。", ["成本基准", "资金需求", "工作绩效数据"], ["工作绩效信息", "成本预测", "变更请求"]),
    ],
  },
  {
    id: "quality",
    title: "项目质量管理",
    tabLabel: "质量",
    description: "把质量目标转成可执行标准、过程改进动作和可验证的成果证据。",
    focusProcessId: "plan-quality",
    processes: [
      process("plan-quality", "规划质量管理", "规划", "识别质量要求、标准和验证方式。", ["项目章程", "需求文件", "风险登记册"], ["质量管理计划", "质量测量指标"]),
      process("manage-quality", "管理质量", "执行", "把质量计划转化为过程活动并推动改进。", ["质量管理计划", "质量测量指标", "质量控制测量结果"], ["质量报告", "测试与评价文件", "变更请求"]),
      process("control-quality", "控制质量", "监控", "检查交付结果是否完整、正确并满足验收要求。", ["质量管理计划", "测试与评价文件", "可交付成果"], ["质量控制测量结果", "核实的可交付成果", "工作绩效信息"]),
    ],
  },
  {
    id: "resource",
    title: "项目资源管理",
    tabLabel: "资源",
    description: "识别、获取和发展完成项目所需的团队与实物资源，并处理使用偏差。",
    focusProcessId: "plan-resource",
    processes: [
      process("plan-resource", "规划资源管理", "规划", "规定团队和实物资源的识别、获取与管理方式。", ["项目章程", "项目管理计划", "项目文件"], ["资源管理计划", "团队章程"]),
      process("estimate-resources", "估算活动资源", "规划", "估算每项活动需要的人员、设备和材料。", ["资源管理计划", "范围基准", "活动清单"], ["资源需求", "估算依据", "资源分解结构"]),
      process("acquire-resources", "获取资源", "执行", "取得项目所需的团队成员、设施和物资。", ["资源管理计划", "采购文档", "资源日历"], ["物质资源分配单", "项目团队派工单", "资源日历"]),
      process("develop-team", "建设团队", "执行", "改善能力、互动和整体团队氛围。", ["资源管理计划", "团队派工单", "资源日历"], ["团队绩效评价", "变更请求"]),
      process("manage-team", "管理团队", "执行", "跟踪绩效、解决问题并优化团队表现。", ["资源管理计划", "问题日志", "团队绩效评价"], ["变更请求", "项目管理计划更新"]),
      process("control-resources", "控制资源", "监控", "确保实物资源按计划可用并纠正使用偏差。", ["资源管理计划", "资源需求", "工作绩效数据"], ["工作绩效信息", "变更请求"]),
    ],
  },
  {
    id: "communication",
    title: "项目沟通管理",
    tabLabel: "沟通",
    description: "让正确的信息以合适的形式、节奏和保密级别到达正确的人。",
    focusProcessId: "plan-communications",
    processes: [
      process("plan-communications", "规划沟通管理", "规划", "根据干系人需要设计信息、渠道、频率和责任。", ["项目章程", "干系人登记册", "需求文件"], ["沟通管理计划", "项目文件更新"]),
      process("manage-communications", "管理沟通", "执行", "创建、收集、分发和保存项目信息。", ["沟通管理计划", "工作绩效报告", "干系人登记册"], ["项目沟通记录", "项目管理计划更新"]),
      process("monitor-communications", "监督沟通", "监控", "判断信息流是否满足项目和干系人的需要。", ["沟通管理计划", "项目沟通记录", "工作绩效数据"], ["工作绩效信息", "变更请求", "计划更新"]),
    ],
  },
  {
    id: "risk",
    title: "项目风险管理",
    tabLabel: "风险",
    description: "持续识别不确定性、判断优先级、设计并实施应对，再监督剩余风险。",
    focusProcessId: "identify-risks",
    processes: [
      process("plan-risk", "规划风险管理", "规划", "规定风险活动、角色、预算、频率和阈值。", ["项目章程", "项目管理计划", "干系人登记册"], ["风险管理计划"]),
      process("identify-risks", "识别风险", "规划", "识别单个风险和整体风险来源并记录特征。", ["项目管理计划", "项目文件", "协议与采购文档"], ["风险登记册", "风险报告", "项目文件更新"]),
      process("qualitative-risk", "实施定性风险管理", "规划", "用概率、影响和其他特征排列风险优先级。", ["风险管理计划", "风险登记册", "干系人登记册"], ["风险登记册更新", "风险报告更新"]),
      process("quantitative-risk", "实施定量风险管理", "规划", "数值分析风险对整体目标的综合影响。", ["风险管理计划", "成本与进度基准", "风险登记册"], ["风险报告更新"]),
      process("plan-risk-response", "规划风险应对", "规划", "制定处理威胁、机会和整体风险的方案。", ["风险管理计划", "风险登记册", "风险报告"], ["变更请求", "项目管理计划更新", "项目文件更新"]),
      process("implement-risk-response", "实施风险应对", "执行", "执行商定的风险应对措施。", ["风险管理计划", "风险登记册", "风险报告"], ["变更请求", "问题日志与风险登记册更新"]),
      process("monitor-risks", "监督风险", "监控", "监督应对、跟踪已知风险并识别新风险。", ["风险管理计划", "风险登记册", "工作绩效数据"], ["工作绩效信息", "变更请求", "风险文件更新"]),
    ],
  },
  {
    id: "procurement",
    title: "项目采购管理",
    tabLabel: "采购",
    description: "判断哪些能力需要外购，选择合适供应方，并对合同履约和变更负责。",
    focusProcessId: "plan-procurement",
    processes: [
      process("plan-procurement", "规划采购管理", "规划", "记录采购决策、方法并识别潜在卖方。", ["项目章程", "商业文件", "范围基准", "需求文件"], ["采购管理计划", "采购策略", "招标文件", "采购工作说明书"]),
      process("conduct-procurements", "实施采购", "执行", "获取卖方应答、选择卖方并授予合同。", ["采购管理计划", "采购文档", "卖方建议书"], ["选定的卖方", "协议", "变更请求"]),
      process("control-procurements", "控制采购", "监控", "管理合同关系、监督绩效并实施必要变更。", ["采购管理计划", "协议", "批准的变更请求"], ["结束的采购", "工作绩效信息", "采购文档更新"]),
    ],
  },
  {
    id: "stakeholder",
    title: "项目干系人管理",
    tabLabel: "干系人",
    description: "识别能影响项目或受项目影响的人，分析关系并持续提升其有效参与。",
    focusProcessId: "identify-stakeholders",
    processes: [
      process("identify-stakeholders", "识别干系人", "启动", "识别并分析干系人的利益、影响和参与特征。", ["项目章程", "商业文件", "协议"], ["干系人登记册", "变更请求", "项目文件更新"]),
      process("plan-stakeholder", "规划干系人管理", "规划", "根据需要、期望和影响力设计参与方法。", ["项目章程", "项目管理计划", "干系人登记册"], ["干系人参与计划"]),
      process("manage-stakeholder", "管理干系人参与", "执行", "沟通协作、处理问题并促进适当参与。", ["干系人参与计划", "沟通管理计划", "问题日志"], ["变更请求", "项目文件更新"]),
      process("monitor-stakeholder", "监督干系人参与", "监控", "监督关系并调整参与策略和计划。", ["干系人参与计划", "项目沟通记录", "工作绩效数据"], ["工作绩效信息", "变更请求", "计划更新"]),
    ],
  },
];

export const managementAreaById = Object.fromEntries(
  managementAreas.map((area) => [area.id, area]),
) as Record<ManagementArea["id"], ManagementArea>;
