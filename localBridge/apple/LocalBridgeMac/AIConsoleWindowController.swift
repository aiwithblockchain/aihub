import AppKit

// MARK: - Data Models

struct AIConfig {
    let id: UUID
    let name: String
    let provider: String
    let icon: String
    let color: NSColor
    
    static let mockList: [AIConfig] = [
        AIConfig(id: UUID(), name: "GPT-4o",     provider: "OpenAI",    icon: "🟢", color: .systemGreen),
        AIConfig(id: UUID(), name: "Claude 3.5", provider: "Anthropic", icon: "🔵", color: .systemBlue),
        AIConfig(id: UUID(), name: "Gemini Pro", provider: "Google",    icon: "🟡", color: .systemYellow),
        AIConfig(id: UUID(), name: "Grok-2",     provider: "xAI",       icon: "🟠", color: .systemOrange),
        AIConfig(id: UUID(), name: "Llama 3",    provider: "Meta",      icon: "🟣", color: .systemPurple),
    ]
}

struct ChatMessage {
    enum Role { case user, assistant }
    let role: Role
    let content: String
    let timestamp: Date
}

enum AgentStatus {
    case idle, working, done, error
    var label: String {
        switch self {
        case .idle:    return "待命"
        case .working: return "工作中"
        case .done:    return "完成"
        case .error:   return "错误"
        }
    }
    var color: NSColor {
        switch self {
        case .idle:    return .systemGray
        case .working: return .systemYellow
        case .done:    return .systemGreen
        case .error:   return .systemRed
        }
    }
}

// MARK: - Window Controller

final class AIConsoleWindowController: NSWindowController {

    private static var instance: AIConsoleWindowController?

    static func show() {
        if instance == nil { instance = AIConsoleWindowController() }
        NSApp.setActivationPolicy(.regular)
        instance?.showWindow(nil)
        instance?.window?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    init() {
        let vc = AIConsoleRootViewController()
        let window = NSWindow(contentViewController: vc)
        window.title = "AI 控制台"
        window.setContentSize(NSSize(width: 1280, height: 800))
        window.minSize = NSSize(width: 1100, height: 700)
        window.center()
        window.styleMask = [.titled, .closable, .miniaturizable, .resizable]
        window.isReleasedWhenClosed = false
        window.backgroundColor = NSColor(red: 0.11, green: 0.12, blue: 0.13, alpha: 1)
        super.init(window: window)
        window.delegate = self
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }
}

extension AIConsoleWindowController: NSWindowDelegate {
    func windowWillClose(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
        AIConsoleWindowController.instance = nil
    }
}

// MARK: - Root Layout

final class AIConsoleRootViewController: NSViewController {

    private let toolbarVC  = ConsoleToolbarViewController()
    private let pmVC       = PMPanelViewController()
    private let centerVC   = CenterWorkspaceViewController()
    private let logVC      = LogPanelViewController()

    override func loadView() { view = NSView() }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor(red: 0.11, green: 0.12, blue: 0.13, alpha: 1).cgColor

        // Toolbar
        addChild(toolbarVC)
        toolbarVC.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(toolbarVC.view)

        // Three-column split
        let split = NSSplitView()
        split.isVertical = true
        split.dividerStyle = .thin
        split.translatesAutoresizingMaskIntoConstraints = false

        [pmVC, centerVC, logVC].forEach {
            addChild($0)
            $0.view.translatesAutoresizingMaskIntoConstraints = false
            split.addArrangedSubview($0.view)
        }
        view.addSubview(split)

        NSLayoutConstraint.activate([
            toolbarVC.view.topAnchor.constraint(equalTo: view.topAnchor),
            toolbarVC.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            toolbarVC.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            toolbarVC.view.heightAnchor.constraint(equalToConstant: 52),

            split.topAnchor.constraint(equalTo: toolbarVC.view.bottomAnchor),
            split.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            split.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            split.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            pmVC.view.widthAnchor.constraint(equalToConstant: 340),
            logVC.view.widthAnchor.constraint(equalToConstant: 280),
        ])
    }
}

// MARK: - Toolbar

final class ConsoleToolbarViewController: NSViewController {

    override func loadView() { view = NSView() }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor(red: 0.14, green: 0.15, blue: 0.17, alpha: 1).cgColor

        let bottomBorder = makeLine(alpha: 0.08)
        let title        = makeLabel("AI 控制台", size: 14, weight: .semibold, alpha: 1.0)

        let modeControl = NSSegmentedControl()
        modeControl.segmentCount = 3
        modeControl.setLabel("Auto",      forSegment: 0)
        modeControl.setLabel("Semi-Auto", forSegment: 1)
        modeControl.setLabel("Manual",    forSegment: 2)
        modeControl.selectedSegment = 0
        modeControl.controlSize = .small
        modeControl.translatesAutoresizingMaskIntoConstraints = false

        let dot = NSView()
        dot.wantsLayer = true
        dot.layer?.cornerRadius = 4
        dot.layer?.backgroundColor = NSColor.systemGreen.cgColor
        dot.translatesAutoresizingMaskIntoConstraints = false

        let statusLbl = makeLabel("就绪", size: 12, weight: .regular, alpha: 0.5)

        let pauseBtn = NSButton()
        if #available(macOS 11.0, *) {
            pauseBtn.image = NSImage(systemSymbolName: "pause.fill", accessibilityDescription: "暂停")
        }
        pauseBtn.isBordered = false
        pauseBtn.contentTintColor = NSColor(white: 1, alpha: 0.6)
        pauseBtn.toolTip = "暂停所有 AI (⌘P)"
        pauseBtn.translatesAutoresizingMaskIntoConstraints = false

        [bottomBorder, title, modeControl, dot, statusLbl, pauseBtn].forEach { view.addSubview($0) }

        NSLayoutConstraint.activate([
            bottomBorder.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            bottomBorder.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            bottomBorder.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            bottomBorder.heightAnchor.constraint(equalToConstant: 1),

            title.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            title.centerYAnchor.constraint(equalTo: view.centerYAnchor),

            modeControl.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            modeControl.centerYAnchor.constraint(equalTo: view.centerYAnchor),

            dot.widthAnchor.constraint(equalToConstant: 8),
            dot.heightAnchor.constraint(equalToConstant: 8),
            dot.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            dot.trailingAnchor.constraint(equalTo: statusLbl.leadingAnchor, constant: -6),

            statusLbl.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            statusLbl.trailingAnchor.constraint(equalTo: pauseBtn.leadingAnchor, constant: -14),

            pauseBtn.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            pauseBtn.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            pauseBtn.widthAnchor.constraint(equalToConstant: 24),
            pauseBtn.heightAnchor.constraint(equalToConstant: 24),
        ])
    }

    private func makeLabel(_ s: String, size: CGFloat, weight: NSFont.Weight, alpha: CGFloat) -> NSTextField {
        let l = NSTextField(labelWithString: s)
        l.font = .systemFont(ofSize: size, weight: weight)
        l.textColor = NSColor(white: 1, alpha: alpha)
        l.translatesAutoresizingMaskIntoConstraints = false
        return l
    }

    private func makeLine(alpha: CGFloat) -> NSView {
        let v = NSView()
        v.wantsLayer = true
        v.layer?.backgroundColor = NSColor(white: 1, alpha: alpha).cgColor
        v.translatesAutoresizingMaskIntoConstraints = false
        return v
    }
}

// MARK: - PM Panel (Left)

final class PMPanelViewController: NSViewController {

    private var agentConfig: AIConfig?
    private var messages: [ChatMessage] = []

    private let headerView       = NSView()
    private let agentNameLabel   = NSTextField(labelWithString: "未配置")
    private let statusDot        = NSView()
    private let resetBtn         = NSButton()
    private let emptyState       = NSView()
    private let chatContainer    = NSView()
    private var chatTextView: NSTextView!
    private let inputField       = ConsoleTextField()
    private let sendBtn          = NSButton()

    override func loadView() { view = NSView() }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor(red: 0.13, green: 0.14, blue: 0.16, alpha: 1).cgColor
        buildHeader()
        buildEmptyState()
        buildChatUI()
        setMode(empty: true)
    }

    // MARK: - Build UI

    private func buildHeader() {
        headerView.wantsLayer = true
        headerView.layer?.backgroundColor = NSColor(red: 0.16, green: 0.17, blue: 0.19, alpha: 1).cgColor
        headerView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(headerView)

        let roleLabel = label("👔  项目经理", size: 13, weight: .semibold)
        statusDot.wantsLayer = true
        statusDot.layer?.cornerRadius = 4
        statusDot.layer?.backgroundColor = NSColor.systemGray.cgColor
        statusDot.translatesAutoresizingMaskIntoConstraints = false

        agentNameLabel.font = .systemFont(ofSize: 11)
        agentNameLabel.textColor = NSColor(white: 1, alpha: 0.45)
        agentNameLabel.translatesAutoresizingMaskIntoConstraints = false

        if #available(macOS 11.0, *) {
            resetBtn.image = NSImage(systemSymbolName: "arrow.counterclockwise", accessibilityDescription: "重置")
        } else { resetBtn.title = "↺" }
        resetBtn.isBordered = false
        resetBtn.contentTintColor = NSColor(white: 1, alpha: 0.4)
        resetBtn.toolTip = "重置 AI 配置"
        resetBtn.target = self
        resetBtn.action = #selector(resetAgent)
        resetBtn.translatesAutoresizingMaskIntoConstraints = false
        resetBtn.isHidden = true

        let border = hLine(alpha: 0.08)
        [roleLabel, statusDot, agentNameLabel, resetBtn, border].forEach { headerView.addSubview($0) }

        NSLayoutConstraint.activate([
            headerView.topAnchor.constraint(equalTo: view.topAnchor),
            headerView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            headerView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            headerView.heightAnchor.constraint(equalToConstant: 52),

            roleLabel.leadingAnchor.constraint(equalTo: headerView.leadingAnchor, constant: 16),
            roleLabel.topAnchor.constraint(equalTo: headerView.topAnchor, constant: 10),

            statusDot.widthAnchor.constraint(equalToConstant: 8),
            statusDot.heightAnchor.constraint(equalToConstant: 8),
            statusDot.leadingAnchor.constraint(equalTo: headerView.leadingAnchor, constant: 16),
            statusDot.bottomAnchor.constraint(equalTo: headerView.bottomAnchor, constant: -13),

            agentNameLabel.centerYAnchor.constraint(equalTo: statusDot.centerYAnchor),
            agentNameLabel.leadingAnchor.constraint(equalTo: statusDot.trailingAnchor, constant: 6),

            resetBtn.centerYAnchor.constraint(equalTo: headerView.centerYAnchor),
            resetBtn.trailingAnchor.constraint(equalTo: headerView.trailingAnchor, constant: -12),
            resetBtn.widthAnchor.constraint(equalToConstant: 20),
            resetBtn.heightAnchor.constraint(equalToConstant: 20),

            border.leadingAnchor.constraint(equalTo: headerView.leadingAnchor),
            border.trailingAnchor.constraint(equalTo: headerView.trailingAnchor),
            border.bottomAnchor.constraint(equalTo: headerView.bottomAnchor),
            border.heightAnchor.constraint(equalToConstant: 1),
        ])
    }

    private func buildEmptyState() {
        emptyState.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(emptyState)

        let plusBtn = ConsolePlusButton(size: 56)
        plusBtn.target = self
        plusBtn.action = #selector(pickAgent)
        plusBtn.translatesAutoresizingMaskIntoConstraints = false

        let hint = label("配置项目经理 AI", size: 13, weight: .regular, alpha: 0.35)

        emptyState.addSubview(plusBtn)
        emptyState.addSubview(hint)

        NSLayoutConstraint.activate([
            emptyState.topAnchor.constraint(equalTo: headerView.bottomAnchor),
            emptyState.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            emptyState.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            emptyState.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            plusBtn.centerXAnchor.constraint(equalTo: emptyState.centerXAnchor),
            plusBtn.centerYAnchor.constraint(equalTo: emptyState.centerYAnchor, constant: -16),
            hint.centerXAnchor.constraint(equalTo: emptyState.centerXAnchor),
            hint.topAnchor.constraint(equalTo: plusBtn.bottomAnchor, constant: 12),
        ])
    }

    private func buildChatUI() {
        chatContainer.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(chatContainer)

        let scroll = NSTextView.scrollableTextView()
        chatTextView = scroll.documentView as? NSTextView
        chatTextView.isEditable = false
        chatTextView.backgroundColor = .clear
        chatTextView.font = .systemFont(ofSize: 13)
        chatTextView.textContainerInset = NSSize(width: 12, height: 12)
        scroll.drawsBackground = false
        scroll.translatesAutoresizingMaskIntoConstraints = false

        inputField.placeholderString = "和项目经理说点什么... (⌘↩ 发送)"
        inputField.translatesAutoresizingMaskIntoConstraints = false

        sendBtn.title = "发送"
        sendBtn.bezelStyle = .rounded
        sendBtn.target = self
        sendBtn.action = #selector(sendMessage)
        sendBtn.translatesAutoresizingMaskIntoConstraints = false

        let divider = hLine(alpha: 0.08)
        [scroll, divider, inputField, sendBtn].forEach { chatContainer.addSubview($0) }

        NSLayoutConstraint.activate([
            chatContainer.topAnchor.constraint(equalTo: headerView.bottomAnchor),
            chatContainer.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            chatContainer.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            chatContainer.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            scroll.topAnchor.constraint(equalTo: chatContainer.topAnchor),
            scroll.leadingAnchor.constraint(equalTo: chatContainer.leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo: chatContainer.trailingAnchor),
            scroll.bottomAnchor.constraint(equalTo: divider.topAnchor),

            divider.leadingAnchor.constraint(equalTo: chatContainer.leadingAnchor),
            divider.trailingAnchor.constraint(equalTo: chatContainer.trailingAnchor),
            divider.bottomAnchor.constraint(equalTo: inputField.topAnchor, constant: -10),
            divider.heightAnchor.constraint(equalToConstant: 1),

            inputField.leadingAnchor.constraint(equalTo: chatContainer.leadingAnchor, constant: 12),
            inputField.trailingAnchor.constraint(equalTo: sendBtn.leadingAnchor, constant: -8),
            inputField.bottomAnchor.constraint(equalTo: chatContainer.bottomAnchor, constant: -14),
            inputField.heightAnchor.constraint(equalToConstant: 28),

            sendBtn.trailingAnchor.constraint(equalTo: chatContainer.trailingAnchor, constant: -12),
            sendBtn.centerYAnchor.constraint(equalTo: inputField.centerYAnchor),
            sendBtn.widthAnchor.constraint(equalToConstant: 60),
        ])
    }

    private func setMode(empty: Bool) {
        emptyState.isHidden   = !empty
        chatContainer.isHidden = empty
        resetBtn.isHidden      = empty
    }

    // MARK: - Actions

    @objc private func pickAgent() {
        AIPickerPopover.show(relativeTo: view.bounds, of: view) { [weak self] cfg in
            self?.configure(with: cfg)
        }
    }

    private func configure(with cfg: AIConfig) {
        agentConfig = cfg
        agentNameLabel.stringValue = "\(cfg.icon) \(cfg.name)"
        statusDot.layer?.backgroundColor = NSColor.systemGreen.cgColor
        setMode(empty: false)
        let welcome = ChatMessage(
            role: .assistant,
            content: "你好！我是项目经理 \(cfg.name)。请告诉我需求，我来拆解任务并协调开发团队。",
            timestamp: Date()
        )
        messages = [welcome]
        refreshChat()
    }

    @objc private func resetAgent() {
        agentConfig = nil
        messages = []
        agentNameLabel.stringValue = "未配置"
        statusDot.layer?.backgroundColor = NSColor.systemGray.cgColor
        chatTextView.string = ""
        setMode(empty: true)
    }

    @objc private func sendMessage() {
        let text = inputField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, let cfg = agentConfig else { return }
        inputField.stringValue = ""
        messages.append(ChatMessage(role: .user, content: text, timestamp: Date()))
        refreshChat()

        let mockReplies = [
            "收到！正在将任务拆解为子任务，并分配给开发团队...",
            "好的，这个需求涉及多个模块，我已将优先级评估完毕。",
            "明白，我会先让程序员 A 完成核心逻辑，再进入验收环节。",
            "已更新任务优先级，程序员正在处理，预计 2 个迭代完成。",
        ]
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { [weak self] in
            guard let self = self else { return }
            self.messages.append(ChatMessage(
                role: .assistant,
                content: "[\(cfg.name)]: \(mockReplies.randomElement()!)",
                timestamp: Date()
            ))
            self.refreshChat()
        }
    }

    private func refreshChat() {
        let attr = NSMutableAttributedString()
        let fmt = DateFormatter(); fmt.dateFormat = "HH:mm"
        for msg in messages {
            let isUser = msg.role == .user
            attr.append(NSAttributedString(string: (isUser ? "你" : "AI") + "  \(fmt.string(from: msg.timestamp))\n",
                attributes: [.font: NSFont.systemFont(ofSize: 10), .foregroundColor: NSColor(white: 1, alpha: 0.28)]))
            attr.append(NSAttributedString(string: msg.content + "\n\n",
                attributes: [.font: NSFont.systemFont(ofSize: 13),
                             .foregroundColor: isUser ? NSColor.white : NSColor(red: 0.55, green: 0.88, blue: 1, alpha: 1)]))
        }
        chatTextView.textStorage?.setAttributedString(attr)
        chatTextView.scrollToEndOfDocument(nil)
    }

    // MARK: - Helpers
    private func label(_ s: String, size: CGFloat, weight: NSFont.Weight, alpha: CGFloat = 1) -> NSTextField {
        let l = NSTextField(labelWithString: s)
        l.font = .systemFont(ofSize: size, weight: weight)
        l.textColor = NSColor(white: 1, alpha: alpha)
        l.translatesAutoresizingMaskIntoConstraints = false
        return l
    }
    private func hLine(alpha: CGFloat) -> NSView {
        let v = NSView(); v.wantsLayer = true
        v.layer?.backgroundColor = NSColor(white: 1, alpha: alpha).cgColor
        v.translatesAutoresizingMaskIntoConstraints = false
        return v
    }
}

// MARK: - Center Workspace

final class CenterWorkspaceViewController: NSViewController {

    private let devVC    = DevPanelViewController()
    private let reviewVC = ReviewPanelViewController()

    override func loadView() { view = NSView() }

    override func viewDidLoad() {
        super.viewDidLoad()
        let split = NSSplitView()
        split.isVertical = false
        split.dividerStyle = .thin
        split.translatesAutoresizingMaskIntoConstraints = false

        [devVC, reviewVC].forEach {
            addChild($0)
            $0.view.translatesAutoresizingMaskIntoConstraints = false
            split.addArrangedSubview($0.view)
        }
        view.addSubview(split)

        NSLayoutConstraint.activate([
            split.topAnchor.constraint(equalTo: view.topAnchor),
            split.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            split.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            split.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            reviewVC.view.heightAnchor.constraint(equalToConstant: 270),
        ])
    }
}

// MARK: - Dev Panel

final class DevPanelViewController: NSViewController {

    private struct DevAgent {
        let config: AIConfig
        var status: AgentStatus
        var messages: [ChatMessage]
    }

    private var agents: [DevAgent] = [
        DevAgent(
            config: AIConfig.mockList[1],
            status: .working,
            messages: [ChatMessage(role: .assistant,
                                   content: "[Claude 3.5]: 收到任务，正在分析代码结构，开始编写代码...",
                                   timestamp: Date())]
        )
    ]

    private var cardsStack: NSStackView!
    private var headerCountLabel: NSTextField!

    override func loadView() { view = NSView() }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor(red: 0.12, green: 0.13, blue: 0.15, alpha: 1).cgColor
        buildHeader()
        buildScrollArea()
    }

    private func buildHeader() {
        let hdr = NSView()
        hdr.wantsLayer = true
        hdr.layer?.backgroundColor = NSColor(red: 0.16, green: 0.17, blue: 0.19, alpha: 1).cgColor
        hdr.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(hdr)

        let titleLbl = labelW("👨‍💻  程序员", size: 13, weight: .semibold)
        headerCountLabel = labelW("\(agents.count) 个 AI", size: 11, weight: .regular, alpha: 0.4)
        let border = hLineW(alpha: 0.08)
        [titleLbl, headerCountLabel, border].forEach { hdr.addSubview($0) }

        NSLayoutConstraint.activate([
            hdr.topAnchor.constraint(equalTo: view.topAnchor),
            hdr.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            hdr.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            hdr.heightAnchor.constraint(equalToConstant: 44),
            titleLbl.leadingAnchor.constraint(equalTo: hdr.leadingAnchor, constant: 16),
            titleLbl.centerYAnchor.constraint(equalTo: hdr.centerYAnchor),
            headerCountLabel.leadingAnchor.constraint(equalTo: titleLbl.trailingAnchor, constant: 8),
            headerCountLabel.centerYAnchor.constraint(equalTo: hdr.centerYAnchor),
            border.leadingAnchor.constraint(equalTo: hdr.leadingAnchor),
            border.trailingAnchor.constraint(equalTo: hdr.trailingAnchor),
            border.bottomAnchor.constraint(equalTo: hdr.bottomAnchor),
            border.heightAnchor.constraint(equalToConstant: 1),
        ])

        let scroll = NSScrollView()
        scroll.drawsBackground = false
        scroll.hasHorizontalScroller = true
        scroll.hasVerticalScroller = false
        scroll.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scroll)

        cardsStack = NSStackView()
        cardsStack.orientation = .horizontal
        cardsStack.spacing = 14
        cardsStack.edgeInsets = NSEdgeInsets(top: 14, left: 14, bottom: 14, right: 14)
        cardsStack.translatesAutoresizingMaskIntoConstraints = false
        scroll.documentView = cardsStack

        NSLayoutConstraint.activate([
            scroll.topAnchor.constraint(equalTo: hdr.bottomAnchor),
            scroll.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scroll.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            cardsStack.topAnchor.constraint(equalTo: scroll.contentView.topAnchor),
            cardsStack.leadingAnchor.constraint(equalTo: scroll.contentView.leadingAnchor),
            cardsStack.bottomAnchor.constraint(equalTo: scroll.contentView.bottomAnchor),
        ])

        rebuildCards()
    }

    private func buildScrollArea() {}

    private func rebuildCards() {
        cardsStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
        headerCountLabel.stringValue = "\(agents.count) 个 AI"

        for (i, agent) in agents.enumerated() {
            let card = DevAgentCard(config: agent.config, status: agent.status, messages: agent.messages)
            card.translatesAutoresizingMaskIntoConstraints = false
            card.widthAnchor.constraint(equalToConstant: 240).isActive = true
            card.onSend = { [weak self] text in self?.handleSend(text, index: i) }
            cardsStack.addArrangedSubview(card)
        }

        let addCard = ConsoleAddCard(label: "添加程序员 AI")
        addCard.translatesAutoresizingMaskIntoConstraints = false
        addCard.widthAnchor.constraint(equalToConstant: 150).isActive = true
        addCard.onAdd = { [weak self] in self?.addAgent() }
        cardsStack.addArrangedSubview(addCard)
    }

    private func addAgent() {
        AIPickerPopover.show(relativeTo: view.bounds, of: view) { [weak self] cfg in
            guard let self = self else { return }
            self.agents.append(DevAgent(
                config: cfg, status: .idle,
                messages: [ChatMessage(role: .assistant,
                                       content: "[\(cfg.name)]: 已就绪，等待任务分配。",
                                       timestamp: Date())]
            ))
            self.rebuildCards()
        }
    }

    private func handleSend(_ text: String, index: Int) {
        guard agents.indices.contains(index) else { return }
        agents[index].messages.append(ChatMessage(role: .user, content: text, timestamp: Date()))

        let name = agents[index].config.name
        let replies = [
            "[\(name)]: 收到，正在处理...",
            "[\(name)]: 好的，这个功能需要修改以下文件...",
            "[\(name)]: 代码已完成，请审查。",
            "[\(name)]: 遇到问题，需要确认需求细节。",
        ]
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { [weak self] in
            guard let self = self else { return }
            self.agents[index].messages.append(
                ChatMessage(role: .assistant, content: replies.randomElement()!, timestamp: Date())
            )
            self.rebuildCards()
        }
    }

    private func labelW(_ s: String, size: CGFloat, weight: NSFont.Weight, alpha: CGFloat = 1) -> NSTextField {
        let l = NSTextField(labelWithString: s)
        l.font = .systemFont(ofSize: size, weight: weight)
        l.textColor = NSColor(white: 1, alpha: alpha)
        l.translatesAutoresizingMaskIntoConstraints = false
        return l
    }
    private func hLineW(alpha: CGFloat) -> NSView {
        let v = NSView(); v.wantsLayer = true
        v.layer?.backgroundColor = NSColor(white: 1, alpha: alpha).cgColor
        v.translatesAutoresizingMaskIntoConstraints = false
        return v
    }
}

// MARK: - Dev Agent Card

final class DevAgentCard: NSView {

    var onSend: ((String) -> Void)?

    private let cfg: AIConfig
    private let status: AgentStatus
    private let msgs: [ChatMessage]
    private var chatTV: NSTextView!
    private let input = ConsoleTextField()

    init(config: AIConfig, status: AgentStatus, messages: [ChatMessage]) {
        self.cfg = config; self.status = status; self.msgs = messages
        super.init(frame: .zero)
        build()
    }
    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    private func build() {
        wantsLayer = true
        layer?.backgroundColor = NSColor(red: 0.17, green: 0.19, blue: 0.21, alpha: 1).cgColor
        layer?.cornerRadius = 10
        layer?.borderWidth = 1
        layer?.borderColor = NSColor(white: 1, alpha: 0.09).cgColor

        let icon = lbl(cfg.icon + " " + cfg.name, size: 13, weight: .semibold)
        let badge = StatusBadge(status: status)
        badge.translatesAutoresizingMaskIntoConstraints = false

        let scroll = NSTextView.scrollableTextView()
        chatTV = scroll.documentView as? NSTextView
        chatTV.isEditable = false
        chatTV.backgroundColor = .clear
        chatTV.font = .systemFont(ofSize: 11)
        chatTV.textContainerInset = NSSize(width: 8, height: 6)
        scroll.drawsBackground = false
        scroll.translatesAutoresizingMaskIntoConstraints = false

        input.placeholderString = "回复..."
        input.translatesAutoresizingMaskIntoConstraints = false

        let sendBtn = NSButton()
        if #available(macOS 11.0, *) {
            sendBtn.image = NSImage(systemSymbolName: "paperplane.fill", accessibilityDescription: "发送")
        } else { sendBtn.title = "↑" }
        sendBtn.isBordered = false
        sendBtn.contentTintColor = .systemBlue
        sendBtn.target = self
        sendBtn.action = #selector(sendTapped)
        sendBtn.translatesAutoresizingMaskIntoConstraints = false

        let div = NSView(); div.wantsLayer = true
        div.layer?.backgroundColor = NSColor(white: 1, alpha: 0.08).cgColor
        div.translatesAutoresizingMaskIntoConstraints = false

        [icon, badge, scroll, div, input, sendBtn].forEach { addSubview($0) }

        // Fill chat
        let attr = NSMutableAttributedString()
        for m in msgs {
            let c: NSColor = m.role == .user ? .white : NSColor(red: 0.55, green: 0.88, blue: 1, alpha: 1)
            attr.append(NSAttributedString(string: m.content + "\n",
                attributes: [.font: NSFont.systemFont(ofSize: 11), .foregroundColor: c]))
        }
        chatTV.textStorage?.setAttributedString(attr)

        NSLayoutConstraint.activate([
            icon.topAnchor.constraint(equalTo: topAnchor, constant: 12),
            icon.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),

            badge.centerYAnchor.constraint(equalTo: icon.centerYAnchor),
            badge.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -10),

            scroll.topAnchor.constraint(equalTo: icon.bottomAnchor, constant: 8),
            scroll.leadingAnchor.constraint(equalTo: leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo: trailingAnchor),
            scroll.bottomAnchor.constraint(equalTo: div.topAnchor),

            div.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 8),
            div.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -8),
            div.bottomAnchor.constraint(equalTo: input.topAnchor, constant: -8),
            div.heightAnchor.constraint(equalToConstant: 1),

            input.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 10),
            input.trailingAnchor.constraint(equalTo: sendBtn.leadingAnchor, constant: -6),
            input.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -12),
            input.heightAnchor.constraint(equalToConstant: 26),

            sendBtn.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -10),
            sendBtn.centerYAnchor.constraint(equalTo: input.centerYAnchor),
            sendBtn.widthAnchor.constraint(equalToConstant: 22),
            sendBtn.heightAnchor.constraint(equalToConstant: 22),
        ])
    }

    @objc private func sendTapped() {
        let t = input.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else { return }
        input.stringValue = ""
        onSend?(t)
    }

    private func lbl(_ s: String, size: CGFloat, weight: NSFont.Weight) -> NSTextField {
        let l = NSTextField(labelWithString: s)
        l.font = .systemFont(ofSize: size, weight: weight)
        l.textColor = .white
        l.translatesAutoresizingMaskIntoConstraints = false
        return l
    }
}

// MARK: - Review Panel

final class ReviewPanelViewController: NSViewController {

    private var aiConfig: AIConfig?
    private var reviewTV: NSTextView!
    private var aiResultTV: NSTextView!
    private let configAIBtn  = NSButton()
    private let startBtn     = NSButton()
    private let aiStatusLbl  = NSTextField(labelWithString: "")

    override func loadView() { view = NSView() }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor(red: 0.13, green: 0.14, blue: 0.16, alpha: 1).cgColor
        build()
    }

    private func build() {
        // Header
        let hdr = NSView()
        hdr.wantsLayer = true
        hdr.layer?.backgroundColor = NSColor(red: 0.16, green: 0.17, blue: 0.19, alpha: 1).cgColor
        hdr.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(hdr)

        let title = makeLabel("✅  验收", size: 13, weight: .semibold)
        let border = hLine(alpha: 0.08)
        [title, border].forEach { hdr.addSubview($0) }

        // Two columns
        let humanCol = buildHumanCol()
        let aiCol    = buildAICol()
        let divider  = NSView()
        divider.wantsLayer = true
        divider.layer?.backgroundColor = NSColor(white: 1, alpha: 0.1).cgColor
        divider.translatesAutoresizingMaskIntoConstraints = false

        [humanCol, divider, aiCol].forEach { view.addSubview($0) }

        NSLayoutConstraint.activate([
            hdr.topAnchor.constraint(equalTo: view.topAnchor),
            hdr.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            hdr.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            hdr.heightAnchor.constraint(equalToConstant: 44),
            title.leadingAnchor.constraint(equalTo: hdr.leadingAnchor, constant: 16),
            title.centerYAnchor.constraint(equalTo: hdr.centerYAnchor),
            border.leadingAnchor.constraint(equalTo: hdr.leadingAnchor),
            border.trailingAnchor.constraint(equalTo: hdr.trailingAnchor),
            border.bottomAnchor.constraint(equalTo: hdr.bottomAnchor),
            border.heightAnchor.constraint(equalToConstant: 1),

            humanCol.topAnchor.constraint(equalTo: hdr.bottomAnchor),
            humanCol.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            humanCol.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            humanCol.widthAnchor.constraint(equalTo: view.widthAnchor, multiplier: 0.5, constant: -0.5),

            divider.topAnchor.constraint(equalTo: hdr.bottomAnchor),
            divider.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            divider.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            divider.widthAnchor.constraint(equalToConstant: 1),

            aiCol.topAnchor.constraint(equalTo: hdr.bottomAnchor),
            aiCol.leadingAnchor.constraint(equalTo: divider.trailingAnchor),
            aiCol.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            aiCol.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
    }

    private func buildHumanCol() -> NSView {
        let col = NSView(); col.translatesAutoresizingMaskIntoConstraints = false
        let title = makeLabel("人工验收", size: 12, weight: .semibold, alpha: 0.7)
        let scroll = NSTextView.scrollableTextView()
        reviewTV = scroll.documentView as? NSTextView
        reviewTV.font = .systemFont(ofSize: 12)
        reviewTV.backgroundColor = NSColor(red: 0.09, green: 0.10, blue: 0.12, alpha: 1)
        reviewTV.textColor = .white
        reviewTV.textContainerInset = NSSize(width: 8, height: 8)
        reviewTV.insertionPointColor = .white
        scroll.translatesAutoresizingMaskIntoConstraints = false
        scroll.wantsLayer = true; scroll.layer?.cornerRadius = 6

        let submit = NSButton(); submit.title = "提交验收"; submit.bezelStyle = .rounded
        submit.target = self; submit.action = #selector(submitHuman)
        submit.translatesAutoresizingMaskIntoConstraints = false

        [title, scroll, submit].forEach { col.addSubview($0) }
        NSLayoutConstraint.activate([
            title.topAnchor.constraint(equalTo: col.topAnchor, constant: 12),
            title.leadingAnchor.constraint(equalTo: col.leadingAnchor, constant: 14),
            scroll.topAnchor.constraint(equalTo: title.bottomAnchor, constant: 8),
            scroll.leadingAnchor.constraint(equalTo: col.leadingAnchor, constant: 12),
            scroll.trailingAnchor.constraint(equalTo: col.trailingAnchor, constant: -12),
            scroll.bottomAnchor.constraint(equalTo: submit.topAnchor, constant: -10),
            submit.leadingAnchor.constraint(equalTo: col.leadingAnchor, constant: 12),
            submit.bottomAnchor.constraint(equalTo: col.bottomAnchor, constant: -12),
        ])
        return col
    }

    private func buildAICol() -> NSView {
        let col = NSView(); col.translatesAutoresizingMaskIntoConstraints = false
        let title = makeLabel("AI 验收", size: 12, weight: .semibold, alpha: 0.7)
        aiStatusLbl.font = .systemFont(ofSize: 11)
        aiStatusLbl.textColor = NSColor(white: 1, alpha: 0.4)
        aiStatusLbl.translatesAutoresizingMaskIntoConstraints = false

        configAIBtn.title = "+ 配置 AI 验收"; configAIBtn.bezelStyle = .rounded
        configAIBtn.target = self; configAIBtn.action = #selector(configAI)
        configAIBtn.translatesAutoresizingMaskIntoConstraints = false

        startBtn.title = "▶ 开始 AI 验收"; startBtn.bezelStyle = .rounded
        startBtn.target = self; startBtn.action = #selector(startAI)
        startBtn.isHidden = true; startBtn.translatesAutoresizingMaskIntoConstraints = false

        let scroll = NSTextView.scrollableTextView()
        aiResultTV = scroll.documentView as? NSTextView
        aiResultTV.isEditable = false
        aiResultTV.backgroundColor = NSColor(red: 0.09, green: 0.10, blue: 0.12, alpha: 1)
        aiResultTV.textColor = NSColor(red: 0.55, green: 0.88, blue: 1, alpha: 1)
        aiResultTV.font = .systemFont(ofSize: 12)
        aiResultTV.textContainerInset = NSSize(width: 8, height: 8)
        scroll.translatesAutoresizingMaskIntoConstraints = false
        scroll.wantsLayer = true; scroll.layer?.cornerRadius = 6

        [title, aiStatusLbl, configAIBtn, startBtn, scroll].forEach { col.addSubview($0) }
        NSLayoutConstraint.activate([
            title.topAnchor.constraint(equalTo: col.topAnchor, constant: 12),
            title.leadingAnchor.constraint(equalTo: col.leadingAnchor, constant: 14),
            aiStatusLbl.centerYAnchor.constraint(equalTo: title.centerYAnchor),
            aiStatusLbl.leadingAnchor.constraint(equalTo: title.trailingAnchor, constant: 8),
            configAIBtn.topAnchor.constraint(equalTo: title.bottomAnchor, constant: 8),
            configAIBtn.leadingAnchor.constraint(equalTo: col.leadingAnchor, constant: 12),
            startBtn.topAnchor.constraint(equalTo: title.bottomAnchor, constant: 8),
            startBtn.leadingAnchor.constraint(equalTo: col.leadingAnchor, constant: 12),
            scroll.topAnchor.constraint(equalTo: configAIBtn.bottomAnchor, constant: 10),
            scroll.leadingAnchor.constraint(equalTo: col.leadingAnchor, constant: 12),
            scroll.trailingAnchor.constraint(equalTo: col.trailingAnchor, constant: -12),
            scroll.bottomAnchor.constraint(equalTo: col.bottomAnchor, constant: -12),
        ])
        return col
    }

    @objc private func submitHuman() {
        let text = reviewTV.string.trimmingCharacters(in: .whitespacesAndNewlines)
        let alert = NSAlert()
        if text.isEmpty {
            alert.messageText = "验收意见为空"
            alert.informativeText = "请输入验收意见后再提交。"
        } else {
            alert.messageText = "验收意见已提交"
            alert.informativeText = String(text.prefix(80))
        }
        alert.runModal()
    }

    @objc private func configAI() {
        AIPickerPopover.show(relativeTo: view.bounds, of: view) { [weak self] cfg in
            guard let self = self else { return }
            self.aiConfig = cfg
            self.aiStatusLbl.stringValue = "\(cfg.icon) \(cfg.name)"
            self.configAIBtn.isHidden = true
            self.startBtn.isHidden = false
        }
    }

    @objc private func startAI() {
        guard let cfg = aiConfig else { return }
        aiResultTV.string = "[\(cfg.name)] 正在分析中...\n"
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { [weak self] in
            self?.aiResultTV.string = """
            [\(cfg.name)] 代码审查报告
            ─────────────────────────
            ✅ 整体结构符合规范
            ⚠️  发现 2 处潜在问题：
              1. 变量命名不规范（建议驼峰命名）
              2. 缺少错误处理（网络请求未捕获异常）
            
            📝 建议修改后重新提交。
               预计影响范围：中等
            ─────────────────────────
            验收状态：需要修改
            """
        }
    }

    private func makeLabel(_ s: String, size: CGFloat, weight: NSFont.Weight, alpha: CGFloat = 1) -> NSTextField {
        let l = NSTextField(labelWithString: s)
        l.font = .systemFont(ofSize: size, weight: weight)
        l.textColor = NSColor(white: 1, alpha: alpha)
        l.translatesAutoresizingMaskIntoConstraints = false
        return l
    }
    private func hLine(alpha: CGFloat) -> NSView {
        let v = NSView(); v.wantsLayer = true
        v.layer?.backgroundColor = NSColor(white: 1, alpha: alpha).cgColor
        v.translatesAutoresizingMaskIntoConstraints = false
        return v
    }
}

// MARK: - Log Panel (Right)

final class LogPanelViewController: NSViewController {

    private var logTV: NSTextView!

    override func loadView() { view = NSView() }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor(red: 0.10, green: 0.11, blue: 0.13, alpha: 1).cgColor
        build()
        seedLogs()
    }

    private func build() {
        let hdr = NSView(); hdr.wantsLayer = true
        hdr.layer?.backgroundColor = NSColor(red: 0.14, green: 0.15, blue: 0.17, alpha: 1).cgColor
        hdr.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(hdr)

        let title = NSTextField(labelWithString: "📋  消息流")
        title.font = .systemFont(ofSize: 12, weight: .semibold)
        title.textColor = .white
        title.translatesAutoresizingMaskIntoConstraints = false
        hdr.addSubview(title)

        let border = NSView(); border.wantsLayer = true
        border.layer?.backgroundColor = NSColor(white: 1, alpha: 0.08).cgColor
        border.translatesAutoresizingMaskIntoConstraints = false
        hdr.addSubview(border)

        let scroll = NSTextView.scrollableTextView()
        logTV = scroll.documentView as? NSTextView
        logTV.isEditable = false
        logTV.backgroundColor = .clear
        logTV.font = .monospacedSystemFont(ofSize: 11, weight: .regular)
        logTV.textColor = NSColor(white: 1, alpha: 0.6)
        logTV.textContainerInset = NSSize(width: 10, height: 10)
        scroll.drawsBackground = false
        scroll.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scroll)

        NSLayoutConstraint.activate([
            hdr.topAnchor.constraint(equalTo: view.topAnchor),
            hdr.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            hdr.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            hdr.heightAnchor.constraint(equalToConstant: 44),
            title.leadingAnchor.constraint(equalTo: hdr.leadingAnchor, constant: 14),
            title.centerYAnchor.constraint(equalTo: hdr.centerYAnchor),
            border.leadingAnchor.constraint(equalTo: hdr.leadingAnchor),
            border.trailingAnchor.constraint(equalTo: hdr.trailingAnchor),
            border.bottomAnchor.constraint(equalTo: hdr.bottomAnchor),
            border.heightAnchor.constraint(equalToConstant: 1),
            scroll.topAnchor.constraint(equalTo: hdr.bottomAnchor),
            scroll.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scroll.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
    }

    private func seedLogs() {
        let entries: [(String, String, NSColor, String)] = [
            ("14:01", "SYS", .systemGray,   "AI 控制台已启动"),
            ("14:02", "PM",  .systemBlue,   "等待配置项目经理 AI"),
            ("14:03", "Dev", .systemGreen,  "Claude 3.5 已就绪"),
            ("14:05", "Dev", .systemGreen,  "收到任务：实现 UI 界面"),
            ("14:06", "Dev", .systemGreen,  "分析代码结构..."),
            ("14:07", "Dev", .systemYellow, "正在生成代码..."),
            ("14:08", "PM",  .systemBlue,   "等待程序员完成任务"),
        ]
        let attr = NSMutableAttributedString()
        for (time, role, color, msg) in entries {
            attr.append(NSAttributedString(string: "\(time) ",
                attributes: [.font: NSFont.monospacedSystemFont(ofSize: 10, weight: .regular),
                             .foregroundColor: NSColor(white: 1, alpha: 0.25)]))
            attr.append(NSAttributedString(string: "[\(role)] ",
                attributes: [.font: NSFont.monospacedSystemFont(ofSize: 10, weight: .bold),
                             .foregroundColor: color]))
            attr.append(NSAttributedString(string: "\(msg)\n",
                attributes: [.font: NSFont.monospacedSystemFont(ofSize: 11, weight: .regular),
                             .foregroundColor: NSColor(white: 1, alpha: 0.6)]))
        }
        logTV.textStorage?.setAttributedString(attr)
    }
}

// MARK: - AI Picker Popover

final class AIPickerPopover: NSViewController {

    var onSelect: ((AIConfig) -> Void)?

    static func show(relativeTo rect: NSRect, of view: NSView, completion: @escaping (AIConfig) -> Void) {
        let vc = AIPickerPopover()
        vc.onSelect = completion
        let pop = NSPopover()
        pop.contentViewController = vc
        pop.behavior = .transient
        pop.contentSize = NSSize(width: 280, height: 310)
        pop.show(relativeTo: rect, of: view, preferredEdge: .maxY)
    }

    override func loadView() { view = NSView() }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor(red: 0.16, green: 0.17, blue: 0.19, alpha: 1).cgColor

        let title = NSTextField(labelWithString: "选择 AI 配置")
        title.font = .systemFont(ofSize: 14, weight: .semibold)
        title.textColor = .white
        title.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(title)

        let stack = NSStackView()
        stack.orientation = .vertical
        stack.spacing = 4
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)

        for cfg in AIConfig.mockList {
            let row = AIPickerRow(config: cfg) { [weak self] in
                self?.onSelect?(cfg)
                self?.dismiss(nil)
            }
            row.translatesAutoresizingMaskIntoConstraints = false
            row.heightAnchor.constraint(equalToConstant: 46).isActive = true
            stack.addArrangedSubview(row)
        }

        NSLayoutConstraint.activate([
            title.topAnchor.constraint(equalTo: view.topAnchor, constant: 16),
            title.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            stack.topAnchor.constraint(equalTo: title.bottomAnchor, constant: 10),
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 8),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -8),
        ])
    }
}

final class AIPickerRow: NSView {

    private let tap: () -> Void

    init(config: AIConfig, onTap: @escaping () -> Void) {
        self.tap = onTap
        super.init(frame: .zero)
        wantsLayer = true
        layer?.cornerRadius = 8

        let nameLbl = NSTextField(labelWithString: config.icon + "  " + config.name)
        nameLbl.font = .systemFont(ofSize: 13, weight: .medium)
        nameLbl.textColor = .white
        nameLbl.translatesAutoresizingMaskIntoConstraints = false

        let provLbl = NSTextField(labelWithString: config.provider)
        provLbl.font = .systemFont(ofSize: 11)
        provLbl.textColor = NSColor(white: 1, alpha: 0.4)
        provLbl.translatesAutoresizingMaskIntoConstraints = false

        addSubview(nameLbl); addSubview(provLbl)
        NSLayoutConstraint.activate([
            nameLbl.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),
            nameLbl.centerYAnchor.constraint(equalTo: centerYAnchor, constant: -7),
            provLbl.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),
            provLbl.centerYAnchor.constraint(equalTo: centerYAnchor, constant: 9),
        ])
        addGestureRecognizer(NSClickGestureRecognizer(target: self, action: #selector(tapped)))
    }
    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    @objc private func tapped() { tap() }

    override func mouseEntered(with event: NSEvent) { layer?.backgroundColor = NSColor(white: 1, alpha: 0.08).cgColor }
    override func mouseExited(with event: NSEvent)  { layer?.backgroundColor = nil }
    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        trackingAreas.forEach { removeTrackingArea($0) }
        addTrackingArea(NSTrackingArea(rect: bounds, options: [.mouseEnteredAndExited, .activeInActiveApp], owner: self))
    }
}

// MARK: - Shared Components

final class ConsolePlusButton: NSButton {
    init(size: CGFloat = 44) {
        super.init(frame: NSRect(x: 0, y: 0, width: size, height: size))
        title = "+"
        font = .systemFont(ofSize: size * 0.45, weight: .light)
        wantsLayer = true
        layer?.cornerRadius = size / 2
        layer?.backgroundColor = NSColor(white: 1, alpha: 0.09).cgColor
        layer?.borderColor = NSColor(white: 1, alpha: 0.2).cgColor
        layer?.borderWidth = 1.5
        isBordered = false
        contentTintColor = NSColor(white: 1, alpha: 0.55)
        translatesAutoresizingMaskIntoConstraints = false
        widthAnchor.constraint(equalToConstant: size).isActive = true
        heightAnchor.constraint(equalToConstant: size).isActive = true
    }
    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }
}

final class ConsoleAddCard: NSView {
    var onAdd: (() -> Void)?
    private let cardLabel: String

    init(label: String) {
        self.cardLabel = label
        super.init(frame: .zero)
        build()
    }
    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    private func build() {
        wantsLayer = true
        layer?.cornerRadius = 10
        layer?.borderWidth = 1.5
        layer?.borderColor = NSColor(white: 1, alpha: 0.13).cgColor

        let btn = ConsolePlusButton(size: 34)
        btn.target = self; btn.action = #selector(addTapped)
        btn.translatesAutoresizingMaskIntoConstraints = false
        addSubview(btn)

        let lbl = NSTextField(labelWithString: cardLabel)
        lbl.font = .systemFont(ofSize: 11)
        lbl.textColor = NSColor(white: 1, alpha: 0.32)
        lbl.translatesAutoresizingMaskIntoConstraints = false
        addSubview(lbl)

        NSLayoutConstraint.activate([
            btn.centerXAnchor.constraint(equalTo: centerXAnchor),
            btn.centerYAnchor.constraint(equalTo: centerYAnchor, constant: -12),
            lbl.centerXAnchor.constraint(equalTo: centerXAnchor),
            lbl.topAnchor.constraint(equalTo: btn.bottomAnchor, constant: 8),
        ])
    }
    @objc private func addTapped() { onAdd?() }
}

final class StatusBadge: NSView {
    init(status: AgentStatus) {
        super.init(frame: .zero)
        wantsLayer = true
        layer?.cornerRadius = 4
        layer?.backgroundColor = status.color.withAlphaComponent(0.18).cgColor
        layer?.borderColor = status.color.withAlphaComponent(0.45).cgColor
        layer?.borderWidth = 1

        let lbl = NSTextField(labelWithString: status.label)
        lbl.font = .systemFont(ofSize: 9, weight: .semibold)
        lbl.textColor = status.color
        lbl.translatesAutoresizingMaskIntoConstraints = false
        addSubview(lbl)
        translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            lbl.topAnchor.constraint(equalTo: topAnchor, constant: 2),
            lbl.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 5),
            lbl.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -5),
            lbl.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -2),
        ])
    }
    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }
}

final class ConsoleTextField: NSTextField {

    override init(frame: NSRect) {
        super.init(frame: frame)
        applyStyle()
    }
    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    private func applyStyle() {
        wantsLayer = true
        layer?.cornerRadius = 6
        layer?.backgroundColor = NSColor(red: 0.10, green: 0.11, blue: 0.13, alpha: 1).cgColor
        layer?.borderColor = NSColor(white: 1, alpha: 0.12).cgColor
        layer?.borderWidth = 1
        textColor = .white
        isBezeled = false
        focusRingType = .none
    }

    // Apply dim placeholder color whenever placeholderString is set
    override var placeholderString: String? {
        didSet {
            if let v = placeholderString {
                (cell as? NSTextFieldCell)?.placeholderAttributedString = NSAttributedString(
                    string: v,
                    attributes: [
                        .foregroundColor: NSColor(white: 1, alpha: 0.3),
                        .font: NSFont.systemFont(ofSize: 12)
                    ]
                )
            }
        }
    }
}
