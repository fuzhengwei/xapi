import { useEffect, useState } from "react";
import { apiKeyApi } from "../lib/api";
import type { ApiKey, CreateApiKeyInput, ApiKeyStats } from "../types";
import { formatTime } from "../lib/constants";
import { Plus, Key, Trash2, Power, X, Check, Copy, CalendarClock, Database, Activity, Clock, Zap } from "lucide-react";

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function SuccessRateRing({ rate }: { rate: number }) {
  const r = 28;
  const c = 2 * Math.PI * r;
  const offset = c - (rate / 100) * c;
  const color = rate >= 95 ? "#10b981" : rate >= 80 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative flex h-16 w-16 items-center justify-center">
      <svg className="h-16 w-16 -rotate-90" viewBox="0 0 70 70">
        <circle cx="35" cy="35" r={r} fill="none" stroke="currentColor" strokeWidth="5" className="text-slate-200/60" />
        <circle
          cx="35" cy="35" r={r} fill="none" stroke={color} strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-sm font-bold tabular-nums" style={{ color }}>{rate.toFixed(0)}%</span>
      </div>
    </div>
  );
}

function LatencyBar({ latencyMs }: { latencyMs: number }) {
  // 0-500ms = green, 500-2000ms = amber, 2000ms+ = red
  const pct = Math.min(latencyMs / 3000, 1) * 100;
  const color = latencyMs === 0 ? "#94a3b8" : latencyMs < 500 ? "#10b981" : latencyMs < 2000 ? "#f59e0b" : "#ef4444";
  const label = latencyMs > 0 ? `${Math.round(latencyMs)}ms` : "—";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200/60">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color, transition: "width 0.6s ease" }}
        />
      </div>
      <span className="text-sm font-semibold tabular-nums" style={{ color: latencyMs === 0 ? "#94a3b8" : color }}>{label}</span>
    </div>
  );
}

export function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [stats, setStats] = useState<Record<string, ApiKeyStats>>({});
  const [showForm, setShowForm] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiKey | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    const [ks, st] = await Promise.all([
      apiKeyApi.getAll().catch(() => []),
      apiKeyApi.getStats().catch(() => []),
    ]);
    setKeys(ks);
    setStats(Object.fromEntries(st.map(s => [s.api_key_id, s])));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiKeyApi.delete(deleteTarget.id);
      setDeleteTarget(null);
      load();
    } catch (e) {
      alert(`删除失败: ${e}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleToggle = async (k: ApiKey) => {
    await apiKeyApi.update(k.id, k.status === 1 ? 0 : 1);
    load();
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="page-shell space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">密钥管理</h1>
          <p className="page-subtitle">为下游应用生成访问凭证，并跟踪配额与有效期</p>
        </div>
        <button onClick={() => setShowForm(true)} className="action-primary">
          <Plus size={16} /> 新建密钥
        </button>
      </div>

      {keys.length === 0 ? (
        <div className="surface empty-state">
          <Key className="h-12 w-12 text-muted-foreground/70" />
          <p className="text-base font-medium">还没有创建任何密钥</p>
          <p className="text-sm text-muted-foreground">创建后即可让客户端通过 OpenAI 兼容协议接入 WaLiAPI</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {keys.map(k => (
            <div key={k.id} className="surface rounded-[24px] p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-3 flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${k.status === 1 ? "bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.8)]" : "bg-zinc-500"}`} />
                    <h3 className="text-lg font-semibold tracking-tight">{k.name}</h3>
                  </div>

                  <div className="flex items-center gap-2 rounded-2xl border border-white/8 bg-black/16 px-3 py-3">
                    <code className="min-w-0 flex-1 truncate text-xs font-mono text-foreground/90">{k.key}</code>
                    <button onClick={() => copyKey(k.key)} className="action-secondary px-3 py-2" title="复制">
                      {copied === k.key ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
                    </button>
                  </div>

                  {/* 元信息行 — 紧凑标签式 */}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${k.status === 1 ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${k.status === 1 ? "bg-emerald-500" : "bg-zinc-400"}`} />
                      {k.status === 1 ? "已启用" : "已禁用"}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                      <Database size={11} />
                      {k.quota_limit > 0 ? `${k.quota_used} / ${k.quota_limit}` : "无限制"}
                    </span>
                    {k.expires_at && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-700">
                        <CalendarClock size={11} />
                        {formatTime(k.expires_at)}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-400">
                      {formatTime(k.created_at)}
                    </span>
                  </div>

                  {/* 使用量统计 — 仪表盘风格 */}
                  {stats[k.id] && (() => {
                    const s = stats[k.id];
                    const successRate = s.total_calls > 0 ? (s.success_calls / s.total_calls * 100) : 0;
                    return (
                      <div className="mt-4 rounded-2xl border border-slate-200/60 bg-gradient-to-br from-slate-50/80 to-white p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                            <Activity size={12} /> 使用统计
                          </span>
                          {s.last_call_at && (
                            <span className="text-[11px] text-slate-400">最后调用 {formatTime(s.last_call_at)}</span>
                          )}
                        </div>

                        {/* 主指标行：成功率环 + 三列数据 */}
                        <div className="flex items-center gap-4">
                          {/* 成功率环 */}
                          <div className="flex flex-col items-center gap-1">
                            <SuccessRateRing rate={successRate} />
                            <span className="text-[10px] font-medium text-slate-400">成功率</span>
                          </div>

                          {/* 分隔线 */}
                          <div className="h-14 w-px bg-slate-200/70" />

                          {/* 三列数据 */}
                          <div className="flex-1 grid grid-cols-3 gap-2.5">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                                <Activity size={11} /> 调用
                              </div>
                              <div className="text-lg font-bold tabular-nums text-slate-800">
                                {formatNumber(s.total_calls)}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                成功 {formatNumber(s.success_calls)} / 失败 {formatNumber(s.failed_calls)}
                              </div>
                            </div>

                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                                <Zap size={11} /> Token
                              </div>
                              <div className="text-lg font-bold tabular-nums text-slate-800">
                                {formatNumber(s.total_tokens)}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                ↑{formatNumber(s.prompt_tokens)} ↓{formatNumber(s.completion_tokens)}
                              </div>
                            </div>

                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                                <Clock size={11} /> 延迟
                              </div>
                              <div className="mt-1">
                                <LatencyBar latencyMs={s.avg_latency_ms} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {k.allowed_models.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {k.allowed_models.map(model => (
                        <span key={model} className="rounded-full bg-primary/12 px-2.5 py-1 text-xs text-primary">{model}</span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <button onClick={() => handleToggle(k)} className="action-secondary px-3 py-2" title={k.status === 1 ? "禁用" : "启用"}>
                    <Power size={16} className={k.status === 1 ? "text-emerald-300" : "text-zinc-400"} />
                  </button>
                  <button onClick={() => setDeleteTarget(k)} className="action-secondary px-3 py-2 text-red-300" title="删除">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <ApiKeyForm
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}

      <DeleteConfirmDialog
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        deleting={deleting}
      />
    </div>
  );
}

function ApiKeyForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<CreateApiKeyInput>({
    name: "",
    quota_limit: -1,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiKeyApi.create(form);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="surface w-full max-w-md rounded-[28px]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold">新建密钥</h2>
          <button onClick={onClose} className="action-secondary px-3 py-2"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div>
            <label className="mb-2 block text-sm font-medium">名称</label>
            <input
              value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              className="w-full rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm"
              placeholder="密钥名称"
              required
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">配额限制 (-1 为无限)</label>
            <input
              type="number"
              value={form.quota_limit ?? -1}
              onChange={e => setForm(prev => ({ ...prev, quota_limit: parseInt(e.target.value) || -1 }))}
              className="w-full rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="action-secondary">取消</button>
            <button type="submit" className="action-primary">
              <Check size={16} /> 创建
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirmDialog({
  target,
  onClose,
  onConfirm,
  deleting,
}: {
  target: ApiKey | null;
  onClose: () => void;
  onConfirm: () => void;
  deleting: boolean;
}) {
  if (!target) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="surface w-full max-w-sm rounded-[28px] p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-2.5">
            <Trash2 className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h3 className="text-base font-semibold">删除密钥</h3>
            <p className="text-sm text-muted-foreground">此操作不可撤销</p>
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-border bg-background/50 px-4 py-3 text-sm">
          <div className="text-muted-foreground">密钥名称</div>
          <div className="mt-1 font-medium">{target.name}</div>
          <div className="mt-2 text-xs font-mono text-muted-foreground truncate">{target.key}</div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="action-secondary">取消</button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="inline-flex items-center gap-2 rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? "删除中..." : "确认删除"}
          </button>
        </div>
      </div>
    </div>
  );
}
