"use client";

import { useMemo, useState } from "react";
import { CASE_PROJECT_NAME } from "./data";
import { DocumentWorkspace } from "./document-workspace";
import { ActivityInputOutputSummary } from "./management-area-page";
import { managementAreaById } from "./management-area-data";
import { engagementLevels, initialStakeholders, type EngagementLevel, type Stakeholder } from "./stakeholder-data";

function quadrantFor(power: number, interest: number) {
  if (power >= 4 && interest >= 4) return "重点管理";
  if (power >= 4 && interest < 4) return "令其满意";
  if (power < 4 && interest >= 4) return "随时告知";
  return "监督";
}

function engagementLabel(level: EngagementLevel) {
  return engagementLevels.find((item) => item.id === level)?.label ?? level;
}

export function StakeholderPage() {
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>(initialStakeholders);
  const [selectedId, setSelectedId] = useState("STK-008");
  const [quadrantFilter, setQuadrantFilter] = useState<string | null>(null);
  const selected = stakeholders.find((item) => item.id === selectedId) ?? stakeholders[0];

  const quadrantCounts = useMemo(() => {
    const counts: Record<string, number> = { "重点管理": 0, "令其满意": 0, "随时告知": 0, "监督": 0 };
    stakeholders.forEach((item) => counts[quadrantFor(item.power, item.interest)]++);
    return counts;
  }, [stakeholders]);

  const engagementGaps = stakeholders.filter((item) => {
    const current = engagementLevels.findIndex((level) => level.id === item.currentEngagement);
    const desired = engagementLevels.findIndex((level) => level.id === item.desiredEngagement);
    return desired > current;
  }).length;

  const filteredStakeholders = quadrantFilter
    ? stakeholders.filter((item) => quadrantFor(item.power, item.interest) === quadrantFilter)
    : stakeholders;

  const updateSelected = (patch: Partial<Stakeholder>) => {
    setStakeholders((current) => current.map((item) => item.id === selectedId ? { ...item, ...patch } : item));
  };

  const addStakeholder = () => {
    const id = `STK-${String(stakeholders.length + 1).padStart(3, "0")}`;
    const next: Stakeholder = {
      id,
      role: "新干系人角色",
      organization: "待确认",
      internalExternal: "内部",
      needs: "请补充主要需求与期望。",
      influence: "请补充对项目的影响。",
      power: 3,
      interest: 3,
      attitude: "中立",
      currentEngagement: "neutral",
      desiredEngagement: "supportive",
      strategy: "请补充管理策略。",
      sourceIds: ["manual-entry"],
    };
    setStakeholders((current) => [...current, next]);
    setSelectedId(id);
    setQuadrantFilter(null);
  };

  return (
    <main>
      <section className="management-activity-intro">
        <div>
          <span className="section-index">项目干系人管理 · 识别干系人</span>
          <h1>干系人登记册与权力利益方格</h1>
          <p>从章程、风险和访谈中识别关键角色，用权力利益方格分配关注，再比较当前与期望参与程度。</p>
        </div>
        <div className="management-intro-stats">
          <div><span>已识别角色</span><strong>{stakeholders.length}</strong></div>
          <div><span>重点管理</span><strong>{quadrantCounts["重点管理"]}</strong></div>
          <div><span>存在参与差距</span><strong>{engagementGaps}</strong></div>
        </div>
      </section>
      <ActivityInputOutputSummary process={managementAreaById.stakeholder.processes[0]} />

      <section className="stakeholder-grid-section">
        <div className="panel power-interest-panel">
          <div className="panel-heading">
            <div><span className="section-index">权力 × 利益</span><h2>权力利益方格</h2></div>
            {quadrantFilter && <button className="clear-filter" onClick={() => setQuadrantFilter(null)}>清除“{quadrantFilter}”筛选 ×</button>}
          </div>
          <div className="power-interest-wrap">
            <div className="quadrant-axis axis-power">权力 →</div>
            <div className="quadrant-grid" role="img" aria-label={`${CASE_PROJECT_NAME}干系人权力利益方格`}>
              <button className="quadrant quadrant-satisfy" onClick={() => setQuadrantFilter("令其满意")}><strong>令其满意</strong><span>高权力 · 低利益</span><i>{quadrantCounts["令其满意"]}</i></button>
              <button className="quadrant quadrant-manage" onClick={() => setQuadrantFilter("重点管理")}><strong>重点管理</strong><span>高权力 · 高利益</span><i>{quadrantCounts["重点管理"]}</i></button>
              <button className="quadrant quadrant-monitor" onClick={() => setQuadrantFilter("监督")}><strong>监督</strong><span>低权力 · 低利益</span><i>{quadrantCounts["监督"]}</i></button>
              <button className="quadrant quadrant-inform" onClick={() => setQuadrantFilter("随时告知")}><strong>随时告知</strong><span>低权力 · 高利益</span><i>{quadrantCounts["随时告知"]}</i></button>
              {stakeholders.map((item, index) => {
                const left = 7 + ((item.interest - 1) / 4) * 86;
                const top = 93 - ((item.power - 1) / 4) * 86;
                const offset = (index % 3 - 1) * 10;
                return (
                  <button
                    key={item.id}
                    className={`stakeholder-dot ${selectedId === item.id ? "active" : ""} ${item.internalExternal === "外部" ? "external" : ""}`}
                    style={{ left: `${left}%`, top: `${top}%`, marginLeft: offset }}
                    onClick={() => { setSelectedId(item.id); setQuadrantFilter(null); }}
                    aria-label={`${item.role}，权力 ${item.power}，利益 ${item.interest}，${quadrantFor(item.power, item.interest)}`}
                  >
                    {item.id.replace("STK-", "")}
                  </button>
                );
              })}
            </div>
            <div className="quadrant-axis axis-interest">利益 →</div>
          </div>
          <div className="quadrant-legend"><span><i className="dot-internal" />内部角色</span><span><i className="dot-external" />外部角色</span><p>点击象限筛选登记册；点击编号编辑角色。</p></div>
        </div>

        <aside className="panel stakeholder-editor-panel">
          <div className="panel-heading">
            <div><span className="section-index">干系人详情</span><h2>{selected.id}</h2></div>
            <span className="quadrant-pill">{quadrantFor(selected.power, selected.interest)}</span>
          </div>
          <div className="stakeholder-editor-scroll">
            <div className="editor-two-col">
              <label className="editor-field"><span>角色</span><input value={selected.role} onChange={(event) => updateSelected({ role: event.target.value })} /></label>
              <label className="editor-field"><span>内部／外部</span><select value={selected.internalExternal} onChange={(event) => updateSelected({ internalExternal: event.target.value as "内部" | "外部" })}><option>内部</option><option>外部</option></select></label>
            </div>
            <label className="editor-field"><span>组织或群体</span><input value={selected.organization} onChange={(event) => updateSelected({ organization: event.target.value })} /></label>
            <label className="editor-field"><span>主要需求与期望</span><textarea rows={3} value={selected.needs} onChange={(event) => updateSelected({ needs: event.target.value })} /></label>
            <label className="editor-field"><span>影响方式</span><textarea rows={3} value={selected.influence} onChange={(event) => updateSelected({ influence: event.target.value })} /></label>
            <div className="score-editor stakeholder-score-editor">
              <label><span>权力</span><select value={selected.power} onChange={(event) => updateSelected({ power: Number(event.target.value) })}>{[1, 2, 3, 4, 5].map((value) => <option key={value}>{value}</option>)}</select></label>
              <span>×</span>
              <label><span>利益</span><select value={selected.interest} onChange={(event) => updateSelected({ interest: Number(event.target.value) })}>{[1, 2, 3, 4, 5].map((value) => <option key={value}>{value}</option>)}</select></label>
              <span>=</span>
              <div className="score-result stakeholder-quadrant-result"><strong>{quadrantFor(selected.power, selected.interest)}</strong></div>
            </div>
            <div className="editor-two-col">
              <label className="editor-field"><span>当前参与程度</span><select value={selected.currentEngagement} onChange={(event) => updateSelected({ currentEngagement: event.target.value as EngagementLevel })}>{engagementLevels.map((level) => <option value={level.id} key={level.id}>{level.label}</option>)}</select></label>
              <label className="editor-field"><span>期望参与程度</span><select value={selected.desiredEngagement} onChange={(event) => updateSelected({ desiredEngagement: event.target.value as EngagementLevel })}>{engagementLevels.map((level) => <option value={level.id} key={level.id}>{level.label}</option>)}</select></label>
            </div>
            <label className="editor-field"><span>管理策略</span><textarea rows={3} value={selected.strategy} onChange={(event) => updateSelected({ strategy: event.target.value })} /></label>
            <div className="source-chain"><span>来源依据</span>{selected.sourceIds.map((source) => <code key={source}>{source}</code>)}</div>
          </div>
        </aside>
      </section>

      <section className="panel engagement-panel">
        <div className="register-heading">
          <div><span className="section-index">当前 C / 期望 D</span><h2>干系人参与度评估矩阵</h2></div>
          <span className="engagement-summary">{engagementGaps} 个角色需要提升参与程度</span>
        </div>
        <div className="engagement-table-wrap">
          <table className="engagement-table">
            <thead><tr><th>干系人</th>{engagementLevels.map((level) => <th key={level.id}>{level.label}</th>)}<th>差距</th></tr></thead>
            <tbody>{stakeholders.map((item) => {
              const currentIndex = engagementLevels.findIndex((level) => level.id === item.currentEngagement);
              const desiredIndex = engagementLevels.findIndex((level) => level.id === item.desiredEngagement);
              return (
                <tr key={item.id} className={selectedId === item.id ? "selected" : ""}>
                  <td><button onClick={() => setSelectedId(item.id)}><code>{item.id}</code><strong>{item.role}</strong></button></td>
                  {engagementLevels.map((level) => {
                    const isCurrent = item.currentEngagement === level.id;
                    const isDesired = item.desiredEngagement === level.id;
                    return <td key={level.id}><span className={`${isCurrent || isDesired ? "marked" : ""} ${isCurrent && isDesired ? "same" : ""}`}>{isCurrent ? "C" : ""}{isDesired ? "D" : ""}</span></td>;
                  })}
                  <td><strong>{desiredIndex > currentIndex ? `+${desiredIndex - currentIndex}` : "已达成"}</strong></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      </section>

      <section className="panel stakeholder-register-panel">
        <div className="register-heading">
          <div><span className="section-index">动态登记册</span><h2>{quadrantFilter ? `${quadrantFilter}的干系人` : "全部干系人"}</h2></div>
          <div className="register-actions"><span>显示 {filteredStakeholders.length} / {stakeholders.length} 项</span><button className="button button-dark button-small" onClick={addStakeholder}>＋ 添加干系人</button></div>
        </div>
        <div className="risk-table-wrap">
          <table className="risk-table stakeholder-register-table">
            <thead><tr><th>编号</th><th>角色</th><th>组织</th><th>类型</th><th>权力</th><th>利益</th><th>分类</th><th>态度</th><th>当前参与</th><th>期望参与</th><th>管理策略</th></tr></thead>
            <tbody>{filteredStakeholders.map((item) => (
              <tr key={item.id} className={selectedId === item.id ? "selected" : ""}>
                <td><code>{item.id}</code></td>
                <td><button className="risk-title-button" onClick={() => setSelectedId(item.id)}><span>{item.internalExternal === "内部" ? "内" : "外"}</span>{item.role}</button></td>
                <td>{item.organization}</td><td>{item.internalExternal}</td><td>{item.power}</td><td>{item.interest}</td>
                <td><span className="quadrant-pill">{quadrantFor(item.power, item.interest)}</span></td><td>{item.attitude}</td>
                <td>{engagementLabel(item.currentEngagement)}</td><td>{engagementLabel(item.desiredEngagement)}</td><td>{item.strategy}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <DocumentWorkspace areaId="stakeholder" />
    </main>
  );
}
