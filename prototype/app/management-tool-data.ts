import {
  authoritativeToolCategories,
  authoritativeTools,
} from "./obsidian-knowledge.generated";

export type ManagementToolCategoryId =
  | "collection"
  | "analysis"
  | "representation"
  | "decision"
  | "communication"
  | "interpersonal"
  | "other";

export type ManagementToolTouch = {
  title: string;
  category: ManagementToolCategoryId;
  relatedForm?: boolean;
};

export const managementToolInventoryCount = 133;

export const managementToolCategories: Array<{
  id: ManagementToolCategoryId;
  label: string;
  count: number;
}> = authoritativeToolCategories.map((category) => ({ ...category }));

export const orderedManagementTools = managementToolCategories.flatMap((category) =>
  authoritativeTools.filter((tool) => tool.categoryId === category.id),
);

export const managementToolNumberByTitle = new Map<string, number>(
  orderedManagementTools.map((tool, index) => [tool.title, index + 1]),
);

export const managementToolIdByTitle = new Map<string, string>(
  orderedManagementTools.map((tool, index) => [tool.title, `tool:${String(index + 1).padStart(3, "0")}`]),
);

const authoritativeToolTitles = new Set<string>(authoritativeTools.map((tool) => tool.title));
const managementToolTitleAliases: Record<string, string> = {
  "检查单": "核查表",
  "箭线图法（双代号网络图）": "箭线图法",
  "三点估算": "计划评审技术",
  "测试产品评估": "测试/产品评估",
};

export function normalizeManagementToolTitle(title: string) {
  return managementToolTitleAliases[title] ?? title;
}

export function isAuthoritativeManagementTool(title: string) {
  return authoritativeToolTitles.has(normalizeManagementToolTitle(title));
}

export const processManagementTools: Record<string, ManagementToolTouch[]> = {
  "develop-charter": [
    {
      "title": "专家判断",
      "category": "other"
    },
    {
      "title": "头脑风暴",
      "category": "collection"
    },
    {
      "title": "焦点小组",
      "category": "collection"
    },
    {
      "title": "访谈",
      "category": "collection"
    },
    {
      "title": "冲突管理",
      "category": "interpersonal"
    },
    {
      "title": "引导",
      "category": "interpersonal"
    },
    {
      "title": "会议管理",
      "category": "interpersonal"
    },
    {
      "title": "会议",
      "category": "other"
    }
  ],
  "develop-plan": [
    {
      "title": "专家判断",
      "category": "other"
    },
    {
      "title": "头脑风暴",
      "category": "collection"
    },
    {
      "title": "核对单",
      "category": "collection"
    },
    {
      "title": "焦点小组",
      "category": "collection"
    },
    {
      "title": "访谈",
      "category": "collection"
    },
    {
      "title": "冲突管理",
      "category": "interpersonal"
    },
    {
      "title": "引导",
      "category": "interpersonal"
    },
    {
      "title": "会议管理",
      "category": "interpersonal"
    },
    {
      "title": "会议",
      "category": "other"
    }
  ],
  "direct-work": [
    {
      "title": "专家判断",
      "category": "other"
    },
    {
      "title": "项目管理信息系统",
      "category": "other"
    },
    {
      "title": "会议",
      "category": "other"
    },
    {
      "title": "看板（任务板）",
      "category": "representation",
      "relatedForm": true
    }
  ],
  "manage-knowledge": [
    {
      "title": "专家判断",
      "category": "other"
    },
    {
      "title": "知识管理",
      "category": "other"
    },
    {
      "title": "信息管理",
      "category": "other"
    },
    {
      "title": "积极倾听",
      "category": "interpersonal"
    },
    {
      "title": "引导",
      "category": "interpersonal"
    },
    {
      "title": "领导力",
      "category": "interpersonal"
    },
    {
      "title": "人际交往",
      "category": "interpersonal"
    },
    {
      "title": "大局观",
      "category": "interpersonal"
    }
  ],
  "monitor-work": [
    {
      "title": "专家判断",
      "category": "other"
    },
    {
      "title": "备选方案分析",
      "category": "analysis"
    },
    {
      "title": "成本效益分析",
      "category": "analysis"
    },
    {
      "title": "挣值分析",
      "category": "analysis"
    },
    {
      "title": "根本原因分析",
      "category": "analysis"
    },
    {
      "title": "趋势分析",
      "category": "analysis"
    },
    {
      "title": "偏差分析",
      "category": "analysis"
    },
    {
      "title": "会议",
      "category": "other"
    },
    {
      "title": "看板（任务板）",
      "category": "representation",
      "relatedForm": true
    }
  ],
  "change-control": [
    {
      "title": "专家判断",
      "category": "other"
    },
    {
      "title": "变更控制工具",
      "category": "other"
    },
    {
      "title": "备选方案分析",
      "category": "analysis"
    },
    {
      "title": "成本效益分析",
      "category": "analysis"
    },
    {
      "title": "投票",
      "category": "decision"
    },
    {
      "title": "独裁型决策制定",
      "category": "decision"
    },
    {
      "title": "多标准决策分析",
      "category": "decision"
    },
    {
      "title": "会议",
      "category": "other"
    }
  ],
  "close-project": [
    {
      "title": "专家判断",
      "category": "other"
    },
    {
      "title": "文件分析",
      "category": "analysis"
    },
    {
      "title": "回归分析",
      "category": "analysis"
    },
    {
      "title": "趋势分析",
      "category": "analysis"
    },
    {
      "title": "偏差分析",
      "category": "analysis"
    },
    {
      "title": "会议",
      "category": "other"
    }
  ],
  "plan-scope": [
    {
      "title": "专家判断",
      "category": "other"
    },
    {
      "title": "备选方案分析",
      "category": "analysis"
    },
    {
      "title": "会议",
      "category": "other"
    }
  ],
  "collect-requirements": [
    {
      "title": "专家判断",
      "category": "other"
    },
    {
      "title": "头脑风暴",
      "category": "collection"
    },
    {
      "title": "访谈",
      "category": "collection"
    },
    {
      "title": "焦点小组",
      "category": "collection"
    },
    {
      "title": "问卷调查",
      "category": "collection"
    },
    {
      "title": "标杆对照",
      "category": "collection"
    },
    {
      "title": "文件分析",
      "category": "analysis"
    },
    {
      "title": "亲和图",
      "category": "representation"
    },
    {
      "title": "思维导图",
      "category": "representation"
    },
    {
      "title": "名义小组技术",
      "category": "interpersonal"
    },
    {
      "title": "观察和交谈",
      "category": "interpersonal"
    },
    {
      "title": "引导",
      "category": "interpersonal"
    },
    {
      "title": "系统交互图",
      "category": "other"
    },
    {
      "title": "原型法",
      "category": "other"
    }
  ],
  "define-scope": [
    {
      "title": "专家判断",
      "category": "other"
    },
    {
      "title": "备选方案分析",
      "category": "analysis"
    },
    {
      "title": "引导",
      "category": "interpersonal"
    },
    {
      "title": "产品分析",
      "category": "other"
    }
  ],
  "create-wbs": [
    {
      "title": "专家判断",
      "category": "other"
    },
    {
      "title": "WBS分解",
      "category": "other"
    }
  ],
  "validate-scope": [
    {
      "title": "检查",
      "category": "other"
    }
  ],
  "control-scope": [
    {
      "title": "偏差分析",
      "category": "analysis"
    },
    {
      "title": "趋势分析",
      "category": "analysis"
    }
  ],
  "plan-schedule": [
    {
      "title": "专家判断",
      "category": "other"
    },
    {
      "title": "备选方案分析",
      "category": "analysis"
    },
    {
      "title": "会议",
      "category": "other"
    }
  ],
  "define-activities": [
    {
      "title": "专家判断",
      "category": "other"
    },
    {
      "title": "WBS分解",
      "category": "other"
    },
    {
      "title": "滚动式规划",
      "category": "other"
    },
    {
      "title": "会议",
      "category": "other"
    }
  ],
  "sequence-activities": [
    {
      "title": "紧前关系绘图法",
      "category": "other"
    },
    {
      "title": "箭线图法（双代号网络图）",
      "category": "other"
    },
    {
      "title": "确定和整合依赖关系",
      "category": "other"
    },
    {
      "title": "提前量和滞后量",
      "category": "other"
    },
    {
      "title": "项目管理信息系统",
      "category": "other"
    }
  ],
  "estimate-duration": [
    {
      "title": "专家判断",
      "category": "other"
    },
    {
      "title": "类比估算",
      "category": "other"
    },
    {
      "title": "参数估算",
      "category": "other"
    },
    {
      "title": "三点估算",
      "category": "other"
    },
    {
      "title": "自下而上估算",
      "category": "other"
    },
    {
      "title": "备选方案分析",
      "category": "analysis"
    },
    {
      "title": "储备分析",
      "category": "analysis"
    },
    {
      "title": "会议",
      "category": "other"
    }
  ],
  "develop-schedule": [
    {
      "title": "进度网络分析",
      "category": "other"
    },
    {
      "title": "关键路径法",
      "category": "other"
    },
    {
      "title": "资源优化",
      "category": "other"
    },
    {
      "title": "假设情景分析",
      "category": "analysis"
    },
    {
      "title": "模拟",
      "category": "analysis"
    },
    {
      "title": "提前量和滞后量",
      "category": "other"
    },
    {
      "title": "进度压缩",
      "category": "other"
    },
    {
      "title": "计划评审技术",
      "category": "other"
    },
    {
      "title": "项目管理信息系统",
      "category": "other"
    },
    {
      "title": "敏捷或适应性发布规划",
      "category": "other"
    },
    {
      "title": "甘特图",
      "category": "representation",
      "relatedForm": true
    }
  ],
  "control-schedule": [
    {
      "title": "挣值分析",
      "category": "analysis"
    },
    {
      "title": "迭代燃尽图",
      "category": "analysis"
    },
    {
      "title": "趋势分析",
      "category": "analysis"
    },
    {
      "title": "绩效审查",
      "category": "analysis"
    },
    {
      "title": "偏差分析",
      "category": "analysis"
    },
    {
      "title": "假设情景分析",
      "category": "analysis"
    },
    {
      "title": "关键路径法",
      "category": "other"
    },
    {
      "title": "项目管理信息系统",
      "category": "other"
    },
    {
      "title": "资源优化",
      "category": "other"
    },
    {
      "title": "提前量和滞后量",
      "category": "other"
    },
    {
      "title": "进度压缩",
      "category": "other"
    }
  ],
  "plan-cost": [
    {
      "title": "专家判断",
      "category": "other"
    },
    {
      "title": "备选方案分析",
      "category": "analysis"
    },
    {
      "title": "会议",
      "category": "other"
    }
  ],
  "estimate-costs": [
    {
      "title": "专家判断",
      "category": "other"
    },
    {
      "title": "类比估算",
      "category": "other"
    },
    {
      "title": "参数估算",
      "category": "other"
    },
    {
      "title": "自下而上估算",
      "category": "other"
    },
    {
      "title": "三点估算",
      "category": "other"
    },
    {
      "title": "备选方案分析",
      "category": "analysis"
    },
    {
      "title": "储备分析",
      "category": "analysis"
    },
    {
      "title": "质量成本",
      "category": "analysis"
    },
    {
      "title": "项目管理信息系统",
      "category": "other"
    }
  ],
  "determine-budget": [
    {
      "title": "专家判断",
      "category": "other"
    },
    {
      "title": "成本汇总",
      "category": "other"
    },
    {
      "title": "储备分析",
      "category": "analysis"
    },
    {
      "title": "历史信息审核",
      "category": "other"
    },
    {
      "title": "资金限制平衡",
      "category": "other"
    },
    {
      "title": "融资",
      "category": "other"
    }
  ],
  "control-costs": [
    {
      "title": "专家判断",
      "category": "other"
    },
    {
      "title": "挣值分析",
      "category": "analysis"
    },
    {
      "title": "偏差分析",
      "category": "analysis"
    },
    {
      "title": "趋势分析",
      "category": "analysis"
    },
    {
      "title": "储备分析",
      "category": "analysis"
    },
    {
      "title": "完工尚需绩效指数",
      "category": "other"
    },
    {
      "title": "项目管理信息系统",
      "category": "other"
    }
  ],
  "plan-quality": [
    {
      "title": "专家判断",
      "category": "other"
    },
    {
      "title": "标杆对照",
      "category": "collection"
    },
    {
      "title": "头脑风暴",
      "category": "collection"
    },
    {
      "title": "访谈",
      "category": "collection"
    },
    {
      "title": "成本效益分析",
      "category": "analysis"
    },
    {
      "title": "质量成本",
      "category": "analysis"
    },
    {
      "title": "决策分析",
      "category": "analysis"
    },
    {
      "title": "多标准决策分析",
      "category": "decision"
    },
    {
      "title": "流程图",
      "category": "representation"
    },
    {
      "title": "逻辑数据模型",
      "category": "representation"
    },
    {
      "title": "矩阵图",
      "category": "representation"
    },
    {
      "title": "思维导图",
      "category": "representation"
    },
    {
      "title": "测试与检查的规划",
      "category": "other"
    },
    {
      "title": "会议",
      "category": "other"
    }
  ],
  "manage-quality": [
    {
      "title": "核对单",
      "category": "collection"
    },
    {
      "title": "备选方案分析",
      "category": "analysis"
    },
    {
      "title": "文件分析",
      "category": "analysis"
    },
    {
      "title": "过程分析",
      "category": "analysis"
    },
    {
      "title": "根本原因分析",
      "category": "analysis"
    },
    {
      "title": "决策分析",
      "category": "analysis"
    },
    {
      "title": "多标准决策分析",
      "category": "decision"
    },
    {
      "title": "亲和图",
      "category": "representation"
    },
    {
      "title": "因果图",
      "category": "representation"
    },
    {
      "title": "流程图",
      "category": "representation"
    },
    {
      "title": "直方图",
      "category": "representation"
    },
    {
      "title": "矩阵图",
      "category": "representation"
    },
    {
      "title": "散点图",
      "category": "representation"
    },
    {
      "title": "审计",
      "category": "other"
    },
    {
      "title": "面向X的设计",
      "category": "other"
    },
    {
      "title": "问题解决",
      "category": "other"
    },
    {
      "title": "质量改进方法",
      "category": "other"
    }
  ],
  "control-quality": [
    {
      "title": "核对单",
      "category": "collection"
    },
    {
      "title": "检查单",
      "category": "collection"
    },
    {
      "title": "统计抽样",
      "category": "collection"
    },
    {
      "title": "问卷调查",
      "category": "collection"
    },
    {
      "title": "绩效审查",
      "category": "analysis"
    },
    {
      "title": "根本原因分析",
      "category": "analysis"
    },
    {
      "title": "检查",
      "category": "other"
    },
    {
      "title": "测试产品评估",
      "category": "other"
    },
    {
      "title": "因果图",
      "category": "representation"
    },
    {
      "title": "控制图",
      "category": "representation"
    },
    {
      "title": "直方图",
      "category": "representation"
    },
    {
      "title": "散点图",
      "category": "representation"
    },
    {
      "title": "会议",
      "category": "other"
    }
  ],
  "plan-resource": [
    {
      "title": "专家判断",
      "category": "other"
    },
    {
      "title": "层级图",
      "category": "representation"
    },
    {
      "title": "RACI矩阵型",
      "category": "representation"
    },
    {
      "title": "文本型",
      "category": "representation"
    },
    {
      "title": "组织理论",
      "category": "other"
    },
    {
      "title": "会议",
      "category": "other"
    }
  ],
  "estimate-resources": [
    {
      "title": "专家判断",
      "category": "other"
    },
    {
      "title": "自下而上估算",
      "category": "other"
    },
    {
      "title": "类比估算",
      "category": "other"
    },
    {
      "title": "参数估算",
      "category": "other"
    },
    {
      "title": "备选方案分析",
      "category": "analysis"
    },
    {
      "title": "项目管理信息系统",
      "category": "other"
    },
    {
      "title": "会议",
      "category": "other"
    }
  ],
  "acquire-resources": [
    {
      "title": "多标准决策分析",
      "category": "decision"
    },
    {
      "title": "谈判",
      "category": "interpersonal"
    },
    {
      "title": "预分派",
      "category": "other"
    },
    {
      "title": "虚拟团队",
      "category": "other"
    }
  ],
  "develop-team": [
    {
      "title": "集中办公",
      "category": "other"
    },
    {
      "title": "虚拟团队",
      "category": "other"
    },
    {
      "title": "沟通技术",
      "category": "other"
    },
    {
      "title": "冲突管理",
      "category": "interpersonal"
    },
    {
      "title": "影响力",
      "category": "interpersonal"
    },
    {
      "title": "激励",
      "category": "interpersonal"
    },
    {
      "title": "谈判",
      "category": "interpersonal"
    },
    {
      "title": "团队建设",
      "category": "interpersonal"
    },
    {
      "title": "认可与奖励",
      "category": "other"
    },
    {
      "title": "培训",
      "category": "other"
    },
    {
      "title": "个人和团队评估",
      "category": "other"
    },
    {
      "title": "会议",
      "category": "other"
    }
  ],
  "manage-team": [
    {
      "title": "冲突管理",
      "category": "interpersonal"
    },
    {
      "title": "制定决策",
      "category": "interpersonal"
    },
    {
      "title": "影响力",
      "category": "interpersonal"
    },
    {
      "title": "领导力",
      "category": "interpersonal"
    },
    {
      "title": "情商",
      "category": "interpersonal"
    },
    {
      "title": "项目管理信息系统",
      "category": "other"
    }
  ],
  "control-resources": [
    {
      "title": "备选方案分析",
      "category": "analysis"
    },
    {
      "title": "成本效益分析",
      "category": "analysis"
    },
    {
      "title": "绩效审查",
      "category": "analysis"
    },
    {
      "title": "趋势分析",
      "category": "analysis"
    },
    {
      "title": "问题解决",
      "category": "other"
    },
    {
      "title": "谈判",
      "category": "interpersonal"
    },
    {
      "title": "影响力",
      "category": "interpersonal"
    },
    {
      "title": "项目管理信息系统",
      "category": "other"
    }
  ],
  "plan-communications": [
    {
      "title": "专家判断",
      "category": "other"
    },
    {
      "title": "沟通需求分析",
      "category": "other"
    },
    {
      "title": "沟通技术",
      "category": "other"
    },
    {
      "title": "沟通模型",
      "category": "other"
    },
    {
      "title": "沟通方法",
      "category": "other"
    },
    {
      "title": "沟通风格评估",
      "category": "interpersonal"
    },
    {
      "title": "政策意识",
      "category": "interpersonal"
    },
    {
      "title": "文化意识",
      "category": "interpersonal"
    },
    {
      "title": "干系人参与度评估矩阵",
      "category": "representation"
    },
    {
      "title": "会议",
      "category": "other"
    }
  ],
  "manage-communications": [
    {
      "title": "沟通技术",
      "category": "other"
    },
    {
      "title": "沟通方法",
      "category": "other"
    },
    {
      "title": "沟通技能",
      "category": "communication"
    },
    {
      "title": "沟通胜任力",
      "category": "communication"
    },
    {
      "title": "反馈",
      "category": "communication"
    },
    {
      "title": "非口头技能",
      "category": "communication"
    },
    {
      "title": "演示",
      "category": "communication"
    },
    {
      "title": "项目管理信息系统",
      "category": "other"
    },
    {
      "title": "项目报告",
      "category": "other"
    },
    {
      "title": "积极倾听",
      "category": "interpersonal"
    },
    {
      "title": "冲突管理",
      "category": "interpersonal"
    },
    {
      "title": "文化意识",
      "category": "interpersonal"
    },
    {
      "title": "会议管理",
      "category": "interpersonal"
    },
    {
      "title": "人际交往",
      "category": "interpersonal"
    },
    {
      "title": "政策意识",
      "category": "interpersonal"
    }
  ],
  "monitor-communications": [
    {
      "title": "专家判断",
      "category": "other"
    },
    {
      "title": "项目管理信息系统",
      "category": "other"
    },
    {
      "title": "干系人参与度评估矩阵",
      "category": "representation"
    },
    {
      "title": "观察和交谈",
      "category": "interpersonal"
    },
    {
      "title": "会议",
      "category": "other"
    }
  ],
  "plan-risk": [
    {
      "title": "专家判断",
      "category": "other"
    },
    {
      "title": "干系人分析法",
      "category": "analysis"
    },
    {
      "title": "会议",
      "category": "other"
    }
  ],
  "identify-risks": [
    {
      "title": "专家判断",
      "category": "other"
    },
    {
      "title": "头脑风暴",
      "category": "collection"
    },
    {
      "title": "核查表",
      "category": "collection"
    },
    {
      "title": "访谈",
      "category": "collection"
    },
    {
      "title": "根本原因分析",
      "category": "analysis"
    },
    {
      "title": "假设条件和制约因素分析",
      "category": "analysis"
    },
    {
      "title": "SWOT分析",
      "category": "analysis"
    },
    {
      "title": "文件分析",
      "category": "analysis"
    },
    {
      "title": "引导",
      "category": "interpersonal"
    },
    {
      "title": "提示清单",
      "category": "other"
    },
    {
      "title": "会议",
      "category": "other"
    }
  ],
  "qualitative-risk": [
    {
      "title": "专家判断",
      "category": "other"
    },
    {
      "title": "访谈",
      "category": "collection"
    },
    {
      "title": "风险数据质量评估",
      "category": "analysis"
    },
    {
      "title": "风险概率和影响评估",
      "category": "analysis"
    },
    {
      "title": "其他风险参数评估",
      "category": "analysis"
    },
    {
      "title": "引导",
      "category": "interpersonal"
    },
    {
      "title": "风险分类",
      "category": "other"
    },
    {
      "title": "概率和影响矩阵",
      "category": "representation"
    },
    {
      "title": "层级图",
      "category": "representation"
    },
    {
      "title": "气泡图",
      "category": "representation"
    },
    {
      "title": "会议",
      "category": "other"
    }
  ],
  "quantitative-risk": [
    {
      "title": "专家判断",
      "category": "other"
    },
    {
      "title": "访谈",
      "category": "collection"
    },
    {
      "title": "引导",
      "category": "interpersonal"
    },
    {
      "title": "不确定性表现方式",
      "category": "other"
    },
    {
      "title": "模拟",
      "category": "analysis"
    },
    {
      "title": "敏感性分析",
      "category": "analysis"
    },
    {
      "title": "决策树分析",
      "category": "analysis"
    },
    {
      "title": "影响图",
      "category": "analysis"
    }
  ],
  "plan-risk-response": [
    {
      "title": "专家判断",
      "category": "other"
    },
    {
      "title": "访谈",
      "category": "collection"
    },
    {
      "title": "引导",
      "category": "interpersonal"
    },
    {
      "title": "威胁应对策略",
      "category": "other"
    },
    {
      "title": "机会应对策略",
      "category": "other"
    },
    {
      "title": "应急应对策略",
      "category": "other"
    },
    {
      "title": "整体项目风险应对策略",
      "category": "other"
    },
    {
      "title": "备选方案分析",
      "category": "analysis"
    },
    {
      "title": "成本效益分析",
      "category": "analysis"
    },
    {
      "title": "多标准决策分析",
      "category": "decision"
    }
  ],
  "implement-risk-response": [
    {
      "title": "专家判断",
      "category": "other"
    },
    {
      "title": "项目管理信息系统",
      "category": "other"
    }
  ],
  "monitor-risks": [
    {
      "title": "技术绩效分析",
      "category": "analysis"
    },
    {
      "title": "储备分析",
      "category": "analysis"
    },
    {
      "title": "审计",
      "category": "other"
    },
    {
      "title": "会议",
      "category": "other"
    }
  ],
  "plan-procurement": [
    {
      "title": "专家判断",
      "category": "other"
    },
    {
      "title": "市场调研",
      "category": "collection"
    },
    {
      "title": "供方选择分析",
      "category": "other"
    },
    {
      "title": "会议",
      "category": "other"
    }
  ],
  "conduct-procurements": [
    {
      "title": "专家判断",
      "category": "other"
    },
    {
      "title": "广告",
      "category": "other"
    },
    {
      "title": "投标人会议",
      "category": "other"
    },
    {
      "title": "建议书评价",
      "category": "analysis"
    },
    {
      "title": "谈判",
      "category": "interpersonal"
    }
  ],
  "control-procurements": [
    {
      "title": "专家判断",
      "category": "other"
    },
    {
      "title": "索赔管理",
      "category": "other"
    },
    {
      "title": "绩效审查",
      "category": "analysis"
    },
    {
      "title": "挣值分析",
      "category": "analysis"
    },
    {
      "title": "趋势分析",
      "category": "analysis"
    },
    {
      "title": "检查",
      "category": "other"
    },
    {
      "title": "审计",
      "category": "other"
    }
  ],
  "identify-stakeholders": [
    {
      "title": "专家判断",
      "category": "other"
    },
    {
      "title": "头脑风暴",
      "category": "collection"
    },
    {
      "title": "问卷调查",
      "category": "collection"
    },
    {
      "title": "干系人分析法",
      "category": "analysis"
    },
    {
      "title": "文件分析",
      "category": "analysis"
    },
    {
      "title": "干系人映射分析和表现",
      "category": "representation"
    },
    {
      "title": "会议",
      "category": "other"
    }
  ],
  "plan-stakeholder": [
    {
      "title": "专家判断",
      "category": "other"
    },
    {
      "title": "标杆对照",
      "category": "collection"
    },
    {
      "title": "假设条件和制约因素分析",
      "category": "analysis"
    },
    {
      "title": "根本原因分析",
      "category": "analysis"
    },
    {
      "title": "优先级排序",
      "category": "decision"
    },
    {
      "title": "思维导图",
      "category": "representation"
    },
    {
      "title": "干系人参与度评估矩阵",
      "category": "representation"
    },
    {
      "title": "会议",
      "category": "other"
    }
  ],
  "manage-stakeholder": [
    {
      "title": "专家判断",
      "category": "other"
    },
    {
      "title": "沟通技能",
      "category": "communication"
    },
    {
      "title": "反馈",
      "category": "communication"
    },
    {
      "title": "冲突管理",
      "category": "interpersonal"
    },
    {
      "title": "文化意识",
      "category": "interpersonal"
    },
    {
      "title": "谈判",
      "category": "interpersonal"
    },
    {
      "title": "观察和交谈",
      "category": "interpersonal"
    },
    {
      "title": "政策意识",
      "category": "interpersonal"
    },
    {
      "title": "基本规则",
      "category": "other"
    },
    {
      "title": "会议",
      "category": "other"
    }
  ],
  "monitor-stakeholder": [
    {
      "title": "备选方案分析",
      "category": "analysis"
    },
    {
      "title": "根本原因分析",
      "category": "analysis"
    },
    {
      "title": "干系人分析法",
      "category": "analysis"
    },
    {
      "title": "多标准决策分析",
      "category": "decision"
    },
    {
      "title": "投票",
      "category": "decision"
    },
    {
      "title": "干系人参与度评估矩阵",
      "category": "representation"
    },
    {
      "title": "沟通技能",
      "category": "communication"
    },
    {
      "title": "反馈",
      "category": "communication"
    },
    {
      "title": "演示",
      "category": "communication"
    },
    {
      "title": "积极倾听",
      "category": "interpersonal"
    },
    {
      "title": "文化意识",
      "category": "interpersonal"
    },
    {
      "title": "领导力",
      "category": "interpersonal"
    },
    {
      "title": "人际交往",
      "category": "interpersonal"
    },
    {
      "title": "政策意识",
      "category": "interpersonal"
    },
    {
      "title": "会议",
      "category": "other"
    }
  ]
};
