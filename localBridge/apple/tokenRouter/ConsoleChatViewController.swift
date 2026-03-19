import AppKit
import Foundation

// MARK: - Shared Chat View Controller

final class ConsoleChatViewController: NSViewController {
    private let agent: AIAgent
    private let viewModel: ConsoleChatViewModel
    private let stackView  = NSStackView()
    private let scrollView = NSScrollView()
    private let inputField = ConsoleTextField()
    private let sendButton = ConsoleSendButton()
    private let providerPopup = NSPopUpButton()
    private var availableProviders: [ProviderConfig] = []
    private var configUpdateObserver: NSObjectProtocol?

    init(agent: AIAgent) {
        self.agent = agent
        self.viewModel = ConsoleChatViewModel(initialMessages: agent.messages)
        super.init(nibName: nil, bundle: nil)
    }
    required init?(coder: NSCoder) { fatalError() }

    override func loadView() {
        view = NSView(frame: NSRect(x: 0, y: 0, width: 1280, height: 850))
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor(hex: "#1A1A1A").cgColor // 深黑色背景
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        loadAvailableProviders()
        setupHeader()
        setupMessages()
        setupInput()

        viewModel.onMessagesUpdated = { [weak self] in
            guard let self = self else { return }
            self.refreshMessages()
        }

        viewModel.onStreamingStateChanged = { [weak self] (isStreaming: Bool) in
            guard let self = self else { return }
            self.inputField.isEnabled = !isStreaming
            self.sendButton.isEnabled = !isStreaming
        }

        // 监听配置更新通知
        configUpdateObserver = NotificationCenter.default.addObserver(
            forName: NSNotification.Name("ProviderConfigDidUpdate"),
            object: nil,
            queue: .main
        ) { [weak self] _ in
            print("🔄 [Chat] 收到配置更新通知，重新加载 Provider")
            self?.loadAvailableProviders()
            self?.updateProviderPopup()
        }
    }

    deinit {
        if let observer = configUpdateObserver {
            NotificationCenter.default.removeObserver(observer)
        }
    }

    private func loadAvailableProviders() {
        print("🔄 [Chat] 加载可用的 Provider 配置...")
        let keychain = KeychainTokenStore()
        do {
            availableProviders = try keychain.loadAllProviderConfigs()
            print("✅ [Chat] 成功加载 \(availableProviders.count) 个 Provider")
            for (index, config) in availableProviders.enumerated() {
                print("   \(index + 1). \(config.name) (\(config.providerType.displayName))")
            }
        } catch {
            print("❌ [Chat] 加载 Provider 配置失败: \(error)")
            availableProviders = []
        }
    }

    private func updateProviderPopup() {
        let selectedIndex = providerPopup.indexOfSelectedItem
        providerPopup.removeAllItems()

        if availableProviders.isEmpty {
            providerPopup.addItem(withTitle: "无可用 Provider")
        } else {
            for config in availableProviders {
                let title = "\(config.name) (\(config.providerType.displayName))"
                providerPopup.addItem(withTitle: title)
            }
            // 尝试保持之前的选择
            if selectedIndex >= 0 && selectedIndex < availableProviders.count {
                providerPopup.selectItem(at: selectedIndex)
            }
        }
    }

    private func setupHeader() {
        let header = NSView()
        header.wantsLayer = true
        header.layer?.backgroundColor = NSColor.consoleZ950.cgColor
        header.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(header)

        let avatar = NSView()
        avatar.wantsLayer = true
        avatar.layer?.cornerRadius = 7
        avatar.translatesAutoresizingMaskIntoConstraints = false
        let grad = CAGradientLayer()
        grad.colors       = [agent.role.color.withAlphaComponent(0.25).cgColor,
                             agent.role.color.withAlphaComponent(0.1).cgColor]
        grad.frame        = CGRect(x: 0, y: 0, width: 36, height: 36)
        grad.cornerRadius = 7
        avatar.layer?.addSublayer(grad)

        let emoji = NSTextField(labelWithString: agent.role.emoji)
        emoji.font = .systemFont(ofSize: 18)
        emoji.translatesAutoresizingMaskIntoConstraints = false
        avatar.addSubview(emoji)
        header.addSubview(avatar)

        let name = NSTextField(labelWithString: agent.name)
        name.font      = .systemFont(ofSize: 13, weight: .semibold)
        name.textColor = .consoleText
        name.translatesAutoresizingMaskIntoConstraints = false
        header.addSubview(name)

        let sub = NSTextField(labelWithString: "\(agent.role.label) · \(agent.model ?? "claude-3.5-sonnet")")
        sub.font      = .systemFont(ofSize: 11)
        sub.textColor = .consoleText2
        sub.translatesAutoresizingMaskIntoConstraints = false
        header.addSubview(sub)

        // Provider 选择下拉菜单
        providerPopup.removeAllItems()
        if availableProviders.isEmpty {
            providerPopup.addItem(withTitle: "无可用 Provider")
        } else {
            for config in availableProviders {
                let title = "\(config.name) (\(config.providerType.displayName))"
                providerPopup.addItem(withTitle: title)
            }
        }
        providerPopup.font = .systemFont(ofSize: 11)
        providerPopup.translatesAutoresizingMaskIntoConstraints = false
        header.addSubview(providerPopup)

        let online = NSView()
        online.wantsLayer = true
        online.layer?.cornerRadius    = 10
        online.layer?.backgroundColor = NSColor.consoleGreen.withAlphaComponent(0.15).cgColor
        online.layer?.borderColor     = NSColor.consoleGreen.withAlphaComponent(0.3).cgColor
        online.layer?.borderWidth     = 1
        online.translatesAutoresizingMaskIntoConstraints = false
        let onlineLbl = NSTextField(labelWithString: "在线")
        onlineLbl.font      = .systemFont(ofSize: 11)
        onlineLbl.textColor = .consoleGreen
        onlineLbl.translatesAutoresizingMaskIntoConstraints = false
        online.addSubview(onlineLbl)
        header.addSubview(online)

        let border = NSView()
        border.wantsLayer = true
        border.layer?.backgroundColor = NSColor.consoleZ800.cgColor
        border.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(border)

        NSLayoutConstraint.activate([
            header.topAnchor.constraint(equalTo: view.topAnchor),
            header.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            header.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            header.heightAnchor.constraint(equalToConstant: 60),
            avatar.centerYAnchor.constraint(equalTo: header.centerYAnchor),
            avatar.leadingAnchor.constraint(equalTo: header.leadingAnchor, constant: 14),
            avatar.widthAnchor.constraint(equalToConstant: 36),
            avatar.heightAnchor.constraint(equalToConstant: 36),
            emoji.centerXAnchor.constraint(equalTo: avatar.centerXAnchor),
            emoji.centerYAnchor.constraint(equalTo: avatar.centerYAnchor),
            name.topAnchor.constraint(equalTo: avatar.topAnchor, constant: 2),
            name.leadingAnchor.constraint(equalTo: avatar.trailingAnchor, constant: 10),
            sub.bottomAnchor.constraint(equalTo: avatar.bottomAnchor, constant: -1),
            sub.leadingAnchor.constraint(equalTo: avatar.trailingAnchor, constant: 10),
            providerPopup.centerYAnchor.constraint(equalTo: header.centerYAnchor),
            providerPopup.trailingAnchor.constraint(equalTo: online.leadingAnchor, constant: -12),
            providerPopup.widthAnchor.constraint(greaterThanOrEqualToConstant: 200),
            online.centerYAnchor.constraint(equalTo: header.centerYAnchor),
            online.trailingAnchor.constraint(equalTo: header.trailingAnchor, constant: -14),
            online.widthAnchor.constraint(equalToConstant: 54),
            online.heightAnchor.constraint(equalToConstant: 22),
            onlineLbl.centerXAnchor.constraint(equalTo: online.centerXAnchor),
            onlineLbl.centerYAnchor.constraint(equalTo: online.centerYAnchor),
            border.topAnchor.constraint(equalTo: header.bottomAnchor),
            border.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            border.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            border.heightAnchor.constraint(equalToConstant: 1)
        ])
    }

    private func setupMessages() {
        scrollView.drawsBackground = false
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scrollView)

        stackView.orientation = .vertical
        stackView.spacing     = 14
        stackView.edgeInsets  = NSEdgeInsets(top: 16, left: 16, bottom: 16, right: 16)
        stackView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.documentView = stackView

        let stackWidth = stackView.widthAnchor.constraint(equalTo: scrollView.widthAnchor, constant: -32)
        stackWidth.priority = .defaultHigh
        
        let scrollBottom = scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -68)
        scrollBottom.priority = .defaultHigh

        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.topAnchor, constant: 61),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollBottom,
            stackView.topAnchor.constraint(equalTo: scrollView.contentView.topAnchor),
            stackView.centerXAnchor.constraint(equalTo: scrollView.centerXAnchor),
            stackWidth
        ])
    }

    private func refreshMessages() {
        let currentCount = stackView.arrangedSubviews.count
        let messagesCount = viewModel.messages.count
        if messagesCount > currentCount {
            for i in currentCount..<messagesCount { addMessageBubble(viewModel.messages[i]) }
        } else if messagesCount > 0 && messagesCount == currentCount {
            let lastIdx = messagesCount - 1
            if viewModel.messages[lastIdx].sender == AIMessage.Sender.ai { updateMessageBubble(at: lastIdx, message: viewModel.messages[lastIdx]) }
        }
        DispatchQueue.main.async {
            self.scrollView.contentView.scrollToVisible(CGRect(x: 0, y: self.stackView.frame.height - self.scrollView.contentSize.height, width: self.scrollView.contentSize.width, height: self.scrollView.contentSize.height))
        }
    }

    private func addMessageBubble(_ m: AIMessage) {
        let isAI = m.sender == AIMessage.Sender.ai
        let container = NSView()
        container.translatesAutoresizingMaskIntoConstraints = false
        stackView.addArrangedSubview(container)

        let bubble = NSView(); bubble.wantsLayer = true; bubble.layer?.cornerRadius = 10
        bubble.translatesAutoresizingMaskIntoConstraints = false; bubble.identifier = NSUserInterfaceItemIdentifier("bubble")
        container.addSubview(bubble)

        let content = NSTextField(labelWithString: m.content); content.font = .systemFont(ofSize: 13); content.textColor = .consoleText
        content.maximumNumberOfLines = 0; content.translatesAutoresizingMaskIntoConstraints = false; content.identifier = NSUserInterfaceItemIdentifier("content")
        bubble.addSubview(content)

        if isAI {
            bubble.layer?.backgroundColor = agent.role.color.withAlphaComponent(0.08).cgColor
            bubble.layer?.borderColor = agent.role.color.withAlphaComponent(0.15).cgColor
            bubble.layer?.borderWidth = 1
            NSLayoutConstraint.activate([bubble.leadingAnchor.constraint(equalTo: container.leadingAnchor), bubble.trailingAnchor.constraint(lessThanOrEqualTo: container.trailingAnchor, constant: -60)])
        } else {
            bubble.layer?.backgroundColor = NSColor.consoleBlue.withAlphaComponent(0.08).cgColor
            bubble.layer?.borderColor = NSColor.consoleBlue.withAlphaComponent(0.15).cgColor
            bubble.layer?.borderWidth = 1
            NSLayoutConstraint.activate([bubble.trailingAnchor.constraint(equalTo: container.trailingAnchor), bubble.leadingAnchor.constraint(greaterThanOrEqualTo: container.leadingAnchor, constant: 60)])
        }
        NSLayoutConstraint.activate([container.heightAnchor.constraint(greaterThanOrEqualTo: bubble.heightAnchor), bubble.topAnchor.constraint(equalTo: container.topAnchor), bubble.bottomAnchor.constraint(equalTo: container.bottomAnchor), content.topAnchor.constraint(equalTo: bubble.topAnchor, constant: 10), content.leadingAnchor.constraint(equalTo: bubble.leadingAnchor, constant: 12), content.trailingAnchor.constraint(equalTo: bubble.trailingAnchor, constant: -12), content.bottomAnchor.constraint(equalTo: bubble.bottomAnchor, constant: -10)])
    }

    private func updateMessageBubble(at index: Int, message: AIMessage) {
        guard index < stackView.arrangedSubviews.count else { return }
        let container = stackView.arrangedSubviews[index]
        guard let bubble = container.subviews.first(where: { $0.identifier?.rawValue == "bubble" }),
              let content = bubble.subviews.first(where: { $0.identifier?.rawValue == "content" }) as? NSTextField else { return }
        content.stringValue = message.content
    }

    private func setupInput() {
        let inputArea = NSView(); inputArea.wantsLayer = true; inputArea.layer?.backgroundColor = NSColor.consoleZ950.cgColor
        inputArea.translatesAutoresizingMaskIntoConstraints = false; view.addSubview(inputArea)
        let border = NSView(); border.wantsLayer = true; border.layer?.backgroundColor = NSColor.consoleZ800.cgColor
        border.translatesAutoresizingMaskIntoConstraints = false; inputArea.addSubview(border)
        inputField.placeholderString = "给 \(agent.role.label) 发送消息..."; inputField.translatesAutoresizingMaskIntoConstraints = false; inputArea.addSubview(inputField)
        sendButton.target = self; sendButton.action = #selector(sendMessage); sendButton.translatesAutoresizingMaskIntoConstraints = false; inputArea.addSubview(sendButton)
        let hint = NSTextField(labelWithString: "在此输入可直接干预 \(agent.role.label) 的决策"); hint.font = .systemFont(ofSize: 10); hint.textColor = .consoleText3
        hint.translatesAutoresizingMaskIntoConstraints = false; inputArea.addSubview(hint)
        let sendWidth = sendButton.widthAnchor.constraint(equalToConstant: 34)
        sendWidth.priority = .defaultHigh
        let sendTrailing = sendButton.trailingAnchor.constraint(equalTo: inputArea.trailingAnchor, constant: -14)
        sendTrailing.priority = .defaultHigh

        NSLayoutConstraint.activate([
            inputArea.leadingAnchor.constraint(equalTo: view.leadingAnchor), 
            inputArea.trailingAnchor.constraint(equalTo: view.trailingAnchor), 
            inputArea.bottomAnchor.constraint(equalTo: view.bottomAnchor), 
            inputArea.heightAnchor.constraint(equalToConstant: 68), 
            border.topAnchor.constraint(equalTo: inputArea.topAnchor), 
            border.leadingAnchor.constraint(equalTo: inputArea.leadingAnchor), 
            border.trailingAnchor.constraint(equalTo: inputArea.trailingAnchor), 
            border.heightAnchor.constraint(equalToConstant: 1), 
            inputField.topAnchor.constraint(equalTo: inputArea.topAnchor, constant: 10), 
            inputField.leadingAnchor.constraint(equalTo: inputArea.leadingAnchor, constant: 14), 
            inputField.trailingAnchor.constraint(equalTo: sendButton.leadingAnchor, constant: -8), 
            inputField.heightAnchor.constraint(equalToConstant: 30), 
            sendButton.centerYAnchor.constraint(equalTo: inputField.centerYAnchor), 
            sendTrailing,
            sendWidth,
            sendButton.heightAnchor.constraint(equalToConstant: 34), 
            hint.topAnchor.constraint(equalTo: inputField.bottomAnchor, constant: 4), 
            hint.centerXAnchor.constraint(equalTo: inputArea.centerXAnchor)
        ])
    }

    @objc private func sendMessage() {
        let text = inputField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }

        print("📤 [Chat] 发送消息: \(text.prefix(50))...")

        // 获取选中的 Provider
        let selectedIndex = providerPopup.indexOfSelectedItem
        guard selectedIndex >= 0 && selectedIndex < availableProviders.count else {
            print("❌ [Chat] 没有可用的 Provider")
            addMessageBubble(AIMessage(sender: .human, content: text, timestamp: Date(), role: nil))
            inputField.stringValue = ""
            addMessageBubble(AIMessage(sender: .ai, content: "错误：没有可用的 Provider，请在设置中配置。", timestamp: Date(), role: agent.role))
            return
        }

        let selectedConfig = availableProviders[selectedIndex]
        print("🔧 [Chat] 使用 Provider: \(selectedConfig.name)")
        print("   类型: \(selectedConfig.providerType.displayName)")
        print("   Base URL: \(selectedConfig.baseURL)")
        print("   模型: \(selectedConfig.model ?? "默认")")
        print("   代理模式: \(selectedConfig.isProxyMode ? "是" : "否")")

        // 创建 Provider（根据类型选择正确的实现）
        let provider: AIProviderProtocol
        switch selectedConfig.providerType {
        case .anthropic:
            // Anthropic 使用专用的 Provider
            provider = AnthropicHTTPProvider(config: selectedConfig)
            print("✅ [Chat] 创建 Anthropic Provider 成功")
        case .openai, .custom:
            // OpenAI 和自定义类型使用 OpenAI 兼容 Provider
            provider = OpenAICompatibleProvider(config: selectedConfig)
            print("✅ [Chat] 创建 OpenAI 兼容 Provider 成功")
        default:
            print("❌ [Chat] 不支持的 Provider 类型: \(selectedConfig.providerType)")
            addMessageBubble(AIMessage(sender: .human, content: text, timestamp: Date(), role: nil))
            inputField.stringValue = ""
            addMessageBubble(AIMessage(sender: .ai, content: "错误：不支持的 Provider 类型。", timestamp: Date(), role: agent.role))
            return
        }

        inputField.stringValue = ""
        print("🚀 [Chat] 开始调用 API...")
        viewModel.sendMessage(text, provider: provider, agent: agent)
    }
}

// MARK: - ConsoleChatViewModel (Consolidated)

@MainActor
final class ConsoleChatViewModel {
    private(set) var messages: [AIMessage] = []
    var onMessagesUpdated: (() -> Void)?
    var onStreamingStateChanged: ((Bool) -> Void)?
    private var streamingTask: Task<Void, Never>?
    private var pendingDeltaBuffer: String = ""
    private var lastFlushTime: TimeInterval = 0
    private let flushInterval: TimeInterval = 0.04
    private(set) var isStreaming: Bool = false { didSet { onStreamingStateChanged?(isStreaming) } }
    init(initialMessages: [AIMessage] = []) { self.messages = initialMessages }

    func sendMessage(_ text: String, provider: AIProviderProtocol, agent: AIAgent) {
        messages.append(AIMessage(sender: AIMessage.Sender.human, content: text, timestamp: Date(), role: nil))
        onMessagesUpdated?(); streamingTask?.cancel(); isStreaming = true
        print("📨 [ViewModel] 开始发送消息到 Provider")
        streamingTask = Task {
            let request = AIRequest(conversationID: UUID(), userText: text)
            defer {
                isStreaming = false
                print("✅ [ViewModel] 流式请求结束")
            }
            do {
                let stream = provider.stream(request: request)
                print("✅ [ViewModel] 获取到流式响应")
                for try await event in stream {
                    if Task.isCancelled {
                        print("⚠️ [ViewModel] 任务被取消")
                        break
                    }
                    switch event {
                    case .start:
                        print("✅ [ViewModel] 收到 start 事件")
                        messages.append(AIMessage(sender: AIMessage.Sender.ai, content: "", timestamp: Date(), role: agent.role))
                        onMessagesUpdated?(); lastFlushTime = Date().timeIntervalSince1970
                    case .delta(_, let text):
                        print("✅ [ViewModel] 收到 delta: \(text.prefix(50))...")
                        pendingDeltaBuffer += text
                        if Date().timeIntervalSince1970 - lastFlushTime >= flushInterval { flushBuffer() }
                    case .finish:
                        print("✅ [ViewModel] 收到 finish 事件")
                        flushBuffer(); onMessagesUpdated?()
                    case .log(let m): print("📝 [ViewModel] AI Log: \(m)")
                    }
                }
            } catch {
                print("❌ [ViewModel] 捕获错误: \(error)")
                print("   错误类型: \(type(of: error))")
                print("   错误描述: \(error.localizedDescription)")
                messages.append(AIMessage(sender: AIMessage.Sender.ai, content: "错误: \(error.localizedDescription)", timestamp: Date(), role: agent.role))
                onMessagesUpdated?()
            }
        }
    }
    private func flushBuffer() {
        guard !pendingDeltaBuffer.isEmpty, let lastIdx = messages.lastIndex(where: { $0.sender == AIMessage.Sender.ai }) else { return }
        let old = messages[lastIdx]
        messages[lastIdx] = AIMessage(sender: AIMessage.Sender.ai, content: old.content + pendingDeltaBuffer, timestamp: old.timestamp, role: old.role)
        pendingDeltaBuffer = ""; lastFlushTime = Date().timeIntervalSince1970; onMessagesUpdated?()
    }
}
