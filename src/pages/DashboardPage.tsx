import { useEffect, useState } from "react";
import { statsApi } from "../lib/api";
import type { DashboardStats } from "../types";
import { formatNumber, formatDuration } from "../lib/constants";
import {
  Activity, Radio, Key, Zap, Clock, TrendingUp
} from "lucide-react";

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    statsApi.getDashboard().then(setStats).catch(() => {});
    const interval = setInterval(() => statsApi.getDashboard().then(setStats).catch(() => {}), 10000);
    return () => clearInterval(interval);
  }, []);

  if (!stats) {
    return <div className="p-6 text-muted-foreground">加载中...</div>;
  }

  const cards = [
    { label: "今日请求", value: formatNumber(stats.today_requests), icon: Activity, color: "text-blue-500" },
    { label: "今日 Token", value: formatNumber(stats.today_total_tokens), icon: Zap, color: "text-amber-500" },
    { label: "活跃渠道", value: `${stats.active_channels}/${stats.total_channels}`, icon: Radio, color: "text-green-500" },
    { label: "密钥数量", value: stats.total_api_keys.toString(), icon: Key, color: "text-purple-500" },
    { label: "总请求", value: formatNumber(stats.total_requests), icon: TrendingUp, color: "text-cyan-500" },
    { label: "平均延迟", value: formatDuration(Math.round(stats.avg_latency_ms)), icon: Clock, color: "text-orange-500" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">仪表盘</h1>
        <p className="text-muted-foreground text-sm mt-1">系统概览与实时统计</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">{label}</span>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div className="text-2xl font-bold">{value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold mb-4">总 Token 使用</h2>
        <div className="text-3xl font-bold text-amber-500">
          {formatNumber(stats.total_tokens)}
        </div>
      </div>
    </div>
  );
}
