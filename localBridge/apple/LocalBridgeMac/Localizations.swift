import Foundation

/// 翻译字典 - 存储所有UI文本的中英文翻译
struct Localizations {

    /// 翻译映射表: [key: [language: translation]]
    static let translations: [String: [String: String]] = [

        // MARK: - Sidebar
        "sidebar.tweetclaw.title": [
            "en": "TweetClaw",
            "zh": "TweetClaw"
        ],
        "sidebar.tweetclaw.subtitle": [
            "en": "WebSocket Extension",
            "zh": "WebSocket 扩展"
        ],
        "sidebar.tweetclaw.preview": [
            "en": "Connected to Chrome Extension. Ready for commands.",
            "zh": "已连接到 Chrome 扩展。准备接收命令。"
        ],
        "sidebar.aiclaw.title": [
            "en": "AIClaw",
            "zh": "AIClaw"
        ],
        "sidebar.aiclaw.subtitle": [
            "en": "AI Platform Hub",
            "zh": "AI 平台中心"
        ],
        "sidebar.aiclaw.preview": [
            "en": "Monitor ChatGPT, Gemini, Grok tabs and status.",
            "zh": "监控 ChatGPT、Gemini、Grok 标签页和状态。"
        ],
        "sidebar.logs.title": [
            "en": "Bridge Logs",
            "zh": "桥接日志"
        ],
        "sidebar.logs.subtitle": [
            "en": "System",
            "zh": "系统"
        ],
        "sidebar.logs.preview": [
            "en": "Waiting for local service connection...",
            "zh": "等待本地服务连接..."
        ],
        "sidebar.instances.title": [
            "en": "Connected Instances",
            "zh": "已连接实例"
        ],
        "sidebar.instances.subtitle": [
            "en": "Multi-Profile",
            "zh": "多账号"
        ],
        "sidebar.instances.preview": [
            "en": "View all online browser extension instances",
            "zh": "查看所有在线的浏览器扩展实例"
        ],

        // MARK: - AppDelegate
        "app.quit": [
            "en": "Quit LocalBridge",
            "zh": "退出 LocalBridge"
        ],
        "app.open": [
            "en": "Open LocalBridge",
            "zh": "打开 LocalBridge"
        ],

        // MARK: - DetailViewController
        "detail.placeholder": [
            "en": "Select an item from the sidebar to view content",
            "zh": "选择左侧列表项查看内容"
        ],
        "detail.for_human": [
            "en": "For Human",
            "zh": "人类视图"
        ],
        "detail.for_claw": [
            "en": "For Claw",
            "zh": "Claw 视图"
        ],

        // MARK: - APIDocViewController
        "api.title": [
            "en": "API Endpoints",
            "zh": "API 端点"
        ],
        "api.x_title": [
            "en": "X (Twitter) API",
            "zh": "X (Twitter) API"
        ],
        "api.ai_title": [
            "en": "AI Platform API",
            "zh": "AI 平台 API"
        ],

        // MARK: - Settings
        "settings.title": [
            "en": "Settings",
            "zh": "设置"
        ],
        "settings.language": [
            "en": "Language",
            "zh": "语言"
        ],
        "settings.language.description": [
            "en": "Choose your preferred language",
            "zh": "选择您的首选语言"
        ],
        "settings.theme": [
            "en": "Theme",
            "zh": "主题"
        ],
        "settings.theme.description": [
            "en": "Choose your preferred theme",
            "zh": "选择您的首选主题"
        ],
        "settings.theme.dark": [
            "en": "Dark",
            "zh": "深色"
        ],
        "settings.theme.light": [
            "en": "Light",
            "zh": "浅色"
        ],
        "settings.theme.auto": [
            "en": "Auto",
            "zh": "自动"
        ],
        "settings.rest_api": [
            "en": "REST API",
            "zh": "REST API"
        ],
        "settings.rest_api.description": [
            "en": "Configure REST API server settings",
            "zh": "配置 REST API 服务器设置"
        ],
        "settings.rest_api.port": [
            "en": "Port",
            "zh": "端口"
        ],
        "settings.rest_api.enable": [
            "en": "Enable REST API Server",
            "zh": "启用 REST API 服务器"
        ],
        "settings.websocket": [
            "en": "WebSocket",
            "zh": "WebSocket"
        ],
        "settings.websocket.description": [
            "en": "Configure WebSocket server settings",
            "zh": "配置 WebSocket 服务器设置"
        ],
        "settings.websocket.port": [
            "en": "Port",
            "zh": "端口"
        ],
        "settings.save": [
            "en": "Save",
            "zh": "保存"
        ],
        "settings.saved": [
            "en": "Settings Saved",
            "zh": "设置已保存"
        ],
        "settings.saved.message": [
            "en": "Your settings have been saved successfully.",
            "zh": "您的设置已成功保存。"
        ],
        "settings.confirm": [
            "en": "OK",
            "zh": "确定"
        ],

        // MARK: - Bridge Logs
        "logs.title": [
            "en": "Bridge Logs",
            "zh": "桥接日志"
        ],
        "logs.clear": [
            "en": "Clear",
            "zh": "清空"
        ],
        "logs.empty": [
            "en": "No logs yet",
            "zh": "暂无日志"
        ],

        // MARK: - Instances Panel
        "instances.title": [
            "en": "Connected Instances",
            "zh": "已连接实例"
        ],
        "instances.empty": [
            "en": "No instances connected",
            "zh": "暂无已连接实例"
        ],
        "instances.client": [
            "en": "Client",
            "zh": "客户端"
        ],
        "instances.version": [
            "en": "Version",
            "zh": "版本"
        ],
        "instances.connected_at": [
            "en": "Connected",
            "zh": "连接时间"
        ],
        "instances.last_seen": [
            "en": "Last Seen",
            "zh": "最后活跃"
        ],

        // MARK: - TweetClaw Tab
        "tweetclaw.title": [
            "en": "TweetClaw",
            "zh": "TweetClaw"
        ],
        "tweetclaw.status": [
            "en": "Status",
            "zh": "状态"
        ],
        "tweetclaw.connected": [
            "en": "Connected",
            "zh": "已连接"
        ],
        "tweetclaw.disconnected": [
            "en": "Disconnected",
            "zh": "未连接"
        ],
        "tweetclaw.tabs": [
            "en": "X Tabs",
            "zh": "X 标签页"
        ],
        "tweetclaw.logged_in": [
            "en": "Logged In",
            "zh": "已登录"
        ],
        "tweetclaw.not_logged_in": [
            "en": "Not Logged In",
            "zh": "未登录"
        ],

        // MARK: - AIClaw Tab
        "aiclaw.title": [
            "en": "AIClaw",
            "zh": "AIClaw"
        ],
        "aiclaw.status": [
            "en": "Status",
            "zh": "状态"
        ],
        "aiclaw.connected": [
            "en": "Connected",
            "zh": "已连接"
        ],
        "aiclaw.disconnected": [
            "en": "Disconnected",
            "zh": "未连接"
        ],
        "aiclaw.platforms": [
            "en": "AI Platforms",
            "zh": "AI 平台"
        ],
        "aiclaw.chatgpt": [
            "en": "ChatGPT",
            "zh": "ChatGPT"
        ],
        "aiclaw.gemini": [
            "en": "Gemini",
            "zh": "Gemini"
        ],
        "aiclaw.grok": [
            "en": "Grok",
            "zh": "Grok"
        ],

        // MARK: - Common
        "common.yes": [
            "en": "Yes",
            "zh": "是"
        ],
        "common.no": [
            "en": "No",
            "zh": "否"
        ],
        "common.ok": [
            "en": "OK",
            "zh": "确定"
        ],
        "common.cancel": [
            "en": "Cancel",
            "zh": "取消"
        ],
        "common.save": [
            "en": "Save",
            "zh": "保存"
        ],
        "common.close": [
            "en": "Close",
            "zh": "关闭"
        ],
        "common.error": [
            "en": "Error",
            "zh": "错误"
        ],
        "common.success": [
            "en": "Success",
            "zh": "成功"
        ],
        "common.loading": [
            "en": "Loading...",
            "zh": "加载中..."
        ],
        "common.now": [
            "en": "Now",
            "zh": "现在"
        ]
    ]
}
