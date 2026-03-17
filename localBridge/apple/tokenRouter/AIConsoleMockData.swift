import Foundation

// MARK: - Mock Data

class MockData {
    static let agents: [AIAgent] = [
        AIAgent(
            id: "pm-1", name: "Claude PM", role: .pm, type: .api, status: .working,
            messages: [
                AIMessage(sender: .human, content: "帮我制定登录界面的开发计划", timestamp: Date().addingTimeInterval(-3600), role: nil),
                AIMessage(sender: .ai, content: "好的，我已经将需求拆解为 3 个任务，并分配给了开发人员。", timestamp: Date().addingTimeInterval(-3500), role: .pm)
            ],
            apiEndpoint: "https://api.anthropic.com", model: "claude-3.5-sonnet"
        ),
        AIAgent(
            id: "dev-1", name: "Claude 3.5", role: .developer, type: .api, status: .working,
            messages: [
                AIMessage(sender: .ai, content: "正在编写 LoginForm.swift 的核心逻辑...", timestamp: Date().addingTimeInterval(-1800), role: .developer)
            ],
            apiEndpoint: "https://api.anthropic.com", model: "claude-3.5-sonnet"
        ),
        AIAgent(
            id: "dev-2", name: "GPT-4", role: .developer, type: .api, status: .idle,
            messages: [],
            apiEndpoint: "https://api.openai.com", model: "gpt-4"
        ),
        AIAgent(
            id: "qa-1", name: "QA Bot", role: .qa, type: .cli, status: .idle,
            messages: [],
            command: "npm test"
        )
    ]

    static let tasks: [AITask] = [
        AITask(id: "t1", title: "实现用户登录功能", description: "需要实现用户名/密码登录，包括表单验证",
               assignedTo: "dev-1", status: .inProgress, priority: .high, progress: 0.4),
        AITask(id: "t2", title: "设计 UI 界面", description: "完成主页面的 UI 设计",
               assignedTo: "pm-1", status: .review, priority: .medium, progress: 1.0),
        AITask(id: "t3", title: "编写单元测试", description: "为登录模块编写完整测试用例",
               assignedTo: "qa-1", status: .pending, priority: .low, progress: 0.0)
    ]
}
