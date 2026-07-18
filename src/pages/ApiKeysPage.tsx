import { useEffect, useState } from "react";
import { apiKeyApi } from "../lib/api";
import type { ApiKey, CreateApiKeyInput } from "../types";
import { formatTime } from "../lib/constants";
import { Plus, Key, Trash2, Power, X, Check, Copy } from "lucide-react";

export function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = () => apiKeyApi.getAll().then(setKeys).catch(() => {});

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("确认删除此密钥？")) return;
    await apiKeyApi.delete(id);
    load();
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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">密钥管理</h1>
          <p className="text-muted-foreground text-sm mt-1">管理用于访问 API 的密钥</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm hover:opacity-90"
        >
          <Plus size={16} /> 新建密钥
        </button>
      </div>

      {keys.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Key className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>还没有创建任何密钥</p>
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map(k => (
            <div key={k.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full ${k.status === 1 ? "bg-green-500" : "bg-gray-400"}`} />
                    <h3 className="font-semibold">{k.name}</h3>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-xs font-mono px-2 py-1 rounded bg-muted">{k.key}</code>
                    <button onClick={() => copyKey(k.key)} className="p-1 hover:bg-muted rounded text-muted-foreground" title="复制">
                      {copied === k.key ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                    </button>
                  </div>
                  <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
                    {k.allowed_models.length > 0 && (
                      <div>允许模型: {k.allowed_models.join(", ")}</div>
                    )}
                    {k.quota_limit > 0 && (
                      <div>配额: {k.quota_used} / {k.quota_limit}</div>
                    )}
                    {k.expires_at && <div>过期: {formatTime(k.expires_at)}</div>}
                    <div>创建: {formatTime(k.created_at)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-4">
                  <button onClick={() => handleToggle(k)} className="p-2 rounded-lg hover:bg-muted" title={k.status === 1 ? "禁用" : "启用"}>
                    <Power size={16} className={k.status === 1 ? "text-green-500" : "text-gray-400"} />
                  </button>
                  <button onClick={() => handleDelete(k.id)} className="p-2 rounded-lg hover:bg-muted text-red-500" title="删除">
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card rounded-xl border border-border w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-bold">新建密钥</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1">名称</label>
            <input
              value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              placeholder="密钥名称"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">配额限制 (-1 为无限)</label>
            <input
              type="number"
              value={form.quota_limit ?? -1}
              onChange={e => setForm(prev => ({ ...prev, quota_limit: parseInt(e.target.value) || -1 }))}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted">取消</button>
            <button type="submit" className="flex items-center gap-1 px-4 py-2 rounded-lg bg-primary text-white text-sm hover:opacity-90">
              <Check size={16} /> 创建
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
