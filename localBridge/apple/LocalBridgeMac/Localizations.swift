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
            "zh": "多配置"
        ],
        "sidebar.instances.preview": [
            "en": "View all online browser extension instances",
            "zh": "查看所有在线的浏览器扩展实例"
        ],

        // MARK: - AppDelegate
        "app.quit": [
            "en": "Quit",
            "zh": "退出"
        ],
        "app.help": [
            "en": "Help",
            "zh": "帮助"
        ],
        "app.open": [
            "en": "Open OpenHub",
            "zh": "打开 OpenHub"
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
        "api.endpoints": [
            "en": "API ENDPOINTS",
            "zh": "API 端点"
        ],
        "api.method": [
            "en": "Method",
            "zh": "方法"
        ],
        "api.path": [
            "en": "Path",
            "zh": "路径"
        ],
        "api.summary": [
            "en": "SUMMARY",
            "zh": "摘要"
        ],
        "api.description": [
            "en": "DESCRIPTION",
            "zh": "描述"
        ],
        "api.request_body": [
            "en": "REQUEST BODY",
            "zh": "请求体"
        ],
        "api.curl_example": [
            "en": "cURL EXAMPLE",
            "zh": "cURL 示例"
        ],
        "api.response_format": [
            "en": "RESPONSE FORMAT",
            "zh": "响应格式"
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
        "settings.version_format": [
            "en": "Version %@(%@)",
            "zh": "版本号v.%@(%@)"
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
        "settings.subtitle": [
            "en": "Manage your instance protocols and local environment behaviors.",
            "zh": "管理实例协议和本地环境行为。"
        ],
        "settings.general": [
            "en": "General",
            "zh": "通用"
        ],
        "settings.keep_on_top": [
            "en": "Keep window on top",
            "zh": "窗口置顶"
        ],
        "settings.keep_on_top.hint": [
            "en": "Ensure OpenHub remains visible above other applications.",
            "zh": "确保 OpenHub 保持在其他应用程序之上。"
        ],
        "settings.aiclaw_websocket": [
            "en": "AIClaw WebSocket",
            "zh": "AIClaw WebSocket"
        ],
        "settings.tweetclaw_websocket": [
            "en": "TweetClaw WebSocket",
            "zh": "TweetClaw WebSocket"
        ],
        "settings.lan_ip_addresses": [
            "en": "LAN IP ADDRESSES (OPTIONAL)",
            "zh": "局域网 IP 地址（可选）"
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
        "logs.cleared": [
            "en": "Logs cleared",
            "zh": "清空成功"
        ],
        "logs.already_empty": [
            "en": "Logs are already empty",
            "zh": "日志已为空"
        ],
        "logs.nothing_to_copy": [
            "en": "Nothing to copy",
            "zh": "暂无可复制内容"
        ],
        "logs.empty": [
            "en": "No logs yet",
            "zh": "暂无日志"
        ],
        "logs.auto_scroll": [
            "en": "AUTO-SCROLL",
            "zh": "自动滚动"
        ],
        "logs.entries": [
            "en": "ENTRIES",
            "zh": "条记录"
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
        "instances.refresh": [
            "en": "Refresh",
            "zh": "刷新"
        ],
        "instances.empty.hint": [
            "en": "Please ensure browser extension is running and connected to OpenHub",
            "zh": "请确保浏览器扩展已启动并连接到 OpenHub"
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
        "instances.subtitle": [
            "en": "REAL-TIME EXTENSION HEALTH & BRIDGE METRICS",
            "zh": "实时扩展运行状况与桥接指标"
        ],
        "instances.active": [
            "en": "ACTIVE",
            "zh": "活跃"
        ],
        "instances.idle": [
            "en": "IDLE",
            "zh": "空闲"
        ],
        "instances.latency": [
            "en": "LATENCY",
            "zh": "延迟"
        ],
        "instances.status": [
            "en": "STATUS",
            "zh": "状态"
        ],
        "instances.connected_since": [
            "en": "CONNECTED SINCE",
            "zh": "连接时间"
        ],
        "instances.refreshed": [
            "en": "Refreshed",
            "zh": "已刷新"
        ],
        "instances.time_ago": [
            "en": "%@%@ ago",
            "zh": "%@%@前"
        ],
        "instances.unit_s": [
            "en": "s",
            "zh": "秒"
        ],
        "instances.unit_m": [
            "en": "m",
            "zh": "分"
        ],
        "instances.unit_h": [
            "en": "h",
            "zh": "时"
        ],
        "instances.unit_d": [
            "en": "d",
            "zh": "天"
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
        "tweetclaw.target_instance": [
            "en": "TARGET INSTANCE",
            "zh": "目标实例"
        ],
        "tweetclaw.no_instance": [
            "en": "No instance available",
            "zh": "无可用实例"
        ],
        "tweetclaw.api_placeholder": [
            "en": "Select an API from the left sidebar to view details.",
            "zh": "从左侧列表选择 API 查看详情。"
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
        ],
        "common.copy": [
            "en": "Copy",
            "zh": "复制"
        ],
        "common.copied": [
            "en": "Copied successfully",
            "zh": "复制成功"
        ],
        "common.legacy": [
            "en": "(Legacy)",
            "zh": "(旧版)"
        ]
    ]
}
