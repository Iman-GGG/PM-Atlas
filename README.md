# 项目管理知识网页｜产品样本库

本目录保存产品定义、教材与 Excel 资料盘点、可执行字段模型，以及“访谈 → 推理树 → 模板自动带入”的连续样本。

## 连续页面原型

- `prototype/`：可交互网页原型，一级入口分为“知识库”和“项目实验室”
- 页面使用汽车手机端控制应用的真实样本数据，而非占位文案
- 视觉遵循 Uber `DESIGN.md` 的黑白灰、高对比、圆角交互控件与扁平工作区原则
- 运行：进入 `prototype/` 后执行 `pnpm install`、`pnpm run dev`，访问 `http://localhost:3000`
- 构建：执行 `pnpm run build`

知识库设置“管理活动地图、文档触点地图、知识关系图谱、知识档案”四个可定位标签。文档触点地图平铺教材中的 49 个管理子活动，并以紧凑文档单元展示输入、输出创建、输出更新和不涉及状态。项目实验室采用“总览 + 十大管理领域”的 11 个一级标签；下一层只读展示 49 个管理子活动，下方直接呈现各活动的主要输入、输出和核心成果。章程、风险、干系人三个领域保留可交互样本，其余领域已补齐输入输出骨架。实践与知识库之间不再设置跨空间跳转。

项目实验室已接入 `高项论文` 目录中的 10 个 Excel 工作簿、62 张文档模板，并按管理领域和管理活动归档。固定结构文档显示为可填写表单，登记册、矩阵和清单显示为可增删行的动态表格；Excel 中的既有内容只作为灰色填写示例，不会自动写入汽车项目。每份文档均可独立生成 `.docx`，页面顶部“导出 Word”会导出当前选中的文档。当前版本免登录，填写内容只保存在本次浏览会话。

## 当前样本

### 项目章程

- `schemas/project-charter.schema.json`：网站字段、状态和跨字段校验
- `schemas/project-charter.word-map.json`：Word 内容顺序与版式映射
- `specs/项目章程模板规范-v0.1.md`：填写逻辑和产品交互
- `samples/car-control-app/interview.json`：汽车手机端控制应用访谈
- `samples/car-control-app/reasoning-tree.json`：可解释推理树
- `samples/car-control-app/project-charter.json`：自动带入后的章程实例
- `samples/car-control-app/汽车手机端控制应用-项目章程示例.docx`：Word 导出样例

### 风险登记册

- `schemas/risk-register.schema.json`：动态行结构、校验与视图
- `schemas/risk-scoring-rules.json`：概率、影响、分数和矩阵规则
- `specs/风险登记册模板规范-v0.1.md`：动态行和评分交互
- `samples/car-control-app/risk-register.json`：同一项目的风险实例

### 干系人登记册

- `schemas/stakeholder-register.schema.json`：动态行、权力利益分类和参与程度定义
- `specs/干系人登记册模板规范-v0.1.md`：登记册、四象限和参与度矩阵联动规则
- `samples/car-control-app/stakeholder-register.json`：汽车项目 12 类干系人实例

## 字段状态

- `confirmed`：已确认事实
- `inferred`：有规则和证据的推断
- `assumed`：为讨论而暂定的假设
- `missing`：待确认，不允许编造

## 校验

运行 `tools/validate_samples.py` 会检查 JSON、访谈与推理引用、章程来源、风险计算、汇总数量和矩阵配置。生成 Word 使用 `tools/generate_project_charter_docx.py`。

项目实验室案例运行 `node scripts/validate-lab-case.mjs`，校验 32 份文件、干系人、活动、风险以及三个情景的材料包、行动链、量化效果和终局规则。运行 `node scripts/generate-lab-workload-baseline.mjs` 时会先自动执行同一校验，内容不一致将直接阻止生成。

当前基线已通过 581 项数据检查；Word 样例已完成 9 页逐页渲染检查，所有表格均使用明确列宽并通过几何审计。

所有样本均用于验证产品机制，不代表组织已正式批准项目。
