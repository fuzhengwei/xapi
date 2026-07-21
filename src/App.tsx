import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { check } from "@tauri-apps/plugin-updater";
import { Layout } from "./components/layout/Layout";
import { UpdateChecker } from "./components/UpdateChecker";
import { DashboardPage } from "./pages/DashboardPage";
import { ChannelsPage } from "./pages/ChannelsPage";
import { ApiKeysPage } from "./pages/ApiKeysPage";
import { LogsPage } from "./pages/LogsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { UsagePage } from "./pages/UsagePage";
import { settingsApi } from "./lib/api";

function App() {
  const [showUpdater, setShowUpdater] = useState(false);

  useEffect(() => {
    settingsApi.get().then((settings) => {
      document.documentElement.setAttribute("data-theme", settings.ui_theme || "dark");
      document.documentElement.lang = settings.ui_language || "zh-CN";
    }).catch(() => {});

    // 启动 5 秒后静默检查更新,发现新版本自动弹出更新窗口
    const timer = setTimeout(() => {
      check()
        .then((update) => {
          if (update) setShowUpdater(true);
        })
        .catch(() => {
          // 检查失败(网络问题/无 release)时静默忽略,不影响使用
        });
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/usage" element={<UsagePage />} />
          <Route path="/channels" element={<ChannelsPage />} />
          <Route path="/api-keys" element={<ApiKeysPage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Layout>
      {showUpdater && <UpdateChecker onClose={() => setShowUpdater(false)} />}
    </BrowserRouter>
  );
}

export default App;
