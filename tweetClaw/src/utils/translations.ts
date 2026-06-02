export interface Translations {
  [key: string]: string;
}

export const translations: Record<'zh' | 'en', Translations> = {
  zh: {
    // Header
    'app.title': 'TweetClaw',
    'app.subtitle': 'AI 代理的全能桥接器',

    // Platforms
    'platforms.title': '平台',
    'platform.x.name': 'X (Twitter)',
    'platform.x.status': '活跃桥接',
    'platform.reddit.name': 'Reddit',
    'platform.reddit.status': '即将推出',
    'platform.discord.name': 'Discord',
    'platform.discord.status': '即将推出',
    'platform.xiaohongshu.name': '小红书',
    'platform.xiaohongshu.status': '活跃桥接',

    // Badges
    'badge.active': '活跃',
    'badge.pending': '待开发',

    // Footer
    'footer.debug': '打开调试界面',

    // Status
    'status.connected': '已连接到 LocalBridgeMac',
    'status.waiting': '等待 LocalBridgeMac…',
    'status.checking': '检查中…',
    'status.unreachable': '无法连接到后台',

    // Settings View
    'settings.title': '桥接设置',
    'settings.connection.title': '连接',
    'settings.instance.title': '实例',

    // Connection Form
    'form.ip.label': 'IP 地址',
    'form.ip.placeholder': '127.0.0.1',
    'form.port.label': 'WebSocket 端口',
    'form.port.placeholder': '10086',
    'form.rest_port.label': 'REST 端口',
    'form.rest_port.placeholder': '10088',
    'form.reconnect.button': '重新连接',
    'form.reconnect.success': '重连中...',
    'form.save.button': '保存并重连',
    'form.save.success': '已保存!',

    // Display Name
    'name.label': '显示名称',
    'name.placeholder': 'User-1234',
    'name.save.button': '保存名称并重连',
    'name.save.success': '已保存!',

    // Capabilities
    'capabilities.title': '功能',
    'capabilities.bind': '将 X 浏览器会话绑定到本地 AI 代理',
    'capabilities.read': '读取主页时间线和搜索结果',
    'capabilities.profile': '获取用户资料信息',
    'capabilities.actions': '执行操作(点赞、转发、关注、发帖)',
    'capabilities.navigate': '按需打开和导航 X 标签页',
    'capabilities.save': '通过本地桥接节省 AI token 成本',

    // XHS Capabilities
    'capabilities.xhs.bind': '将小红书会话绑定到本地 AI 代理',
    'capabilities.xhs.read': '读取首页和搜索结果',
    'capabilities.xhs.profile': '获取用户资料信息',
    'capabilities.xhs.actions': '执行操作(点赞、收藏、评论、发帖)',
    'capabilities.xhs.save': '通过本地桥接节省 AI token 成本',

    // Alerts
    'alert.invalid_ip': '请输入 IP 地址',
    'alert.invalid_port': '无效的端口号(必须在 1024 – 65535 之间)',
    'alert.invalid_ip_format': '无效的 IP 地址格式',
    'alert.invalid_name': '请输入名称',
    'alert.name_too_long': '名称不能超过 20 个字符',
  },

  en: {
    // Header
    'app.title': 'TweetClaw',
    'app.subtitle': 'Omni-Bridge for AI Agents',

    // Platforms
    'platforms.title': 'Platforms',
    'platform.x.name': 'X (Twitter)',
    'platform.x.status': 'Active Bridge',
    'platform.reddit.name': 'Reddit',
    'platform.reddit.status': 'Coming Soon',
    'platform.discord.name': 'Discord',
    'platform.discord.status': 'Coming Soon',
    'platform.xiaohongshu.name': 'Xiaohongshu',
    'platform.xiaohongshu.status': 'Active Bridge',

    // Badges
    'badge.active': 'Active',
    'badge.pending': 'Pending',

    // Footer
    'footer.debug': 'Open Debug Interface',

    // Status
    'status.connected': 'Connected to LocalBridgeMac',
    'status.waiting': 'Waiting for LocalBridgeMac…',
    'status.checking': 'Checking…',
    'status.unreachable': 'Unable to reach background',

    // Settings View
    'settings.title': 'Bridge Settings',
    'settings.connection.title': 'Connection',
    'settings.instance.title': 'Instance',

    // Connection Form
    'form.ip.label': 'IP Address',
    'form.ip.placeholder': '127.0.0.1',
    'form.port.label': 'WebSocket Port',
    'form.port.placeholder': '10086',
    'form.rest_port.label': 'REST Port',
    'form.rest_port.placeholder': '10088',
    'form.reconnect.button': 'Reconnect',
    'form.reconnect.success': 'Reconnecting...',
    'form.save.button': 'Save & Reconnect',
    'form.save.success': 'Saved!',

    // Display Name
    'name.label': 'Display Name',
    'name.placeholder': 'User-1234',
    'name.save.button': 'Save Name & Reconnect',
    'name.save.success': 'Saved!',

    // Capabilities
    'capabilities.title': 'Capabilities',
    'capabilities.bind': 'Bind X browser session to local AI agents',
    'capabilities.read': 'Read home timeline & search results',
    'capabilities.profile': 'Fetch user profile information',
    'capabilities.actions': 'Execute actions (like, retweet, follow, post)',
    'capabilities.navigate': 'Open and navigate X tabs on demand',
    'capabilities.save': 'Saves AI token costs via local bridging',

    // XHS Capabilities
    'capabilities.xhs.bind': 'Bind Xiaohongshu session to local AI agents',
    'capabilities.xhs.read': 'Read feed & search results',
    'capabilities.xhs.profile': 'Fetch user profile information',
    'capabilities.xhs.actions': 'Execute actions (like, collect, comment, post)',
    'capabilities.xhs.save': 'Saves AI token costs via local bridging',

    // Alerts
    'alert.invalid_ip': 'Please enter an IP address',
    'alert.invalid_port': 'Invalid port number (must be 1024 – 65535)',
    'alert.invalid_ip_format': 'Invalid IP address format',
    'alert.invalid_name': 'Please enter a name',
    'alert.name_too_long': 'Name must be 20 characters or less',
  }
};
