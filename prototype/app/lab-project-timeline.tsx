"use client";

import type { RefObject } from "react";

type TimelineMilestone = { week: number; label: string };
type TimelineTakeoverPoint = { scenarioId: string; week: number; label: string };

export function LabProjectTimeline({
  selectedWeek,
  stageLabel,
  progressPercent,
  milestones,
  takeoverPoints,
  currentWeekHasLabel,
  currentTakeoverPoint,
  branchActive,
  loadingScenarioId,
  compactTimelineVisible,
  timelinePanelRef,
  scenarioLabel,
  onWeekChange,
  onTakeover,
}: {
  selectedWeek: number;
  stageLabel: string;
  progressPercent: number;
  milestones: TimelineMilestone[];
  takeoverPoints: TimelineTakeoverPoint[];
  currentWeekHasLabel: boolean;
  currentTakeoverPoint: TimelineTakeoverPoint | null;
  branchActive: boolean;
  loadingScenarioId: string | null;
  compactTimelineVisible: boolean;
  timelinePanelRef: RefObject<HTMLElement | null>;
  scenarioLabel: (scenarioId: string) => string;
  onWeekChange: (week: number) => void;
  onTakeover: (point: TimelineTakeoverPoint) => void;
}) {
  const weekPosition = (week: number) => `${((week - 1) / 31) * 100}%`;

  return (
    <>
      <section className="lab-v2-project-head">
        <div><span>PROJECT LAB / LEARNING MODE</span><h1>车主远程控车应用项目</h1><p>完整主线回放 · 8 人团队 · 32 周 · BAC 260 万</p></div>
        <div className="lab-v2-head-status"><span>当前观察位置</span><strong>W{selectedWeek.toString().padStart(2, "0")}</strong><small>{stageLabel}</small></div>
      </section>

      <section ref={timelinePanelRef} className="lab-v2-timeline-panel" aria-label="项目主线进度条">
        <header>
          <div><span>MAINLINE / 最短成功路径</span><strong>拖动进度条，观察项目状态与文件版本同步变化</strong></div>
          <div className="lab-v2-playback-status"><i />主线回放 · ← → 切换周</div>
        </header>
        <div className="lab-v2-range-wrap">
          <div className="lab-v2-range-fill" style={{ width: weekPosition(selectedWeek) }} />
          <input type="range" min="1" max="32" step="1" value={selectedWeek} onChange={(event) => onWeekChange(Number(event.target.value))} aria-label="项目周次" />
          {milestones.map((milestone) => (
            <button key={milestone.week} className={`lab-v2-milestone ${selectedWeek >= milestone.week ? "passed" : ""}`} style={{ left: weekPosition(milestone.week) }} onClick={() => onWeekChange(milestone.week)}>
              <i /><span>W{milestone.week}</span><small>{milestone.label}</small>
            </button>
          ))}
          {takeoverPoints.map((point) => {
            const active = selectedWeek === point.week;
            const available = active && currentTakeoverPoint?.scenarioId === point.scenarioId && !branchActive;
            const alignment = point.week >= 25 ? "align-right" : point.week <= 9 ? "align-left" : "align-center";
            if (available) {
              return (
                <div
                  key={point.scenarioId}
                  className={`lab-v2-takeover-marker active available ${alignment}`}
                  style={{ left: weekPosition(point.week) }}
                  role="group"
                  aria-label={`第${point.week}周接手点，${scenarioLabel(point.scenarioId)}`}
                >
                  <span>接手点 · {scenarioLabel(point.scenarioId)}</span>
                  <div className="lab-v2-takeover-marker-action-row">
                    <b>W{point.week}</b>
                    <button
                      type="button"
                      className="lab-v2-takeover-action"
                      disabled={loadingScenarioId !== null}
                      onClick={() => onTakeover(point)}
                    >
                      {loadingScenarioId === point.scenarioId ? "正在创建分支…" : "从这里接手 →"}
                    </button>
                  </div>
                </div>
              );
            }
            return (
              <button
                key={point.scenarioId}
                type="button"
                className={`lab-v2-takeover-marker ${active ? "active" : ""}`}
                style={{ left: weekPosition(point.week) }}
                onClick={() => onWeekChange(point.week)}
                aria-label={`查看第${point.week}周接手点`}
              >
                <span>接手点</span><b>W{point.week}</b>
              </button>
            );
          })}
          {!currentWeekHasLabel ? <div className="lab-v2-current-week-label" style={{ left: weekPosition(selectedWeek) }}><b>W{selectedWeek}</b></div> : null}
        </div>
        <div className="lab-v2-timeline-meta"><span>W01</span><strong>{progressPercent.toFixed(1)}% 项目价值已完成</strong><span>W32</span></div>
      </section>

      {compactTimelineVisible ? (
        <section className="lab-v2-compact-timeline" aria-label={`吸顶项目时间轴，当前第 ${selectedWeek} 周`}>
          <span>W01</span>
          <div>
            <i style={{ width: weekPosition(selectedWeek) }} />
            <input type="range" min="1" max="32" step="1" value={selectedWeek} onChange={(event) => onWeekChange(Number(event.target.value))} aria-label="吸顶项目周次" />
            {milestones.slice(1, -1).map((milestone) => (
              <button key={milestone.week} className={selectedWeek >= milestone.week ? "passed" : ""} style={{ left: weekPosition(milestone.week) }} onClick={() => onWeekChange(milestone.week)} aria-label={`跳转到 W${milestone.week} ${milestone.label}`}>
                <i /><span>{milestone.label}</span>
              </button>
            ))}
            <mark style={{ left: weekPosition(selectedWeek) }}>{selectedWeek !== 1 && selectedWeek !== 32 ? <b>W{selectedWeek}</b> : null}</mark>
          </div>
          <span>W32</span>
        </section>
      ) : null}
    </>
  );
}
