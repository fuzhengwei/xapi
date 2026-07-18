import { useEffect, useState } from "react";
import { logApi } from "../lib/api";
import type { RequestLog } from "../types";
import { formatTime, formatDuration, formatNumber } from "../lib/constants";
import { ScrollText, RefreshCw } from "lucide-react";

export function LogsPage() {
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const load = (p: number = 0) => {
    setLoading(true);
    logApi.getAll(pageSize, p * pageSize)
      .then(setLogs)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(0); }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">请求日志</h1>
          <p className="text-muted-foreground text-sm mt-1">查看 API 请求记录</p>
        </div>
        <button
          onClick={() => load(page)}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> 刷新
        </button>
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <ScrollText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>暂无请求日志</p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">时间</th>
                  <th className="text-left px-3 py-2 font-medium">密钥</th>
                  <th className="text-left px-3 py-2 font-medium">渠道</th>
                  <th className="text-left px-3 py-2 font-medium">模型</th>
                  <th className="text-left px-3 py-2 font-medium">状态</th>
                  <th className="text-right px-3 py-2 font-medium">Token</th>
                  <th className="text-right px-3 py-2 font-medium">耗时</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-3 py-2 text-xs text-muted-foreground">{formatTime(log.created_at)}</td>
                    <td className="px-3 py-2 text-xs">{log.api_key_name || "-"}</td>
                    <td className="px-3 py-2 text-xs">{log.channel_name || "-"}</td>
                    <td className="px-3 py-2 text-xs font-mono">{log.model}</td>
                    <td className="px-3 py-2 text-xs">
                      <span className={`px-1.5 py-0.5 rounded ${log.status_code === 200 ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
                        {log.status_code}
                      </span>
                      {log.is_stream && <span className="ml-1 text-xs text-blue-500">stream</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-xs">{formatNumber(log.total_tokens)}</td>
                    <td className="px-3 py-2 text-right text-xs text-muted-foreground">{formatDuration(log.duration_ms)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => { const p = Math.max(0, page - 1); setPage(p); load(p); }}
              disabled={page === 0 || loading}
              className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted disabled:opacity-50"
            >
              上一页
            </button>
            <span className="text-sm text-muted-foreground">第 {page + 1} 页</span>
            <button
              onClick={() => { const p = page + 1; setPage(p); load(p); }}
              disabled={logs.length < pageSize || loading}
              className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted disabled:opacity-50"
            >
              下一页
            </button>
          </div>
        </>
      )}
    </div>
  );
}
