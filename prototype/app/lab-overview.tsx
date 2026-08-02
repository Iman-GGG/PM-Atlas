"use client";

import { CASE_PROJECT_NAME, openQuestions } from "./data";
import type { LabAreaId } from "./management-area-data";

type InitiationSignalState = "complete" | "current" | "planned";

const initiationDimensions: Array<{
  title: string;
  subtitle: string;
  signals: Array<{
    title: string;
    detail: string;
    state: InitiationSignalState;
  }>;
}> = [
  {
    title: "业务必要性",
    subtitle: "为什么现在值得投入",
    signals: [
      {
        title: "报建与审查链路分散",
        detail: "模型、材料、意见与法规依据缺少统一入口",
        state: "complete",
      },
      {
        title: "人工审查周期长",
        detail: "重复核对与线下沟通难以追溯和复用",
        state: "complete",
      },
    ],
  },
  {
    title: "初步方案边界",
    subtitle: "准备交付什么",
    signals: [
      {
        title: "一体化报建审查平台",
        detail: "覆盖申报、受理、审查、批注、报告和归档",
        state: "current",
      },
      {
        title: "BIM 智能审查能力",
        detail: "建设模型轻量化、规则引擎与可追溯证据链",
        state: "current",
      },
    ],
  },
  {
    title: "可行性与约束",
    subtitle: "能否安全落地",
    signals: [
      {
        title: "采用混合型生命周期",
        detail: "合同与验收前置，流程和规则采用短周期迭代",
        state: "current",
      },
      {
        title: "设置强制阶段门",
        detail: "法规规则、数据安全、模型兼容和性能必须评审",
        state: "current",
      },
    ],
  },
  {
    title: "授权条件",
    subtitle: "谁批准、给多少资源",
    signals: [
      {
        title: "交付周期已提出",
        detail: "合同生效后 12 个月完成开发、测试和验收",
        state: "complete",
      },
      {
        title: "关键授权信息待补齐",
        detail: "发起人、项目经理、合同起点和首批范围尚待确认",
        state: "planned",
      },
    ],
  },
];

const signalStateLabel: Record<InitiationSignalState, string> = {
  complete: "已确认事实",
  current: "推理结论",
  planned: "待确认",
};

export function ProjectInitiation({ onNavigate }: { onNavigate: (page: LabAreaId) => void }) {
  return (
    <main>
      <section className="management-activity-intro lab-overview-intro">
        <div className="lab-overview-copy">
          <span className="section-index">{CASE_PROJECT_NAME} · 立项</span>
          <h1>先证明值得做，再正式授权启动。</h1>
          <p>从业务问题、初步范围、可行性和授权条件判断项目是否成立；立项结论将成为后续制定项目章程的输入。</p>
          <div className="lab-overview-actions">
            <button className="button button-dark" onClick={() => onNavigate("integration")}>进入整合管理：制定项目章程 →</button>
          </div>
        </div>
        <div className="management-intro-stats">
          <div><span>立项建议</span><strong>有条件通过</strong></div>
          <div><span>推荐生命周期</span><strong>混合型</strong></div>
          <div><span>待确认条件</span><strong>{openQuestions.length} 项</strong></div>
        </div>
      </section>

      <section className="lab-now-strip" aria-label="立项摘要">
        <div><span>业务机会</span><strong>规划报建审查数字化</strong></div>
        <div><span>目标周期</span><strong>合同后 12 个月验收</strong></div>
        <div><span>核心约束</span><strong>法规 · 数据 · 模型兼容</strong></div>
        <div><span>决策状态</span><strong>补齐授权条件后启动</strong></div>
      </section>

      <section className="lab-path-section initiation-evidence-section">
        <div className="knowledge-section-heading">
          <div><span className="section-index">立项判断链</span><h2>从问题与机会，推理到项目授权</h2></div>
          <div className="path-legend">
            <span><i className="path-complete" />已确认事实</span>
            <span><i className="path-current" />推理结论</span>
            <span><i className="path-planned" />待确认</span>
          </div>
        </div>
        <div className="lab-path-map initiation-evidence-map">
          {initiationDimensions.map((dimension, index) => (
            <section className="path-stage" key={dimension.title}>
              <header>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div><strong>{dimension.title}</strong><small>{dimension.subtitle}</small></div>
              </header>
              <div className="path-outcomes">
                {dimension.signals.map((signal) => (
                  <div className={`path-outcome outcome-${signal.state} initiation-signal`} key={signal.title}>
                    <i>{signal.state === "complete" ? "✓" : signal.state === "current" ? "→" : "?"}</i>
                    <span>{signal.title}<small>{signal.detail}</small></span>
                    <em>{signalStateLabel[signal.state]}</em>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      <section className="lab-decision-section initiation-decision-section">
        <div className="decision-card">
          <span className="section-index">立项结论 · 有条件通过</span>
          <h2>业务价值清晰，技术路径可行；先补齐授权与资金边界，再正式启动。</h2>
          <p>项目能够缩短报建审查周期，并形成统一的 BIM 模型、规则与审查证据链。主要不确定性集中在法规口径、模型数据质量、引擎性能和跨系统集成，可通过混合型生命周期、强制阶段门与真实项目试点进行治理。</p>
          <div className="decision-signals">
            <span>业务问题真实且明确</span>
            <span>初步交付边界可描述</span>
            <span>成功标准可量化</span>
            <span>重大约束已有治理思路</span>
          </div>
          <div className="initiation-pending">
            <strong>正式授权前需要回答</strong>
            <ol>
              {openQuestions.map((question) => <li key={question}>{question}</li>)}
            </ol>
          </div>
        </div>
        <button className="next-sample-card" onClick={() => onNavigate("integration") }>
          <span>下一步 · 正式授权</span>
          <strong>制定项目章程</strong>
          <p>把立项事实、边界、约束和成功标准带入访谈与推理树，形成可追溯的项目章程。</p>
          <i>进入整合管理 →</i>
        </button>
      </section>
    </main>
  );
}
