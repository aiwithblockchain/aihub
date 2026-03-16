import AppKit

// MARK: - Shared Chat View Controller

final class ConsoleChatViewController: NSViewController {
    private let agent: AIAgent
    private let stackView  = NSStackView()
    private let scrollView = NSScrollView()
    private let inputField = ConsoleTextField()

    init(agent: AIAgent) {
        self.agent = agent
        super.init(nibName: nil, bundle: nil)
    }
    required init?(coder: NSCoder) { fatalError() }

    override func loadView() {
        view = NSView()
        view.translatesAutoresizingMaskIntoConstraints = false
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor.consoleZ950.cgColor
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        setupHeader()
        setupMessages()
        setupInput()
    }

    // MARK: - Header

    private func setupHeader() {
        let header = NSView()
        header.wantsLayer = true
        header.layer?.backgroundColor = NSColor.consoleZ950.cgColor
        header.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(header)

        // Avatar
        let avatar = NSView()
        avatar.wantsLayer = true
        avatar.layer?.cornerRadius = 7
        avatar.translatesAutoresizingMaskIntoConstraints = false
        let grad = CAGradientLayer()
        grad.colors      = [agent.role.color.withAlphaComponent(0.25).cgColor,
                            agent.role.color.withAlphaComponent(0.1).cgColor]
        grad.frame        = CGRect(x: 0, y: 0, width: 36, height: 36)
        grad.cornerRadius = 7
        avatar.layer?.addSublayer(grad)

        let emoji = NSTextField(labelWithString: agent.role.emoji)
        emoji.font = .systemFont(ofSize: 18)
        emoji.translatesAutoresizingMaskIntoConstraints = false
        avatar.addSubview(emoji)
        header.addSubview(avatar)

        // Name & subtitle
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

        // Online badge
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

        // Bottom border
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

    // MARK: - Messages

    private func setupMessages() {
        scrollView.drawsBackground = false
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scrollView)

        stackView.orientation = .vertical
        stackView.spacing     = 14
        stackView.edgeInsets  = NSEdgeInsets(top: 16, left: 16, bottom: 16, right: 16)
        stackView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.documentView = stackView

        NSLayoutConstraint.activate([
            // 61 = header 60 + border 1
            scrollView.topAnchor.constraint(equalTo: view.topAnchor, constant: 61),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            // 68 = input area height
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -68),
            stackView.topAnchor.constraint(equalTo: scrollView.contentView.topAnchor),
            stackView.centerXAnchor.constraint(equalTo: scrollView.centerXAnchor),
            stackView.widthAnchor.constraint(equalTo: scrollView.widthAnchor, constant: -32)
        ])
        for m in agent.messages { addMessageBubble(m) }
    }

    private func addMessageBubble(_ m: AIMessage) {
        let isAI = m.sender == .ai
        let container = NSView()
        container.translatesAutoresizingMaskIntoConstraints = false
        stackView.addArrangedSubview(container)

        let bubble = NSView()
        bubble.wantsLayer = true
        bubble.layer?.cornerRadius = 10
        bubble.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(bubble)

        let content = NSTextField(labelWithString: m.content)
        content.font                 = .systemFont(ofSize: 13)
        content.textColor            = .consoleText
        content.maximumNumberOfLines = 0
        content.translatesAutoresizingMaskIntoConstraints = false
        bubble.addSubview(content)

        if isAI {
            bubble.layer?.backgroundColor = agent.role.color.withAlphaComponent(0.15).cgColor
            bubble.layer?.borderColor     = agent.role.color.withAlphaComponent(0.25).cgColor
            bubble.layer?.borderWidth     = 1
            NSLayoutConstraint.activate([
                bubble.leadingAnchor.constraint(equalTo: container.leadingAnchor),
                bubble.trailingAnchor.constraint(lessThanOrEqualTo: container.trailingAnchor, constant: -60)
            ])
        } else {
            bubble.layer?.backgroundColor = NSColor.consoleBlue.withAlphaComponent(0.2).cgColor
            bubble.layer?.borderColor     = NSColor.consoleBlue.withAlphaComponent(0.3).cgColor
            bubble.layer?.borderWidth     = 1
            NSLayoutConstraint.activate([
                bubble.trailingAnchor.constraint(equalTo: container.trailingAnchor),
                bubble.leadingAnchor.constraint(greaterThanOrEqualTo: container.leadingAnchor, constant: 60)
            ])
        }

        NSLayoutConstraint.activate([
            container.heightAnchor.constraint(greaterThanOrEqualTo: bubble.heightAnchor),
            bubble.topAnchor.constraint(equalTo: container.topAnchor),
            bubble.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            content.topAnchor.constraint(equalTo: bubble.topAnchor, constant: 10),
            content.leadingAnchor.constraint(equalTo: bubble.leadingAnchor, constant: 12),
            content.trailingAnchor.constraint(equalTo: bubble.trailingAnchor, constant: -12),
            content.bottomAnchor.constraint(equalTo: bubble.bottomAnchor, constant: -10)
        ])
    }

    // MARK: - Input

    private func setupInput() {
        let inputArea = NSView()
        inputArea.wantsLayer = true
        inputArea.layer?.backgroundColor = NSColor.consoleZ950.cgColor
        inputArea.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(inputArea)

        let border = NSView()
        border.wantsLayer = true
        border.layer?.backgroundColor = NSColor.consoleZ800.cgColor
        border.translatesAutoresizingMaskIntoConstraints = false
        inputArea.addSubview(border)

        inputField.placeholderString = "给 \(agent.role.label) 发送消息..."
        inputField.translatesAutoresizingMaskIntoConstraints = false
        inputArea.addSubview(inputField)

        let btn = ConsoleSendButton()
        btn.target = self
        btn.action = #selector(sendMessage)
        btn.translatesAutoresizingMaskIntoConstraints = false
        inputArea.addSubview(btn)

        let hint = NSTextField(labelWithString: "在此输入可直接干预 \(agent.role.label) 的决策")
        hint.font      = .systemFont(ofSize: 10)
        hint.textColor = .consoleText3
        hint.translatesAutoresizingMaskIntoConstraints = false
        inputArea.addSubview(hint)

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
            inputField.trailingAnchor.constraint(equalTo: btn.leadingAnchor, constant: -8),
            inputField.heightAnchor.constraint(equalToConstant: 30),

            btn.centerYAnchor.constraint(equalTo: inputField.centerYAnchor),
            btn.trailingAnchor.constraint(equalTo: inputArea.trailingAnchor, constant: -14),
            btn.widthAnchor.constraint(equalToConstant: 34),
            btn.heightAnchor.constraint(equalToConstant: 34),

            hint.topAnchor.constraint(equalTo: inputField.bottomAnchor, constant: 4),
            hint.centerXAnchor.constraint(equalTo: inputArea.centerXAnchor)
        ])
    }

    // MARK: - Send

    @objc private func sendMessage() {
        let text = inputField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }

        addMessageBubble(AIMessage(sender: .human, content: text, timestamp: Date(), role: nil))
        inputField.stringValue = ""

        let reply: String
        switch agent.role {
        case .pm:        reply = "收到您的建议。我将重新评估项目优先顺序并通知开发团队进行调整。"
        case .developer: reply = "明白。我正在检查相关代码模块，完成后会提交预览供您检查。"
        case .qa:        reply = "好的。我将针对这部分功能增加额外的边界条件测试。"
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { [weak self] in
            guard let self = self else { return }
            self.addMessageBubble(AIMessage(sender: .ai, content: reply, timestamp: Date(), role: self.agent.role))
        }
    }
}
