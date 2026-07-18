import { useEffect, useState } from "react";
import { settingsApi, serverApi } from "../lib/api";
import type { Settings } from "../types";
import { Save, RotateCcw, Check } from "lucide-react";

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    settingsApi.get().then(setSettings).catch(() => {});
  }, []);

  if (!settings) return <div className="p-6 text-muted-foreground">加载中...</div>;

  const handleSave = async () => {
    await settingsApi.save(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleRestart = async () => {
    await serverApi.restart();
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">设置</h1>
        <p className="text-muted-foreground text-sm mt-1">应用与服务配置</p>
      </div>

      {/* Server Settings */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="font-semibold">服务配置</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium block mb-1">监听地址</label>
            <input
              value={settings.server_host}
              onChange={e => setSettings({ ...settings, server_host: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">端口 (0=随机)</label>
            <input
              type="number"
              value={settings.server_port}
              onChange={e => setSettings({ ...settings, server_port: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </div>
        </div>
        <button
          onClick={handleRestart}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted"
        >
          <RotateCcw size={16} /> 重启服务
        </button>
      </div>

      {/* General Settings */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="font-semibold">通用</h2>
        <div className="space-y-3">
          <label className="flex items-center justify-between">
            <span className="text-sm">最小化到托盘</span>
            <input
              type="checkbox"
              checked={settings.minimize_to_tray}
              onChange={e => setSettings({ ...settings, minimize_to_tray: e.target.checked })}
              className="w-5 h-5"
            />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-sm">关闭到托盘</span>
            <input
              type="checkbox"
              checked={settings.close_to_tray}
              onChange={e => setSettings({ ...settings, close_to_tray: e.target.checked })}
              className="w-5 h-5"
            />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-sm">开机自启</span>
            <input
              type="checkbox"
              checked={settings.auto_start}
              onChange={e => setSettings({ ...settings, auto_start: e.target.checked })}
              className="w-5 h-5"
            />
          </label>
        </div>
      </div>

      {/* UI Settings */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="font-semibold">界面</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium block mb-1">主题</label>
            <select
              value={settings.ui_theme}
              onChange={e => setSettings({ ...settings, ui_theme: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            >
              <option value="dark">深色</option>
              <option value="light">浅色</option>
              <option value="system">跟随系统</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">语言</label>
            <select
              value={settings.ui_language}
              onChange={e => setSettings({ ...settings, ui_language: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            >
              <option value="zh-CN">简体中文</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
      </div>

      {/* Retry Settings */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="font-semibold">重试</h2>
        <label className="flex items-center justify-between mb-2">
          <span className="text-sm">启用自动重试</span>
          <input
            type="checkbox"
            checked={settings.retry_enabled}
            onChange={e => setSettings({ ...settings, retry_enabled: e.target.checked })}
            className="w-5 h-5"
          />
        </label>
        {settings.retry_enabled && (
          <div>
            <label className="text-sm font-medium block mb-1">重试次数</label>
            <input
              type="number"
              value={settings.retry_times}
              onChange={e => setSettings({ ...settings, retry_times: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-6 py-2 rounded-lg bg-primary text-white text-sm hover:opacity-90"
        >
          {saved ? <Check size={16} /> : <Save size={16} />}
          {saved ? "已保存" : "保存设置"}
        </button>
      </div>
    </div>
  );
}
