"use client";

import { useMemo, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

export type DashboardId =
  | "health"
  | "spi"
  | "cpi"
  | "bac"
  | "ac"
  | "gantt"
  | "workload"
  | "engagement"
  | "raci"
  | "risk-matrix"
  | "requirements"
  | "burndown"
  | "ccb"
  | "network"
  | "wbs"
  | "risk-status";

export type DashboardBaselineWeek = {
  week: number;
  plannedTeamPersonDays: number;
};

export type DashboardIterationSprint = {
  id: string;
  tasks: Array<{ storyPoints: number; completedWorkday: number }>;
};

export type DashboardStakeholder = {
  id: string;
  title: string;
};

export type DashboardWorkPackage = {
  id: string;
  title: string;
  startWeek: number;
  endWeek: number;
};

export type DashboardScheduleActivity = {
  id: string;
  parentId: string;
  title: string;
  startWeek: number;
  endWeek: number;
  predecessors?: Array<{ activityId: string; type: string; lagWeeks: number }>;
};

export type DashboardNetworkActivity = {
  activityId: string;
  expectedDuration: number;
  durationVariance: number;
  earliestStart: number;
  earliestFinish: number;
  latestStart: number;
  latestFinish: number;
  totalFloat: number;
  freeFloat: number;
  isCritical: boolean;
};

export type DashboardScheduleNetwork = {
  activities: DashboardNetworkActivity[];
};

const ccbDutyByStakeholderId: Record<string, string> = {
  sponsor: "主席 / 最终审批",
  pm: "组织评审 / 记录决议",
  product_ba: "业务价值 / 范围影响",
  tech_lead: "技术方案 / 进度影响",
  devsecops: "安全 / 发布影响",
};

export function Sparkline({ values, target = 1 }: { values: number[]; target?: number }) {
  const width = 220;
  const height = 62;
  const minimum = Math.min(...values, target) - 0.015;
  const maximum = Math.max(...values, target) + 0.015;
  const span = Math.max(maximum - minimum, 0.01);
  const points = values.map((value, index) => {
    const pointX = values.length === 1 ? width : (index / (values.length - 1)) * width;
    const pointY = height - ((value - minimum) / span) * height;
    return `${pointX.toFixed(1)},${pointY.toFixed(1)}`;
  }).join(" ");
  const targetY = height - ((target - minimum) / span) * height;
  return (
    <svg className="lab-v2-sparkline" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="趋势图">
      <line x1="0" x2={width} y1={targetY} y2={targetY} />
      <polyline points={points} />
    </svg>
  );
}

export function WorkloadBars({ weeks, selectedWeek }: { weeks: DashboardBaselineWeek[]; selectedWeek: number }) {
  const windowSize = 21;
  const startWeek = Math.min(Math.max(1, selectedWeek - 10), Math.max(1, weeks.length - windowSize + 1));
  const visibleWeeks = weeks.slice(startWeek - 1, startWeek - 1 + windowSize);
  const maximum = Math.max(...visibleWeeks.map((item) => item.plannedTeamPersonDays), 1);
  return (
    <div className="lab-v2-workload-bars">
      <div>{visibleWeeks.map((item) => (
        <i key={item.week} className={item.week === selectedWeek ? "current" : item.week < selectedWeek ? "past" : "future"} title={`W${item.week}：${item.plannedTeamPersonDays} 人日`}>
          <b style={{ height: `${Math.max(8, item.plannedTeamPersonDays / maximum * 100)}%` }} />
        </i>
      ))}</div>
      <footer><span>W{visibleWeeks[0]?.week}</span><strong>当前 W{selectedWeek}</strong><span>W{visibleWeeks.at(-1)?.week}</span></footer>
    </div>
  );
}

export function SprintBurndown({ sprint, elapsedWorkdays }: { sprint: DashboardIterationSprint | null; elapsedWorkdays: number }) {
  if (!sprint) return <div className="lab-v2-burndown-empty">当前周没有进行中的迭代任务</div>;
  const width = 260;
  const height = 88;
  const horizontalPadding = 8;
  const topPadding = 8;
  const bottomPadding = 18;
  const chartWidth = width - horizontalPadding * 2;
  const chartHeight = height - topPadding - bottomPadding;
  const totalWork = sprint.tasks.reduce((total, task) => total + task.storyPoints, 0);
  const totalWorkdays = 10;
  const x = (day: number) => horizontalPadding + day / totalWorkdays * chartWidth;
  const y = (remaining: number) => topPadding + (1 - remaining / totalWork) * chartHeight;
  const idealPath = `M ${x(0)} ${y(totalWork)} L ${x(totalWorkdays)} ${y(0)}`;
  const checkpoints = Array.from({ length: totalWorkdays + 1 }, (_, day) => ({
    day,
    remaining: sprint.tasks.filter((task) => task.completedWorkday > day).reduce((total, task) => total + task.storyPoints, 0),
  }));
  const visibleCheckpoints = checkpoints.filter((point) => point.day <= elapsedWorkdays);
  const actualPath = visibleCheckpoints.slice(1).reduce(
    (path, point) => `${path} H ${x(point.day)} V ${y(point.remaining)}`,
    `M ${x(visibleCheckpoints[0].day)} ${y(visibleCheckpoints[0].remaining)}`,
  );
  const currentPoint = visibleCheckpoints.at(-1) ?? checkpoints[0];

  return (
    <svg className="lab-v2-burndown" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${sprint.id} 迭代燃尽图，总计 ${totalWork} 故事点，当前剩余 ${currentPoint.remaining} 点；虚线为理想燃尽，实线按任务完成日派生`}>
      <path className="ideal" d={idealPath} />
      <path className="actual" d={actualPath} />
      <circle cx={x(currentPoint.day)} cy={y(currentPoint.remaining)} r="3" />
      <text x={x(0)} y={height - 3}>第1周</text>
      <text className="weekend" x={x(5)} y={height - 3}>第2周</text>
      <text className="end" x={x(10)} y={height - 3}>结束</text>
    </svg>
  );
}

export function CcbMemberIndicator({ members }: { members: DashboardStakeholder[] }) {
  return (
    <span className="lab-v2-ccb-members" role="img" aria-label={`CCB 核心成员：${members.map((member) => member.title).join("、")}`}>
      <span className="lab-v2-ccb-people" aria-hidden="true">{Array.from({ length: 3 }, (_, index) => <i key={index} />)}</span>
      <span className="lab-v2-ccb-tooltip" role="tooltip">
        <b>CCB 核心成员</b>
        {members.map((member) => <span key={member.id}><strong>{member.title}</strong><small>{ccbDutyByStakeholderId[member.id]}</small></span>)}
        <em>测试、法务与隐私负责人按变更议题列席</em>
      </span>
    </span>
  );
}

type NetworkLayoutActivity = DashboardScheduleActivity & DashboardNetworkActivity & { lane: number; rowY: number };

export function WbsCards({ workPackages, activities }: { workPackages: DashboardWorkPackage[]; activities: DashboardScheduleActivity[] }) {
  return (
    <div className="lab-v2-wbs-cards">
      {workPackages.map((workPackage) => {
        const packageActivities = activities.filter((activity) => activity.parentId === workPackage.id);
        return (
          <details key={workPackage.id}>
            <summary>
              <span><strong>{workPackage.id}</strong><small>{workPackage.title}</small></span>
              <i>W{workPackage.startWeek}–W{workPackage.endWeek}</i>
              <b>展开</b>
            </summary>
            <ol>{packageActivities.map((activity, activityIndex) => (
              <li key={activity.id}><b>{String(activityIndex + 1).padStart(2, "0")}</b><span>{activity.title}</span><i>W{activity.startWeek}–W{activity.endWeek}</i></li>
            ))}</ol>
          </details>
        );
      })}
    </div>
  );
}

export function TimeScaledNetwork({
  activities,
  network,
  workPackages,
  selectedWeek,
}: {
  activities: DashboardScheduleActivity[];
  network: DashboardScheduleNetwork;
  workPackages: DashboardWorkPackage[];
  selectedWeek: number;
}) {
  const labelWidth = 190;
  const weekWidth = 36;
  const laneHeight = 34;
  const groupGap = 12;
  const topOffset = 42;
  const [hoverCell, setHoverCell] = useState<{ week: number; groupId: string } | null>(null);
  const layout = useMemo(() => {
    const networkById = new Map(network.activities.map((activity) => [activity.activityId, activity]));
    const layoutActivities: NetworkLayoutActivity[] = [];
    const groupBounds: Array<{ id: string; title: string; top: number; bottom: number }> = [];
    let currentY = topOffset;

    for (const workPackage of workPackages) {
      const groupedActivities = activities
        .filter((activity) => activity.parentId === workPackage.id)
        .sort((left, right) => left.startWeek - right.startWeek || left.endWeek - right.endWeek);
      const laneEnds: number[] = [];
      const groupTop = currentY;
      for (const activity of groupedActivities) {
        const networkActivity = networkById.get(activity.id);
        if (!networkActivity) continue;
        let lane = laneEnds.findIndex((endWeek) => endWeek < activity.startWeek);
        if (lane === -1) {
          lane = laneEnds.length;
          laneEnds.push(activity.endWeek);
        } else {
          laneEnds[lane] = activity.endWeek;
        }
        layoutActivities.push({ ...activity, ...networkActivity, lane, rowY: currentY + lane * laneHeight });
      }
      currentY += Math.max(laneEnds.length, 1) * laneHeight;
      groupBounds.push({ id: workPackage.id, title: workPackage.title, top: groupTop, bottom: currentY });
      currentY += groupGap;
    }
    return { activities: layoutActivities, groups: groupBounds, height: currentY + 12 };
  }, [activities, network.activities, workPackages]);
  const layoutById = new Map(layout.activities.map((activity) => [activity.id, activity]));
  const totalWidth = labelWidth + weekWidth * 32 + 18;
  const weekX = (week: number) => labelWidth + (week - 1) * weekWidth;
  const hoveredGroup = hoverCell ? layout.groups.find((group) => group.id === hoverCell.groupId) : null;
  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerX = (event.clientX - bounds.left) / bounds.width * totalWidth;
    const pointerY = (event.clientY - bounds.top) / bounds.height * layout.height;
    if (pointerX < labelWidth || pointerY < 28) {
      setHoverCell(null);
      return;
    }
    const week = Math.min(32, Math.max(1, Math.floor((pointerX - labelWidth) / weekWidth) + 1));
    const group = layout.groups.find((item) => pointerY >= item.top && pointerY <= item.bottom);
    if (!group) {
      setHoverCell(null);
      return;
    }
    setHoverCell((current) => current?.week === week && current.groupId === group.id ? current : { week, groupId: group.id });
  };

  return (
    <div className="lab-v2-network-scroll">
      <svg className="lab-v2-time-network" viewBox={`0 0 ${totalWidth} ${layout.height}`} role="img" aria-label="完整项目时标网络图" onPointerMove={handlePointerMove} onPointerLeave={() => setHoverCell(null)}>
        <defs><marker id="lab-v2-network-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" /></marker></defs>
        <rect className="network-background" x="0" y="0" width={totalWidth} height={layout.height} />
        {hoverCell && hoveredGroup ? <g className="network-hover-guides" aria-hidden="true"><rect className="horizontal" x="0" y={hoveredGroup.top} width={totalWidth} height={hoveredGroup.bottom - hoveredGroup.top} /><rect className="vertical" x={weekX(hoverCell.week)} y="28" width={weekWidth} height={layout.height - 28} /></g> : null}
        {Array.from({ length: 32 }, (_, index) => index + 1).map((week) => <g key={week}><text className={`network-week-label ${week === selectedWeek ? "selected" : ""} ${hoverCell?.week === week ? "hovered" : ""}`} x={weekX(week) + weekWidth / 2} y="20">W{week}</text></g>)}
        {layout.groups.map((group) => <g key={group.id}><text className={`network-group-id ${hoverCell?.groupId === group.id ? "hovered" : ""}`} x="8" y={group.top + 13}>{group.id}</text><text className={`network-group-title ${hoverCell?.groupId === group.id ? "hovered" : ""}`} x="8" y={group.top + 28}>{group.title}</text></g>)}
        <g className="network-connections">{layout.activities.flatMap((activity) => (activity.predecessors ?? []).flatMap((predecessor) => {
          const predecessorActivity = layoutById.get(predecessor.activityId);
          if (!predecessorActivity) return [];
          const startX = weekX(predecessorActivity.endWeek) + weekWidth / 2;
          const startY = predecessorActivity.rowY + 13;
          const endX = weekX(activity.startWeek) + weekWidth / 2;
          const endY = activity.rowY + 13;
          const turnX = Math.max(startX + 10, (startX + endX) / 2);
          return [<path key={`${predecessor.activityId}-${activity.id}`} className={predecessorActivity.isCritical && activity.isCritical ? "critical" : ""} d={`M ${startX} ${startY} L ${turnX} ${startY} L ${turnX} ${endY} L ${endX} ${endY}`} />];
        }))}</g>
        <g className="network-activities">{layout.activities.map((activity) => {
          const nodeX = weekX(activity.startWeek) + 2;
          const nodeWidth = Math.max(30, (activity.endWeek - activity.startWeek + 1) * weekWidth - 4);
          const completed = activity.endWeek < selectedWeek;
          const active = activity.startWeek <= selectedWeek && activity.endWeek >= selectedWeek;
          return <g key={activity.id} className={`${activity.isCritical ? "critical" : ""} ${completed ? "completed" : active ? "active" : "planned"}`}><title>{`${activity.id} ${activity.title}；W${activity.startWeek}–W${activity.endWeek}；ES ${activity.earliestStart} / EF ${activity.earliestFinish} / LS ${activity.latestStart} / LF ${activity.latestFinish} / TF ${activity.totalFloat} / FF ${activity.freeFloat}`}</title><rect x={nodeX} y={activity.rowY} width={nodeWidth} height="26" rx="4" /><text x={nodeX + 7} y={activity.rowY + 17}>{completed ? "✓ " : active ? "● " : ""}{activity.id}</text>{!activity.isCritical && nodeWidth >= 80 ? <text className="network-float" x={nodeX + nodeWidth - 7} y={activity.rowY + 17}>TF {activity.totalFloat}</text> : null}</g>;
        })}</g>
        <line className="network-now-line" x1={weekX(selectedWeek) + weekWidth / 2} x2={weekX(selectedWeek) + weekWidth / 2} y1="28" y2={layout.height} />
      </svg>
    </div>
  );
}

export function DashboardCard({
  id,
  eyebrow,
  title,
  value,
  note,
  className = "",
  interactiveChildren = false,
  titleAccessory,
  onOpen,
  children,
}: {
  id: DashboardId;
  eyebrow: string;
  title: string;
  value?: string;
  note?: string;
  className?: string;
  interactiveChildren?: boolean;
  titleAccessory?: ReactNode;
  onOpen: (id: DashboardId) => void;
  children?: ReactNode;
}) {
  if (interactiveChildren) {
    return (
      <article className={`lab-v2-widget ${className}`}>
        <header><span>{eyebrow}</span><button type="button" aria-label={`打开${title}详细数据`} onClick={() => onOpen(id)}>↗</button></header>
        {titleAccessory ? <div className="lab-v2-widget-title"><h3>{title}</h3>{titleAccessory}</div> : <h3>{title}</h3>}
        {value && <strong className="lab-v2-widget-value">{value}</strong>}
        {children}
        {note && <footer>{note}</footer>}
      </article>
    );
  }
  return (
    <button className={`lab-v2-widget ${className}`} onClick={() => onOpen(id)}>
      <header><span>{eyebrow}</span><b>↗</b></header>
      {titleAccessory ? <div className="lab-v2-widget-title"><h3>{title}</h3>{titleAccessory}</div> : <h3>{title}</h3>}
      {value && <strong className="lab-v2-widget-value">{value}</strong>}
      {children}
      {note && <footer>{note}</footer>}
    </button>
  );
}
