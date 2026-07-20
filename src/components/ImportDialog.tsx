import { useState } from "react";
import { importExportApi, type ImportResult, type ScannedSource } from "../lib/api";
import { X, Upload, FileJson, ScanLine, Check, AlertCircle, Loader2, ChevronDown, ChevronRight } from "lucide-react";

type ImportMode = "menu" | "walicode" | "waliapi" | "scan";

export function ImportDialog({ onClose, onImported }: {
  onClose: () => void;
  onImported: () => void;
}) {
  const [mode, setMode] = useState<ImportMode>("menu");
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scannedSources, setScannedSources] = useState<ScannedSource[]>([]);
  const [selectedSources, setSelectedSources] = useState<Set<number>>(new Set());

  // ─── Walicode import ───────────────────────────────────────
  const handleWalicodeImport = async () => {
    setLoading(true);
    setError(null);
    try {
      const content = await importExportApi.pickImportFile();
      if (!content) {
        setLoading(false);
        return;
      }
      const res = await importExportApi.importWalicodeBackup(content);
      setResult(res);
      if (res.imported > 0) {
        onImported();
      }
    } catch (e: any) {
      setError(String(e));
    }
    setLoading(false);
  };

  // ─── Waliapi import ────────────────────────────────────────
  const handleWaliapiImport = async () => {
    setLoading(true);
    setError(null);
    try {
      const content = await importExportApi.pickImportFile();
      if (!content) {
        setLoading(false);
        return;
      }
      const res = await importExportApi.importWaliapiExport(content);
      setResult(res);
      if (res.imported > 0) {
        onImported();
      }
    } catch (e: any) {
      setError(String(e));
    }
    setLoading(false);
  };

  // ─── Scan local configs ────────────────────────────────────
  const handleScan = async () => {
    setScanning(true);
    setError(null);
    try {
      const res = await importExportApi.scanLocalAiConfigs();
      setScannedSources(res.sources);
      setSelectedSources(new Set(res.sources.map((_, i) => i)));
    } catch (e: any) {
      setError(String(e));
    }
    setScanning(false);
  };

  // ─── Import selected scanned sources ───────────────────────
  const handleImportScanned = async () => {
    setLoading(true);
    setError(null);
    try {
      const selected = scannedSources.filter((_, i) => selectedSources.has(i));
      if (selected.length === 0) {
        setError("请至少选择一个要导入的配置");
        setLoading(false);
        return;
      }
      const res = await importExportApi.importScannedSources(selected);
      setResult(res);
      if (res.imported > 0) {
        onImported();
      }
    } catch (e: any) {
      setError(String(e));
    }
    setLoading(false);
  };

  // ─── Export channels (moved to ChannelsPage) ──────────────
  // Export is now handled directly in ChannelsPage

  const toggleSource = (idx: number) => {
    setSelectedSources(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const SOURCE_ICONS: Record<string, string> = {
    "claude-code": "🤖",
    "codex": "📦",
    "cursor": "🖱️",
    "openai-cli": "🟢",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="surface w-full max-w-2xl max-h-[92vh] overflow-auto rounded-[28px]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 sticky top-0 bg-inherit z-20">
          <h2 className="text-lg font-semibold">
            {mode === "menu" && "导入渠道"}
            {mode === "walicode" && "导入 WaLiCode 备份"}
            {mode === "waliapi" && "导入 WaLiAPI 导出文件"}
            {mode === "scan" && "扫描本地 AI 配置"}
          </h2>
          <button onClick={onClose} className="action-secondary px-3 py-2"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Error */}
          {error && (
            <div className="rounded-2xl border border-red-500/40 bg-red-50 px-4 py-3 text-sm text-red-600 flex items-start gap-2 dark:bg-red-500/10 dark:text-red-400">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 flex items-start gap-2 dark:bg-emerald-500/10 dark:text-emerald-300">
              <Check size={16} className="shrink-0 mt-0.5" />
              <div>
                {result.imported === -1 ? (
                  <span>导出成功！文件已保存。</span>
                ) : (
                  <>
                    <div>导入完成：成功 {result.imported} 个，跳过 {result.skipped} 个</div>
                    {result.errors.length > 0 && (
                      <div className="mt-1 text-xs text-amber-600 dark:text-amber-300">
                        {result.errors.length} 个错误：{result.errors.join("; ")}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Menu mode */}
          {mode === "menu" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">选择导入来源</p>

              <ImportOption
                icon={<Upload size={20} />}
                title="导入 WaLiAPI 导出文件"
                description="从其他 WaLiAPI 实例导出的 JSON 文件导入渠道"
                onClick={() => { setMode("waliapi"); setResult(null); setError(null); }}
              />

              <ImportOption
                icon={<ScanLine size={20} />}
                title="扫描本地 AI 配置"
                description="自动扫描 Claude Code、Codex、Cursor 等本地配置并导入"
                onClick={() => { setMode("scan"); setResult(null); setError(null); handleScan(); }}
              />

              <ImportOption
                icon={<FileJson size={20} />}
                title="导入 WaLiCode 备份"
                description="从 walicode-full-backup.json 导入所有 AI 供应商配置"
                onClick={() => { setMode("walicode"); setResult(null); setError(null); }}
              />
            </div>
          )}

          {/* Walicode mode */}
          {mode === "walicode" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-background/40 px-4 py-4 text-sm">
                <p className="mb-2 font-medium">WaLiCode 备份导入说明</p>
                <ul className="space-y-1 text-muted-foreground text-xs">
                  <li>• 支持 walicode-full-backup.json 格式</li>
                  <li>• 将导入 aiSettings 中的主供应商和所有自定义供应商</li>
                  <li>• 已存在的同名渠道将被跳过</li>
                  <li>• API Key 为空的远程渠道将被跳过</li>
                </ul>
              </div>
              <button
                onClick={handleWalicodeImport}
                disabled={loading}
                className="action-primary w-full justify-center"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                选择文件并导入
              </button>
              <button onClick={() => setMode("menu")} className="action-secondary w-full justify-center">
                返回
              </button>
            </div>
          )}

          {/* Waliapi mode */}
          {mode === "waliapi" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-background/40 px-4 py-4 text-sm">
                <p className="mb-2 font-medium">WaLiAPI 导出文件导入说明</p>
                <ul className="space-y-1 text-muted-foreground text-xs">
                  <li>• 支持其他 WaLiAPI 实例导出的 JSON 文件</li>
                  <li>• 包含渠道类型、模型列表、API Key 等完整信息</li>
                  <li>• 已存在的同名渠道将被跳过</li>
                </ul>
              </div>
              <button
                onClick={handleWaliapiImport}
                disabled={loading}
                className="action-primary w-full justify-center"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                选择文件并导入
              </button>
              <button onClick={() => setMode("menu")} className="action-secondary w-full justify-center">
                返回
              </button>
            </div>
          )}

          {/* Scan mode */}
          {mode === "scan" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-background/40 px-4 py-4 text-sm">
                <p className="mb-2 font-medium">扫描本地 AI 配置</p>
                <p className="text-muted-foreground text-xs">
                  自动扫描以下位置的配置文件：
                </p>
                <ul className="mt-1.5 space-y-0.5 text-muted-foreground text-xs">
                  <li>• Claude Code: ~/.claude/settings.json</li>
                  <li>• Codex CLI: ~/.codex/config.toml 或 config.json</li>
                  <li>• Cursor: ~/Library/.../Cursor/User/settings.json</li>
                  <li>• OpenAI CLI: ~/.openai/config.json</li>
                </ul>
              </div>

              {scanning ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">正在扫描...</span>
                </div>
              ) : scannedSources.length > 0 ? (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-sm font-medium">发现 {scannedSources.length} 个配置</span>
                      <button
                        onClick={() => {
                          if (selectedSources.size === scannedSources.length) {
                            setSelectedSources(new Set());
                          } else {
                            setSelectedSources(new Set(scannedSources.map((_, i) => i)));
                          }
                        }}
                        className="text-xs text-primary hover:underline"
                      >
                        {selectedSources.size === scannedSources.length ? "取消全选" : "全选"}
                      </button>
                    </div>
                    {scannedSources.map((src, idx) => (
                      <ScannedSourceCard
                        key={idx}
                        source={src}
                        selected={selectedSources.has(idx)}
                        onToggle={() => toggleSource(idx)}
                        icon={SOURCE_ICONS[src.source] || "🔌"}
                      />
                    ))}
                  </div>
                  <button
                    onClick={handleImportScanned}
                    disabled={loading || selectedSources.size === 0}
                    className="action-primary w-full justify-center"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    导入选中的 {selectedSources.size} 个配置
                  </button>
                </>
              ) : !scanning && scannedSources.length === 0 && !result ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  未发现任何本地 AI 配置文件
                </div>
              ) : null}

              <button
                onClick={() => { setMode("menu"); setScannedSources([]); setResult(null); }}
                className="action-secondary w-full justify-center"
              >
                返回
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ImportOption({ icon, title, description, onClick, loading }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex w-full items-start gap-3 rounded-2xl border border-border bg-background/40 px-4 py-4 text-left transition-all hover:border-primary/30 hover:bg-primary/5 disabled:opacity-50"
    >
      <div className="shrink-0 rounded-xl bg-primary/10 p-2.5 text-primary">
        {loading ? <Loader2 size={20} className="animate-spin" /> : icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium">{title}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>
      </div>
      <ChevronRight size={18} className="shrink-0 text-muted-foreground" />
    </button>
  );
}

function ScannedSourceCard({ source, selected, onToggle, icon }: {
  source: ScannedSource;
  selected: boolean;
  onToggle: () => void;
  icon: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`rounded-2xl border transition-all ${selected ? "border-primary/40 bg-primary/5" : "border-border bg-background/40"}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={onToggle}
          className={`shrink-0 rounded-lg border-2 transition-all ${
            selected
              ? "border-primary bg-primary text-white"
              : "border-muted-foreground/30 hover:border-primary/50"
          } w-5 h-5 flex items-center justify-center`}
        >
          {selected && <Check size={12} />}
        </button>
        <span className="text-lg">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm">{source.name}</div>
          <div className="text-xs text-muted-foreground font-mono truncate">{source.base_url}</div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted/50"
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>
      {expanded && (
        <div className="border-t border-border px-4 py-3 text-xs space-y-1.5">
          <div className="flex gap-2">
            <span className="text-muted-foreground shrink-0">来源:</span>
            <span className="font-mono">{source.source}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground shrink-0">API Key:</span>
            <span className="font-mono">{source.api_key.slice(0, 8)}...{source.api_key.slice(-4)}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground shrink-0">模型:</span>
            <span className="font-mono">{source.models.join(", ") || "(无)"}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground shrink-0">格式:</span>
            <span className="font-mono">{source.api_format}</span>
          </div>
        </div>
      )}
    </div>
  );
}
