import type { Metadata } from "next";
import { requireChatGPTUser } from "../chatgpt-auth";
import { StatsDashboard } from "./stats-dashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "数据统计 · PM Atlas",
  description: "PM Atlas 登录、分支、材料与 AI 复盘使用统计。",
};

export default async function StatsPage() {
  const user = await requireChatGPTUser("/stats");
  return <StatsDashboard viewerName={user.displayName} />;
}
