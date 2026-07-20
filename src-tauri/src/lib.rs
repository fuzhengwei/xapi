// WaLiAPI - 本地 LLM API 网关
// 第1-1节：初始化工程搭建（最小可运行骨架）

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! WaLiAPI 工程已就绪。", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running WaLiAPI");
}
