import { useEffect, useState } from "react";
import { channelApi } from "../lib/api";
import type { Channel } from "../types";
import { CHANNEL_TYPES, formatTime } from "../lib/constants";
import { Plus, Radio, Trash2, Play, Power, Edit } from "lucide-react";
import { ChannelForm } from "../components/ChannelForm";

export function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Channel | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { success: boolean; message: string; latency_ms: number }>>({});

  const load = () => channelApi.getAll().then(setChannels).catch(() => {});

  useEffect(() => { load(); }, []);

  const handleTest = async (id: string) => {
    setTesting(id);
    try {
      const result = await channelApi.test(id);
      setTestResult(prev => ({ ...prev, [id]: result }));
    } catch (e: any) {
      setTestResult(prev => ({ ...prev, [id]: { success: false, message: String(e), latency_ms: 0 } }));
    }
    setTesting(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确认删除此渠道？")) return;
    await channelApi.delete(id);
    load();
  };

  const handleToggle = async (ch: Channel) => {
    await channelApi.update({ id: ch.id, status: ch.status === 1 ? 0 : 1 });
    load();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">渠道管理</h1>
          <p className="text-muted-foreground text-sm mt-1">配置上游 API 供应商渠道</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm hover:opacity-90"
        >
          <Plus size={16} /> 新建渠道
        </button>
      </div>

      {channels.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Radio className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>还没有配置任何渠道</p>
          <p className="text-sm mt-1">点击右上角新建渠道开始</p>
        </div>
      ) : (
        <div className="space-y-3">
          {channels.map(ch => {
            const typeInfo = CHANNEL_TYPES.find(t => t.value === ch.type);
            const result = testResult[ch.id];
            return (
              <div key={ch.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-2 h-2 rounded-full ${ch.status === 1 ? "bg-green-500" : "bg-gray-400"}`} />
                      <h3 className="font-semibold">{ch.name}</h3>
                      <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        {typeInfo?.label || ch.type}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-0.5">
                      <div className="font-mono text-xs truncate">{ch.base_url}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {ch.models.slice(0, 5).map(m => (
                          <span key={m} className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">{m}</span>
                        ))}
                        {ch.models.length > 5 && <span className="text-xs text-muted-foreground">+{ch.models.length - 5}</span>}
                      </div>
                      {ch.last_test_at && (
                        <div className="text-xs mt-1">
                          最近测试: {formatTime(ch.last_test_at)}
                          {ch.last_test_ok !== null && (
                            <span className={ch.last_test_ok ? " text-green-500 ml-1" : " text-red-500 ml-1"}>
                              {ch.last_test_ok ? "✓ 成功" : "✗ 失败"}
                            </span>
                          )}
                        </div>
                      )}
                      {result && (
                        <div className={`text-xs mt-1 ${result.success ? "text-green-500" : "text-red-500"}`}>
                          {result.success ? "✓" : "✗"} {result.message} ({result.latency_ms}ms)
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-4">
                    <button onClick={() => handleTest(ch.id)} disabled={testing === ch.id} className="p-2 rounded-lg hover:bg-muted text-blue-500" title="测试">
                      <Play size={16} />
                    </button>
                    <button onClick={() => { setEditing(ch); setShowForm(true); }} className="p-2 rounded-lg hover:bg-muted" title="编辑">
                      <Edit size={16} />
                    </button>
                    <button onClick={() => handleToggle(ch)} className="p-2 rounded-lg hover:bg-muted" title={ch.status === 1 ? "禁用" : "启用"}>
                      <Power size={16} className={ch.status === 1 ? "text-green-500" : "text-gray-400"} />
                    </button>
                    <button onClick={() => handleDelete(ch.id)} className="p-2 rounded-lg hover:bg-muted text-red-500" title="删除">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <ChannelForm
          editing={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}
