export const translations: Record<'en' | 'zh', Record<string, string>> = {
    en: {
        // Page title
        'page.title': 'aiClaw Settings',

        // Heading
        'app.heading': '🤖 aiClaw Settings',

        // Form labels
        'label.host': 'WebSocket Host/IP',
        'label.port': 'WebSocket Port',
        'label.instance_name': 'Instance Name',

        // Placeholders
        'placeholder.instance_name': 'User',

        // Buttons
        'button.save': 'Save & Reconnect',
        'button.reconnect': 'Manual Reconnect',

        // Messages
        'message.invalid_port': 'Invalid port',
        'message.saved': 'Saved! Reconnecting...',
        'message.reconnecting': 'Reconnecting...',
        'message.reconnect_triggered': 'Reconnect triggered!',
        'message.reconnect_failed': 'Reconnect failed',
        'help.text': 'This product needs to be used with OpenHub, visit the website at',
    },
    zh: {
        // 页面标题
        'page.title': 'aiClaw 设置',

        // 标题
        'app.heading': '🤖 aiClaw 设置',

        // 表单标签
        'label.host': 'WebSocket 主机/IP',
        'label.port': 'WebSocket 端口',
        'label.instance_name': '实例名称',

        // 占位符
        'placeholder.instance_name': '用户',

        // 按钮
        'button.save': '保存并重连',
        'button.reconnect': '手动重连',

        // 消息
        'message.invalid_port': '无效的端口号',
        'message.saved': '已保存! 正在重连...',
        'message.reconnecting': '正在重连...',
        'message.reconnect_triggered': '重连已触发!',
        'message.reconnect_failed': '重连失败',
        'help.text': '本产品需要配合 OpenHub 使用，访问网址是',
    }
};
