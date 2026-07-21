import { useEffect, useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { getVersion } from "@tauri-apps/api/app";
import { X, Download, Loader2, RefreshCw, CheckCircle2 } from "lucide-react";

type Stage =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "latest" }
  | { kind: "available"; update: Update }
  | { kind: "downloading"; update: Update; percent: number }
  | { kind: "ready" }
  | { kind: "error"; message: string };

export function UpdateChecker({ onClose }: { onClose?: () => void }) {
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [currentVersion, setCurrentVersion] = useState("");

  useEffect(() => {
    getVersion().then(setCurrentVersion).catch(() => {});
  }, []);

  const startCheck = async () => {
    setStage({ kind: "checking" });
    try {
      const update = await check();
      if (update) {
        setStage({ kind: "available", update });
      } else {
        setStage({ kind: "latest" });
      }
    } catch (e: any) {
      setStage({ kind: "error", message: String(e) });
    }
  };

  // 打开即自动检查一次
  useEffect(() => {
    startCheck();
  }, []);

  const handleUpdate = async (update: Update) => {
    let downloaded = 0;
    let total = 0;
    setStage({ kind: "downloading", update, percent: 0 });
    try {
      await update.downloadAndInstall((event) => {
        if (event.event === "Started" && event.data.contentLength) {
          total = event.data.contentLength;
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          if (total > 0) {
            setStage((s) =>
              s.kind === "downloading"
                ? { ...s, percent: Math.min(99, Math.round((downloaded / total) * 100)) }
                : s
            );
          }
        } else if (event.event === "Finished") {
          setStage((s) => (s.kind === "downloading" ? { ...s, percent: 100 } : s));
        }
      });
      setStage({ kind: "ready" });
    } catch (e: any) {
      setStage({ kind: "error", message: String(e) });
    }
  };

  const content = (() => {
    switch (stage.kind) {
      case "checking":
        return (
          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <Loader2 size={16} className="animate-spin" /> 正在检查更新…
          </div>
        );
      case "latest":
        return (
          <div className="flex items-center gap-2 text-sm text-green-500">
            <CheckCircle2 size={16} /> 已是最新版本(v{currentVersion})
          </div>
        );
      case "available":
        return (
          <div className="space-y-3">
            <p className="text-sm">
              发现新版本 <span className="font-semibold text-[var(--accent)]">v{stage.update.version}</span>
              <span className="text-[var(--text-secondary)]">(当前 v{currentVersion})</span>
            </p>
            {stage.update.body && (
              <div className="max-h-32 overflow-y-auto rounded border border-[var(--border)] bg-[var(--bg-secondary)] p-2 text-xs text-[var(--text-secondary)] whitespace-pre-wrap">
                {stage.update.body}
              </div>
            )}
            <button
              onClick={() => handleUpdate(stage.update)}
              className="flex items-center gap-1.5 rounded bg-[var(--accent)] px-3 py-1.5 text-sm text-white hover:opacity-90"
            >
              <Download size={14} /> 立即更新
            </button>
          </div>
        );
      case "downloading":
        return (
          <div className="space-y-2">
            <p className="text-sm text-[var(--text-secondary)]">
              正在下载 v{stage.update.version}…{stage.percent}%
            </p>
            <div className="h-2 w-full overflow-hidden rounded bg-[var(--bg-secondary)]">
              <div
                className="h-full bg-[var(--accent)] transition-all"
                style={{ width: `${stage.percent}%` }}
              />
            </div>
          </div>
        );
      case "ready":
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-green-500">
              <CheckCircle2 size={16} /> 更新已下载完成
            </div>
            <button
              onClick={() => relaunch()}
              className="flex items-center gap-1.5 rounded bg-[var(--accent)] px-3 py-1.5 text-sm text-white hover:opacity-90"
            >
              <RefreshCw size={14} /> 重启应用完成更新
            </button>
          </div>
        );
      case "error":
        return (
          <div className="space-y-3">
            <p className="text-sm text-red-500">检查更新失败:{stage.message}</p>
            <button
              onClick={startCheck}
              className="flex items-center gap-1.5 rounded border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--bg-secondary)]"
            >
              <RefreshCw size={14} /> 重试
            </button>
          </div>
        );
      default:
        return null;
    }
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold">软件更新</h3>
          {onClose && (
            <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              <X size={18} />
            </button>
          )}
        </div>
        {content}
      </div>
    </div>
  );
}
