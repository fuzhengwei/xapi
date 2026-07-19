import { useState, useMemo, useEffect } from "react";
import { channelApi } from "../lib/api";
import type { Channel, CreateChannelInput } from "../types";
import { CHANNEL_TYPES, CHANNEL_CATEGORIES } from "../lib/constants";
import { X, Plus, Check, ArrowRight, ChevronDown } from "lucide-react";

export function ChannelForm({ editing, onClose, onSaved }: {
  editing: Channel | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<CreateChannelInput>({
    name: editing?.name || "",
    type: editing?.type || "openai",
    base_url: editing?.base_url || "https://api.openai.com/v1",
    api_key: "",
    models: editing?.models || ["gpt-4o-mini"],
    priority: editing?.priority ?? 0,
    weight: editing?.weight ?? 1,
    model_mapping: editing?.model_mapping || {},
  });
  const [modelInput, setModelInput] = useState("");
  const [showTypePicker, setShowTypePicker] = useState(false);

  // Model mapping state: array of { from, to } pairs
  const [mappings, setMappings] = useState<{ from: string; to: string }[]>(() => {
    const raw = editing?.model_mapping || {};
    return Object.entries(raw).map(([from, to]) => ({ from, to }));
  });

  // Sync mappings back to form.model_mapping whenever they change
  useEffect(() => {
    const obj: Record<string, string> = {};
    mappings.forEach(m => {
      if (m.from && m.to) obj[m.from] = m.to;
    });
    setForm(prev => ({ ...prev, model_mapping: obj }));
  }, [mappings]);

  const onTypeChange = (type: string) => {
    const info = CHANNEL_TYPES.find(t => t.value === type);
    setForm(prev => ({
      ...prev,
      type,
      base_url: info?.default_base_url || prev.base_url,
      models: info?.models || [],
    }));
    // Clear mappings when type changes since models change
    setMappings([]);
    setShowTypePicker(false);
  };

  // Group channel types by category
  const groupedTypes = useMemo(() => {
    const groups: Record<string, typeof CHANNEL_TYPES> = {};
    for (const t of CHANNEL_TYPES) {
      if (!groups[t.category]) groups[t.category] = [];
      groups[t.category].push(t);
    }
    return groups;
  }, []);

  const selectedType = CHANNEL_TYPES.find(t => t.value === form.type);

  const addModel = () => {
    if (modelInput.trim()) {
      setForm(prev => ({ ...prev, models: [...prev.models, modelInput.trim()] }));
      setModelInput("");
    }
  };

  const removeModel = (m: string) => {
    setForm(prev => ({ ...prev, models: prev.models.filter(x => x !== m) }));
    // Also remove any mapping that uses this model as source
    setMappings(prev => prev.filter(map => map.from !== m));
  };

  // Model mapping helpers
  const addMapping = () => {
    if (form.models.length > 0) {
      setMappings(prev => [...prev, { from: "", to: form.models[0] }]);
    }
  };

  const updateMapping = (idx: number, field: "from" | "to", value: string) => {
    setMappings(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  };

  const removeMapping = (idx: number) => {
    setMappings(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      await channelApi.update({
        id: editing.id,
        name: form.name,
        type: form.type,
        base_url: form.base_url,
        api_key: form.api_key || undefined,
        models: form.models,
        priority: form.priority,
        weight: form.weight,
        model_mapping: form.model_mapping,
      });
    } else {
      await channelApi.create(form);
    }
    onSaved();
  };

  // Available target models for mapping (all channel models, no exclusions — multiple mappings can point to the same target)
  const getAvailableTargets = (_currentIdx: number) => {
    return [...form.models];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="surface w-full max-w-2xl max-h-[92vh] overflow-auto rounded-[28px]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-4 sticky top-0 bg-inherit z-20">
          <h2 className="text-lg font-semibold">{editing ? "编辑渠道" : "新建渠道"}</h2>
          <button onClick={onClose} className="action-secondary px-3 py-2"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5 p-5">
          {/* Name + Type */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">名称</label>
              <input
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm"
                placeholder="渠道名称"
                required
              />
            </div>

            <div className="relative">
              <label className="mb-2 block text-sm font-medium">类型</label>
              <button
                type="button"
                onClick={() => setShowTypePicker(!showTypePicker)}
                className="flex w-full items-center justify-between rounded-2xl border border-border bg-white px-4 py-3 text-sm font-medium transition-all hover:border-primary/40 hover:shadow-sm"
              >
                <span className="flex items-center gap-2.5">
                  <span className="text-lg">{selectedType?.icon || "❓"}</span>
                  <span>{selectedType?.label || "选择类型"}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {CHANNEL_CATEGORIES[selectedType?.category || ""]?.label || ""}
                  </span>
                </span>
                <svg className={`h-4 w-4 text-muted-foreground transition-transform ${showTypePicker ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>

              {showTypePicker && (
                <div className="absolute left-0 right-0 top-full z-30 mt-1.5 max-h-[320px] overflow-auto rounded-2xl border border-border bg-white p-3 shadow-xl">
                  {Object.entries(groupedTypes).map(([catKey, types]) => (
                    <div key={catKey} className="mb-2 last:mb-0">
                      <div className="mb-1.5 flex items-center gap-1.5 px-1 text-xs font-semibold text-muted-foreground">
                        <span>{CHANNEL_CATEGORIES[catKey]?.icon}</span>
                        <span>{CHANNEL_CATEGORIES[catKey]?.label}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {types.map(t => (
                          <button
                            key={t.value}
                            type="button"
                            onClick={() => onTypeChange(t.value)}
                            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-all ${
                              form.type === t.value
                                ? "border-primary/40 bg-primary/8 text-primary font-semibold shadow-sm"
                                : "border-border bg-white text-foreground hover:border-primary/30 hover:bg-muted/50"
                            }`}
                          >
                            <span className="text-base">{t.icon}</span>
                            <span className="truncate">{t.label}</span>
                            {form.type === t.value && <Check size={14} className="ml-auto shrink-0" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Base URL */}
          <div>
            <label className="mb-2 block text-sm font-medium">Base URL</label>
            <input
              value={form.base_url}
              onChange={e => setForm(prev => ({ ...prev, base_url: e.target.value }))}
              className="w-full rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm font-mono"
              placeholder="https://api.example.com/v1"
              required
            />
          </div>

          {/* API Key */}
          <div>
            <label className="mb-2 block text-sm font-medium">API Key</label>
            <input
              type="password"
              value={form.api_key}
              onChange={e => setForm(prev => ({ ...prev, api_key: e.target.value }))}
              className="w-full rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm font-mono"
              placeholder={editing ? "留空则不修改" : "sk-..."}
              required={!editing}
            />
          </div>

          {/* Models list */}
          <div>
            <label className="mb-2 block text-sm font-medium">模型列表</label>
            <div className="mb-3 flex gap-2">
              <input
                value={modelInput}
                onChange={e => setModelInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addModel(); } }}
                className="flex-1 rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm"
                placeholder="输入模型名称，回车添加"
              />
              <button type="button" onClick={addModel} className="action-secondary px-4 py-3">
                <Plus size={16} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {form.models.map(m => (
                <span key={m} className="inline-flex items-center gap-1 rounded-full bg-primary/12 px-3 py-1.5 text-xs text-primary">
                  {m}
                  <button type="button" onClick={() => removeModel(m)} className="hover:text-red-300">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Model Mapping */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium">模型映射</label>
              <span className="text-xs text-muted-foreground">左侧填映射名（客户端请求用），右侧选渠道实际模型</span>
            </div>

            {mappings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-background/40 px-4 py-6 text-center">
                <p className="text-sm text-muted-foreground mb-3">尚未配置模型映射</p>
                <button
                  type="button"
                  onClick={addMapping}
                  disabled={form.models.length === 0}
                  className="action-secondary inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus size={14} /> 添加映射
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {mappings.map((map, idx) => (
                  <MappingRow
                    key={idx}
                    from={map.from}
                    to={map.to}
                    availableTargets={getAvailableTargets(idx)}
                    onRemove={() => removeMapping(idx)}
                    onChange={(field, value) => updateMapping(idx, field, value)}
                  />
                ))}
                <button
                  type="button"
                  onClick={addMapping}
                  disabled={form.models.length === 0}
                  className="action-secondary inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus size={14} /> 添加映射
                </button>
              </div>
            )}
          </div>

          {/* Priority + Weight */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">优先级</label>
              <input
                type="number"
                value={form.priority}
                onChange={e => setForm(prev => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
                className="w-full rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">权重</label>
              <input
                type="number"
                value={form.weight}
                onChange={e => setForm(prev => ({ ...prev, weight: parseInt(e.target.value) || 1 }))}
                className="w-full rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="action-secondary">取消</button>
            <button type="submit" className="action-primary">
              <Check size={16} /> 保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── MappingRow ─────────────────────────────────────────────────────────────

function MappingRow({
  from,
  to,
  availableTargets,
  onRemove,
  onChange,
}: {
  from: string;
  to: string;
  availableTargets: string[];
  onRemove: () => void;
  onChange: (field: "from" | "to", value: string) => void;
}) {
  const [showToPicker, setShowToPicker] = useState(false);

  // Target options: currently selected + available
  const targetOptions = useMemo(() => {
    const opts = [...availableTargets];
    if (to && !opts.includes(to)) opts.unshift(to);
    return opts;
  }, [availableTargets, to]);

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-border bg-background/40 px-3 py-2.5">
      {/* Left: mapping model name (what client requests) — manual input */}
      <div className="relative flex-1 min-w-0">
        <input
          value={from}
          onChange={e => onChange("from", e.target.value)}
          placeholder="映射模型名"
          className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
      </div>

      {/* Arrow */}
      <div className="flex items-center justify-center shrink-0">
        <ArrowRight size={16} className="text-muted-foreground" />
      </div>

      {/* Right: actual channel model — dropdown */}
      <div className="relative flex-1 min-w-0">
        <button
          type="button"
          onClick={() => setShowToPicker(!showToPicker)}
          className="flex w-full items-center justify-between rounded-xl border border-border bg-white px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer"
        >
          <span className={to ? "text-foreground truncate" : "text-muted-foreground"}>
            {to || "选择渠道模型"}
          </span>
          <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
        </button>

        {showToPicker && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowToPicker(false)} />
            <div className="absolute left-0 right-0 top-full z-50 mt-1.5 rounded-2xl border border-border bg-white p-2 shadow-xl max-h-[260px] overflow-auto">
              <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wide">渠道模型</div>
              {targetOptions.map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { onChange("to", m); setShowToPicker(false); }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-mono transition-all ${
                    to === m
                      ? "bg-primary/8 text-primary font-semibold"
                      : "text-foreground hover:bg-muted/60"
                  }`}
                >
                  {m}
                  {to === m && <Check size={14} />}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded-xl p-2 text-muted-foreground/40 hover:text-red-400 hover:bg-red-500/8 transition-colors"
        title="删除此映射"
      >
        <X size={16} />
      </button>
    </div>
  );
}
