"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type RangeDays = 7 | 30 | 90;

type AnalyticsSummary = {
  generatedAt: string;
  rangeDays: number;
  rangeStartDate: string;
  timezone: "Asia/Shanghai";
  identifiedUsers: number;
  authenticatedVisitors: number;
  authenticatedVisitorsInRange: number;
  todayActiveUsers: number;
  branchCreators: number;
  aiReviewRequests: number;
  aiReviewRequestsInRange: number;
  dailyActivity: Array<{ date: string; activeUsers: number; visits: number }>;
  materialViews: Array<{
    scenarioId: string;
    scenarioTitle?: string;
    materialId: string;
    materialTitle?: string;
    views: number;
    uniqueUsers: number;
  }>;
};

type ApiError = { error?: { message?: string } };

const numberFormatter = new Intl.NumberFormat("zh-CN");
const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  month: "numeric",
  day: "numeric",
});

function formatCount(value: number) {
  return numberFormatter.format(value);
}

function formatDay(value: string) {
  return dateFormatter.format(new Date(`${value}T00:00:00+08:00`));
}

export function StatsDashboard({ viewerName }: { viewerName: string }) {
  const [rangeDays, setRangeDays] = useState<RangeDays>(30);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/analytics/summary?days=${rangeDays}`, {
      cache: "no-store",
      credentials: "same-origin",
      headers: { accept: "application/json" },
      signal: controller.signal,
    }).then(async (response) => {
      const payload = await response.json() as AnalyticsSummary | ApiError;
      if (!response.ok) {
        if (response.status === 403) throw new Error("当前账号没有统计页访问权限。请在站点环境中加入管理员邮箱后再试。");
        throw new Error("error" in payload && payload.error?.message ? payload.error.message : "无法读取统计数据");
      }
      return payload as AnalyticsSummary;
    }).then((payload) => {
      setSummary(payload);
    }).catch((caught) => {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(caught instanceof Error ? caught.message : "无法读取统计数据");
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [rangeDays]);

  const chartMaximum = useMemo(() => Math.max(
    1,
    ...(summary?.dailyActivity.map((item) => Math.max(item.activeUsers, item.visits)) ?? [1]),
  ), [summary]);

  const materials = useMemo(() => [...(summary?.materialViews ?? [])].sort((left, right) => (
    right.views - left.views || left.scenarioId.localeCompare(right.scenarioId) || left.materialId.localeCompare(right.materialId)
  )), [summary]);

  return (
    <main className="stats-page">
      <div className="stats-shell">
        <header className="stats-header">
          <div>
            <Link className="stats-brand" href="/">PM Atlas</Link>
            <p>站点数据统计</p>
          </div>
          <nav aria-label="统计页操作">
            <span>{viewerName}</span>
            <Link href="/">返回主站</Link>
            <a href="/signout-with-chatgpt?return_to=%2F">退出登录</a>
          </nav>
        </header>

        <section className="stats-intro">
          <div>
            <p className="stats-eyebrow">OWNER DASHBOARD</p>
            <h1>使用概览</h1>
            <p>只展示汇总数据，不展示邮箱、页面输入、行动链内容或原始 IP。</p>
          </div>
          <div className="stats-range" aria-label="统计周期">
            {([7, 30, 90] as const).map((days) => (
              <button
                key={days}
                type="button"
                className={rangeDays === days ? "active" : ""}
                onClick={() => {
                  if (days === rangeDays) return;
                  setLoading(true);
                  setError(null);
                  setRangeDays(days);
                }}
              >
                {days} 天
              </button>
            ))}
          </div>
        </section>

        {loading && <div className="stats-state" role="status">正在读取统计数据…</div>}
        {error && <div className="stats-state error" role="alert"><strong>暂时无法显示</strong><span>{error}</span></div>}

        {!loading && !error && summary && (
          <>
            <section className="stats-metrics" aria-label="核心指标">
              <article><span>已识别用户</span><strong>{formatCount(summary.identifiedUsers)}</strong><small>累计登录或创建过分支</small></article>
              <article><span>登录状态访问用户</span><strong>{formatCount(summary.authenticatedVisitors)}</strong><small>累计去重 · 近 {rangeDays} 天 {formatCount(summary.authenticatedVisitorsInRange)}</small></article>
              <article><span>今日活跃登录用户</span><strong>{formatCount(summary.todayActiveUsers)}</strong><small>按北京时间自然日</small></article>
              <article><span>创建分支用户</span><strong>{formatCount(summary.branchCreators)}</strong><small>累计去重用户</small></article>
              <article><span>AI 复盘使用</span><strong>{formatCount(summary.aiReviewRequests)}</strong><small>累计请求 · 近 {rangeDays} 天 {formatCount(summary.aiReviewRequestsInRange)}</small></article>
            </section>

            <section className="stats-panel">
              <div className="stats-panel-heading">
                <div><p>DAILY ACTIVITY</p><h2>登录活跃趋势</h2></div>
                <span>深色：活跃用户　浅色：访问次数</span>
              </div>
              <div className="stats-chart" aria-label={`近 ${rangeDays} 天活跃用户与访问次数柱状图`}>
                {summary.dailyActivity.map((item, index) => (
                  <div className="stats-chart-day" key={item.date} title={`${item.date}：${item.activeUsers} 位活跃用户，${item.visits} 次访问`}>
                    <div className="stats-bars">
                      <i className="visits" style={{ height: `${Math.max(item.visits ? 5 : 0, item.visits / chartMaximum * 100)}%` }} />
                      <i className="users" style={{ height: `${Math.max(item.activeUsers ? 5 : 0, item.activeUsers / chartMaximum * 100)}%` }} />
                    </div>
                    {(rangeDays <= 7 || index % (rangeDays === 30 ? 5 : 15) === 0 || index === summary.dailyActivity.length - 1) && <small>{formatDay(item.date)}</small>}
                  </div>
                ))}
              </div>
            </section>

            <section className="stats-panel">
              <div className="stats-panel-heading">
                <div><p>SCENARIO MATERIALS</p><h2>情景材料查看</h2></div>
                <span>每个分支首次打开计 1 次</span>
              </div>
              {materials.length ? (
                <div className="stats-table-wrap">
                  <table className="stats-table">
                    <thead><tr><th>情景</th><th>材料</th><th>查看次数</th><th>查看用户</th></tr></thead>
                    <tbody>
                      {materials.map((item) => (
                        <tr key={`${item.scenarioId}:${item.materialId}`}>
                          <td><strong>{item.scenarioTitle ?? item.scenarioId}</strong><small>{item.scenarioId}</small></td>
                          <td><strong>{item.materialTitle ?? item.materialId}</strong><small>{item.materialId}</small></td>
                          <td>{formatCount(item.views)}</td>
                          <td>{formatCount(item.uniqueUsers)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <div className="stats-empty">还没有情景材料查看记录。</div>}
            </section>

            <footer className="stats-footer">
              <span>统计区间自 {summary.rangeStartDate} 起 · 时区 {summary.timezone}</span>
              <span>更新于 {new Date(summary.generatedAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}</span>
            </footer>
          </>
        )}
      </div>
    </main>
  );
}
