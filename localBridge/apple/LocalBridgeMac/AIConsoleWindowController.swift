import AppKit

// MARK: - Color Constants
extension NSColor {
    static let consoleZ950 = NSColor(hex: "#09090B")  // 最深背景
    static let consoleZ900 = NSColor(hex: "#18181B")  // 主背景
    static let consoleZ800 = NSColor(hex: "#27272A")  // 次级背景
    static let consoleZ700 = NSColor(hex: "#3F3F46")  // 边框 hover
    
    static let consoleText  = NSColor(hex: "#FAFAFA")  // 主文字
    static let consoleText2 = NSColor(hex: "#A1A1AA")  // 次级文字
    static let consoleText3 = NSColor(hex: "#71717A")  // 第三级文字
    
    static let consolePM    = NSColor(hex: "#A855F7")  // 项目经理 紫
    static let consoleDev   = NSColor(hex: "#3B82F6")  // 开发 蓝
    static let consoleQA    = NSColor(hex: "#22C55E")  // 验收 绿
    static let consoleHuman = NSColor(hex: "#F97316")  // 人类 橙
    
    static let consoleBlue      = NSColor(hex: "#3B82F6")
    static let consoleBlueDark  = NSColor(hex: "#2563EB")
    static let consoleGreen     = NSColor(hex: "#22C55E")
    static let consoleYellow    = NSColor(hex: "#FACC15")
    static let consoleRed       = NSColor(hex: "#EF4444")

    convenience init(hex: String) {
        var hexSanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        if hexSanitized.hasPrefix("#") {
            hexSanitized.remove(at: hexSanitized.startIndex)
        }
        var rgb: UInt64 = 0
        Scanner(string: hexSanitized).scanHexInt64(&rgb)
        let r = CGFloat((rgb & 0xFF0000) >> 16) / 255.0
        let g = CGFloat((rgb & 0x00FF00) >> 8) / 255.0
        let b = CGFloat(rgb & 0x0000FF) / 255.0
        self.init(red: r, green: g, blue: b, alpha: 1.0)
    }
}

// MARK: - Data Models

enum AIRole: CaseIterable {
    case pm, developer, qa
    var label: String {
        switch self {
        case .pm: return "项目经理"
        case .developer: return "开发"
        case .qa: return "验收"
        }
    }
    var emoji: String {
        switch self {
        case .pm: return "👔"
        case .developer: return "💻"
        case .qa: return "🧪"
        }
    }
    var color: NSColor {
        switch self {
        case .pm: return .consolePM
        case .developer: return .consoleDev
        case .qa: return .consoleQA
        }
    }
}

enum AIType: CaseIterable {
    case web, api, cli
    var label: String {
        switch self {
        case .web: return "Web"
        case .api: return "API"
        case .cli: return "CLI"
        }
    }
    var icon: String {
        switch self {
        case .web: return "globe"
        case .api: return "bolt"
        case .cli: return "terminal"
        }
    }
    var color: NSColor {
        switch self {
        case .web: return .consoleBlue
        case .api: return .consoleYellow
        case .cli: return .consoleGreen
        }
    }
}

enum AIAgentStatus {
    case idle, working, paused, error
    var label: String {
        switch self {
        case .idle: return "闲置"
        case .working: return "工作中"
        case .paused: return "暂停"
        case .error: return "错误"
        }
    }
    var color: NSColor {
        switch self {
        case .idle: return .consoleText3
        case .working: return .consoleGreen
        case .paused: return .consoleYellow
        case .error: return .consoleRed
        }
    }
    var hasPulse: Bool { self == .working }
}

struct AIMessage {
    enum Sender { case ai, human }
    let sender: Sender
    let content: String
    let timestamp: Date
    let role: AIRole? // 为 AI 消息指定角色
}

struct AIAgent {
    let id: String
    let name: String
    let role: AIRole
    let type: AIType
    var status: AIAgentStatus
    var messages: [AIMessage]
    var url: String?
    var apiEndpoint: String?
    var model: String?
    var command: String?
}

struct AITask {
    enum Status { case pending, inProgress, review, done }
    enum Priority { case low, medium, high }
    let id: String
    let title: String
    let description: String
    var assignedTo: String?
    var status: Status
    var priority: Priority
    var progress: Double
}

// MARK: - Mock Data

class MockData {
    static let agents: [AIAgent] = [
        AIAgent(id: "pm-1", name: "Claude PM", role: .pm, type: .api, status: .working, messages: [
            AIMessage(sender: .human, content: "帮我制定登录界面的开发计划", timestamp: Date().addingTimeInterval(-3600), role: nil),
            AIMessage(sender: .ai, content: "好的，我已经将需求拆解为 3 个任务，并分配给了开发人员。", timestamp: Date().addingTimeInterval(-3500), role: .pm)
        ], apiEndpoint: "https://api.anthropic.com", model: "claude-3.5-sonnet"),
        AIAgent(id: "dev-1", name: "Claude 3.5", role: .developer, type: .api, status: .working, messages: [
            AIMessage(sender: .ai, content: "正在编写 LoginForm.swift 的核心逻辑...", timestamp: Date().addingTimeInterval(-1800), role: .developer)
        ], apiEndpoint: "https://api.anthropic.com", model: "claude-3.5-sonnet"),
        AIAgent(id: "dev-2", name: "GPT-4", role: .developer, type: .api, status: .idle, messages: [], apiEndpoint: "https://api.openai.com", model: "gpt-4"),
        AIAgent(id: "qa-1", name: "QA Bot", role: .qa, type: .cli, status: .idle, messages: [], command: "npm test")
    ]
    
    static let tasks: [AITask] = [
        AITask(id: "t1", title: "实现用户登录功能", description: "需要实现用户名/密码登录，包括表单验证", assignedTo: "dev-1", status: .inProgress, priority: .high, progress: 0.4),
        AITask(id: "t2", title: "设计 UI 界面", description: "完成主页面的 UI 设计", assignedTo: "pm-1", status: .review, priority: .medium, progress: 1.0),
        AITask(id: "t3", title: "编写单元测试", description: "为登录模块编写完整测试用例", assignedTo: "qa-1", status: .pending, priority: .low, progress: 0.0)
    ]
}

// MARK: - Window Controller

final class AIConsoleWindowController: NSWindowController {
    private static var instance: AIConsoleWindowController?
    
    static func show() {
        if instance == nil {
            instance = AIConsoleWindowController()
        }
        
        // 确保显示在当前屏幕内且不超出
        NSApp.setActivationPolicy(.regular)
        
        if let window = instance?.window {
            window.makeKeyAndOrderFront(nil)
            window.orderFrontRegardless()
        }
        
        instance?.showWindow(nil)
        NSApp.activate(ignoringOtherApps: true)
    }
    
    init() {
        let vc = AIConsoleRootViewController()
        let window = NSWindow(contentViewController: vc)
        window.title = "AI 融合器"
        
        // 模仿 IDE 比例：宽度取 1280，高度取 880，但不超过屏幕尺寸
        let screenFrame = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
        let targetWidth = min(screenFrame.width * 0.9, 1280)
        let targetHeight = min(screenFrame.height * 0.9, 880)
        
        window.setContentSize(NSSize(width: targetWidth, height: targetHeight))
        window.minSize = NSSize(width: 900, height: 600)
        window.center()
        window.styleMask = [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView]
        window.isReleasedWhenClosed = false
        window.backgroundColor = .consoleZ950
        window.titlebarAppearsTransparent = true
        window.titleVisibility = .hidden
        super.init(window: window)
        window.delegate = self
    }
    
    required init?(coder: NSCoder) { fatalError() }
}

extension AIConsoleWindowController: NSWindowDelegate {
    func windowWillClose(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
        AIConsoleWindowController.instance = nil
    }
}

// MARK: - Root View Controller

final class AIConsoleRootViewController: NSViewController {
    private let navVC = ConsoleNavViewController()
    private let splitView = NSSplitView()
    private let sidebarVC = ConsoleSidebarViewController()
    private let workVC = ConsoleWorkspaceViewController()
    private let activityVC = ConsoleActivityViewController()
    
    private let sidebarToggleBtn = NSButton()
    private let activityToggleBtn = NSButton()
    
    private var lastSidebarWidth: CGFloat = 260
    private var lastActivityWidth: CGFloat = 300
    
    override func loadView() {
        view = NSView()
        view.translatesAutoresizingMaskIntoConstraints = false
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor.consoleZ950.cgColor
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        setupNav()
        setupSplitView()
        setupToggleButtons()
        
        navVC.delegate = self
    }
    
    private func setupNav() {
        addChild(navVC)
        navVC.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(navVC.view)
        
        NSLayoutConstraint.activate([
            navVC.view.topAnchor.constraint(equalTo: view.topAnchor),
            navVC.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            navVC.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            navVC.view.widthAnchor.constraint(equalToConstant: 60)
        ])
    }
    
    private func setupSplitView() {
        splitView.isVertical = true
        splitView.dividerStyle = .thin
        splitView.delegate = self
        splitView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(splitView)
        
        [sidebarVC, workVC, activityVC].forEach {
            addChild($0)
            splitView.addArrangedSubview($0.view)
        }
        
        NSLayoutConstraint.activate([
            splitView.topAnchor.constraint(equalTo: view.topAnchor),
            splitView.leadingAnchor.constraint(equalTo: navVC.view.trailingAnchor),
            splitView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            splitView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        
        // 初始比例分配
        splitView.setPosition(260, ofDividerAt: 0)
        // 假设窗口 1280，减去 60(nav) 和 260(sidebar)，右侧预留 300
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            let totalWidth = self.splitView.frame.width
            self.splitView.setPosition(totalWidth - 300, ofDividerAt: 1)
        }
    }
    
    private func setupToggleButtons() {
        [sidebarToggleBtn, activityToggleBtn].forEach { btn in
            btn.wantsLayer = true
            btn.layer?.cornerRadius = 16
            btn.layer?.backgroundColor = NSColor.consoleZ800.cgColor
            btn.layer?.borderColor = NSColor.consoleZ700.cgColor
            btn.layer?.borderWidth = 1
            btn.isBordered = false
            btn.title = ""
            btn.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview(btn)
        }
        
        sidebarToggleBtn.image = NSImage(systemSymbolName: "chevron.left", accessibilityDescription: nil)
        sidebarToggleBtn.target = self
        sidebarToggleBtn.action = #selector(toggleSidebar)
        
        activityToggleBtn.image = NSImage(systemSymbolName: "chevron.right", accessibilityDescription: nil)
        activityToggleBtn.target = self
        activityToggleBtn.action = #selector(toggleActivity)
        
        NSLayoutConstraint.activate([
            sidebarToggleBtn.topAnchor.constraint(equalTo: view.topAnchor, constant: 16),
            sidebarToggleBtn.leadingAnchor.constraint(equalTo: sidebarVC.view.trailingAnchor, constant: -16),
            sidebarToggleBtn.widthAnchor.constraint(equalToConstant: 32),
            sidebarToggleBtn.heightAnchor.constraint(equalToConstant: 32),
            
            activityToggleBtn.topAnchor.constraint(equalTo: view.topAnchor, constant: 16),
            activityToggleBtn.trailingAnchor.constraint(equalTo: activityVC.view.leadingAnchor, constant: 16),
            activityToggleBtn.widthAnchor.constraint(equalToConstant: 32),
            activityToggleBtn.heightAnchor.constraint(equalToConstant: 32)
        ])
    }
    
    @objc private func toggleSidebar() {
        let isCollapsed = splitView.isSubviewCollapsed(sidebarVC.view)
        if !isCollapsed {
            lastSidebarWidth = sidebarVC.view.frame.width
        }
        
        NSAnimationContext.runAnimationGroup { ctx in
            ctx.duration = 0.25
            ctx.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
            sidebarVC.view.isHidden = !isCollapsed
            sidebarToggleBtn.animator().image = NSImage(systemSymbolName: !isCollapsed ? "chevron.right" : "chevron.left", accessibilityDescription: nil)
            splitView.layoutSubtreeIfNeeded()
        }
    }
    
    @objc private func toggleActivity() {
        let isCollapsed = splitView.isSubviewCollapsed(activityVC.view)
        if !isCollapsed {
            lastActivityWidth = activityVC.view.frame.width
        }
        
        NSAnimationContext.runAnimationGroup { ctx in
            ctx.duration = 0.25
            ctx.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
            activityVC.view.isHidden = !isCollapsed
            activityToggleBtn.animator().image = NSImage(systemSymbolName: !isCollapsed ? "chevron.left" : "chevron.right", accessibilityDescription: nil)
            splitView.layoutSubtreeIfNeeded()
        }
    }
}

extension AIConsoleRootViewController: NSSplitViewDelegate {
    func splitView(_ splitView: NSSplitView, constrainMinCoordinate proposedMinimumPosition: CGFloat, ofDividerAt dividerIndex: Int) -> CGFloat {
        if dividerIndex == 0 { return 180 } // Sidebar 最小宽度
        return proposedMinimumPosition
    }
    
    func splitView(_ splitView: NSSplitView, constrainMaxCoordinate proposedMaximumPosition: CGFloat, ofDividerAt dividerIndex: Int) -> CGFloat {
        let total = splitView.frame.width
        if dividerIndex == 0 { return total * 0.4 } // Sidebar 最大占 40%
        if dividerIndex == 1 { return total - 200 } // Activity 最小 200
        return proposedMaximumPosition
    }
    
    func splitView(_ splitView: NSSplitView, shouldHideDividerAt dividerIndex: Int) -> Bool {
        return false
    }
    
    func splitView(_ splitView: NSSplitView, effectiveRect proposedEffectiveRect: NSRect, forDrawnRect drawnRect: NSRect, ofDividerAt dividerIndex: Int) -> NSRect {
        // 增加点击手感
        return proposedEffectiveRect.insetBy(dx: -2, dy: 0)
    }
}

extension AIConsoleRootViewController: ConsoleNavDelegate {
    func didSelectNavItem(at index: Int) {
        sidebarVC.update(for: index)
        workVC.switchTo(index: index)
    }
}

// MARK: - Nav View Controller

protocol ConsoleNavDelegate: AnyObject {
    func didSelectNavItem(at index: Int)
}

final class ConsoleNavViewController: NSViewController {
    weak var delegate: ConsoleNavDelegate?
    private var selectedIndex = 0
    private var navButtons: [NSButton] = []
    private let selectionIndicator = NSView()
    private var selectionCenterYConstraint: NSLayoutConstraint?
    
    struct NavItem {
        let icon: String
        let label: String
    }
    
    private let items = [
        NavItem(icon: "briefcase", label: "项目经理"),
        NavItem(icon: "chevron.left.forwardslash.chevron.right", label: "开发团队"),
        NavItem(icon: "checkmark.circle", label: "验收团队"),
        NavItem(icon: "message", label: "消息流"),
        NavItem(icon: "network", label: "AI 配置"),
        NavItem(icon: "gearshape", label: "设置")
    ]
    
    override func loadView() {
        view = NSView()
        view.translatesAutoresizingMaskIntoConstraints = false
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor.consoleZ900.cgColor
        
        let border = NSView()
        border.wantsLayer = true
        border.layer?.backgroundColor = NSColor.consoleZ800.cgColor
        border.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(border)
        
        NSLayoutConstraint.activate([
            border.topAnchor.constraint(equalTo: view.topAnchor),
            border.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            border.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            border.widthAnchor.constraint(equalToConstant: 1)
        ])
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupLogo()
        setupButtons()
        setupBottomControls()
    }
    
    private func setupLogo() {
        let logoContainer = NSView()
        logoContainer.wantsLayer = true
        logoContainer.layer?.cornerRadius = 8
        logoContainer.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(logoContainer)
        
        let gradient = CAGradientLayer()
        gradient.colors = [NSColor(hex: "#3B82F6").cgColor, NSColor(hex: "#9333EA").cgColor]
        gradient.startPoint = CGPoint(x: 0, y: 0)
        gradient.endPoint = CGPoint(x: 1, y: 1)
        gradient.frame = CGRect(x: 0, y: 0, width: 40, height: 40)
        gradient.cornerRadius = 8
        logoContainer.layer?.addSublayer(gradient)
        
        let icon = NSImageView()
        icon.image = NSImage(systemSymbolName: "network", accessibilityDescription: nil)
        icon.contentTintColor = .white
        icon.translatesAutoresizingMaskIntoConstraints = false
        logoContainer.addSubview(icon)
        
        NSLayoutConstraint.activate([
            logoContainer.topAnchor.constraint(equalTo: view.topAnchor, constant: 16),
            logoContainer.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            logoContainer.widthAnchor.constraint(equalToConstant: 40),
            logoContainer.heightAnchor.constraint(equalToConstant: 40),
            icon.centerXAnchor.constraint(equalTo: logoContainer.centerXAnchor),
            icon.centerYAnchor.constraint(equalTo: logoContainer.centerYAnchor),
            icon.widthAnchor.constraint(equalToConstant: 20),
            icon.heightAnchor.constraint(equalToConstant: 20)
        ])
    }
    
    private func setupButtons() {
        let stack = NSStackView()
        stack.orientation = .vertical
        stack.spacing = 0
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        
        selectionIndicator.wantsLayer = true
        selectionIndicator.layer?.backgroundColor = NSColor.consoleBlue.cgColor
        selectionIndicator.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(selectionIndicator)
        
        for (i, item) in items.enumerated() {
            let btn = NSButton()
            btn.image = NSImage(systemSymbolName: item.icon, accessibilityDescription: item.label)
            btn.isBordered = false
            btn.title = ""
            btn.tag = i
            btn.target = self
            btn.action = #selector(navTapped(_:))
            btn.translatesAutoresizingMaskIntoConstraints = false
            btn.heightAnchor.constraint(equalToConstant: 48).isActive = true
            btn.widthAnchor.constraint(equalToConstant: 60).isActive = true
            stack.addArrangedSubview(btn)
            navButtons.append(btn)
        }
        
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: view.topAnchor, constant: 72),
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            
            selectionIndicator.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            selectionIndicator.widthAnchor.constraint(equalToConstant: 4),
            selectionIndicator.heightAnchor.constraint(equalToConstant: 32)
        ])
        
        updateSelection()
    }
    
    @objc private func navTapped(_ sender: NSButton) {
        selectedIndex = sender.tag
        updateSelection()
        delegate?.didSelectNavItem(at: selectedIndex)
    }
    
    private func updateSelection() {
        for (i, btn) in navButtons.enumerated() {
            let isSelected = i == selectedIndex
            btn.contentTintColor = isSelected ? NSColor(hex: "#60A5FA") : .consoleText2
            btn.layer?.backgroundColor = isSelected ? NSColor.consoleZ800.cgColor : NSColor.clear.cgColor
            
            if isSelected {
                selectionCenterYConstraint?.isActive = false
                selectionCenterYConstraint = selectionIndicator.centerYAnchor.constraint(equalTo: btn.centerYAnchor)
                selectionCenterYConstraint?.isActive = true
            }
        }
    }
    
    private let statusDot = ConsoleStatusDot(status: .working)
    
    private func setupBottomControls() {
        let playBtn = NSButton()
        playBtn.image = NSImage(systemSymbolName: "pause.fill", accessibilityDescription: "控制")
        playBtn.contentTintColor = .consoleText2
        playBtn.isBordered = false
        playBtn.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(playBtn)
        
        statusDot.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(statusDot)
        
        NSLayoutConstraint.activate([
            playBtn.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -60),
            playBtn.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            playBtn.widthAnchor.constraint(equalToConstant: 60),
            playBtn.heightAnchor.constraint(equalToConstant: 48),
            
            statusDot.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -32),
            statusDot.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            statusDot.widthAnchor.constraint(equalToConstant: 8),
            statusDot.heightAnchor.constraint(equalToConstant: 8)
        ])
    }
}

// MARK: - Sidebar View Controller

final class ConsoleSidebarViewController: NSViewController {
    private let titleLabel = NSTextField(labelWithString: "项目经理")
    private let subtitleLabel = NSTextField(labelWithString: "1 个 AI")
    private let stackView = NSStackView()
    private let scrollView = NSScrollView()
    
    override func loadView() {
        view = NSView()
        view.translatesAutoresizingMaskIntoConstraints = false
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor.consoleZ900.withAlphaComponent(0.5).cgColor
        
        let border = NSView()
        border.wantsLayer = true
        border.layer?.backgroundColor = NSColor.consoleZ800.cgColor
        border.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(border)
        
        NSLayoutConstraint.activate([
            border.topAnchor.constraint(equalTo: view.topAnchor),
            border.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            border.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            border.widthAnchor.constraint(equalToConstant: 1)
        ])
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupHeader()
        setupList()
        update(for: 0)
    }
    
    private func setupHeader() {
        titleLabel.font = .systemFont(ofSize: 16, weight: .semibold)
        titleLabel.textColor = .consoleText
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        
        subtitleLabel.font = .systemFont(ofSize: 14)
        subtitleLabel.textColor = .consoleText2
        subtitleLabel.translatesAutoresizingMaskIntoConstraints = false
        
        let addBtn = NSButton()
        addBtn.image = NSImage(systemSymbolName: "plus", accessibilityDescription: "增加")
        addBtn.isBordered = false
        addBtn.wantsLayer = true
        addBtn.layer?.cornerRadius = 8
        addBtn.layer?.backgroundColor = NSColor.consoleZ800.cgColor
        addBtn.translatesAutoresizingMaskIntoConstraints = false
        
        view.addSubview(titleLabel)
        view.addSubview(subtitleLabel)
        view.addSubview(addBtn)
        
        NSLayoutConstraint.activate([
            titleLabel.topAnchor.constraint(equalTo: view.topAnchor, constant: 16),
            titleLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            subtitleLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 4),
            subtitleLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            addBtn.centerYAnchor.constraint(equalTo: titleLabel.bottomAnchor),
            addBtn.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            addBtn.widthAnchor.constraint(equalToConstant: 32),
            addBtn.heightAnchor.constraint(equalToConstant: 32)
        ])
        
        let border = NSView()
        border.wantsLayer = true
        border.layer?.backgroundColor = NSColor.consoleZ800.cgColor
        border.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(border)
        NSLayoutConstraint.activate([
            border.topAnchor.constraint(equalTo: view.topAnchor, constant: 80),
            border.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            border.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            border.heightAnchor.constraint(equalToConstant: 1)
        ])
    }
    
    private func setupList() {
        scrollView.drawsBackground = false
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scrollView)
        
        stackView.orientation = .vertical
        stackView.spacing = 8
        stackView.edgeInsets = NSEdgeInsets(top: 12, left: 8, bottom: 12, right: 8)
        stackView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.documentView = stackView
        
        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.topAnchor, constant: 81),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            stackView.topAnchor.constraint(equalTo: scrollView.contentView.topAnchor),
            stackView.leadingAnchor.constraint(equalTo: scrollView.contentView.leadingAnchor),
            stackView.trailingAnchor.constraint(equalTo: scrollView.contentView.trailingAnchor)
        ])
    }
    
    func update(for index: Int) {
        stackView.arrangedSubviews.forEach { $0.removeFromSuperview() }
        
        let filtered: [AIAgent]
        switch index {
        case 0:
            titleLabel.stringValue = "项目经理"
            filtered = MockData.agents.filter { $0.role == .pm }
        case 1:
            titleLabel.stringValue = "开发人员"
            filtered = MockData.agents.filter { $0.role == .developer }
        case 2:
            titleLabel.stringValue = "验收人员"
            filtered = MockData.agents.filter { $0.role == .qa }
        default:
            titleLabel.stringValue = "AI 列表"
            filtered = MockData.agents
        }
        
        subtitleLabel.stringValue = "\(filtered.count) 个 AI"
        
        for agent in filtered {
            let card = ConsoleAICard(agent: agent)
            card.translatesAutoresizingMaskIntoConstraints = false
            card.heightAnchor.constraint(equalToConstant: 76).isActive = true
            stackView.addArrangedSubview(card)
        }
    }
}

// MARK: - Workspace View Controller

final class ConsoleWorkspaceViewController: NSViewController {
    private var currentVC: NSViewController?
    
    override func loadView() {
        view = NSView()
        view.translatesAutoresizingMaskIntoConstraints = false
    }
    
    func switchTo(index: Int) {
        currentVC?.view.removeFromSuperview()
        currentVC?.removeFromParent()
        
        let newVC: NSViewController
        switch index {
        case 0: newVC = PMWorkspaceViewController()
        case 1: newVC = DevWorkspaceViewController()
        case 2: newVC = QAWorkspaceViewController()
        case 3: newVC = MessageFlowViewController()
        case 4: newVC = AIConfigViewController()
        case 5: newVC = SettingsPlaceholderViewController()
        default: newVC = NSViewController()
        }
        
        addChild(newVC)
        newVC.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(newVC.view)
        
        NSLayoutConstraint.activate([
            newVC.view.topAnchor.constraint(equalTo: view.topAnchor),
            newVC.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            newVC.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            newVC.view.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        currentVC = newVC
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        switchTo(index: 0)
    }
}

// MARK: - PM Workspace

final class PMWorkspaceViewController: NSViewController {
    private let splitView = NSSplitView()
    private let taskListVC = PMTaskListViewController()
    private var chatVC: ConsoleChatViewController?
    
    override func loadView() {
        view = NSView()
        view.translatesAutoresizingMaskIntoConstraints = false
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        let pmAgent = MockData.agents.first(where: { $0.role == .pm }) ?? MockData.agents[0]
        chatVC = ConsoleChatViewController(agent: pmAgent)
        
        splitView.isVertical = true
        splitView.dividerStyle = .thin
        splitView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(splitView)
        
        addChild(taskListVC)
        addChild(chatVC!)
        taskListVC.view.translatesAutoresizingMaskIntoConstraints = false
        chatVC!.view.translatesAutoresizingMaskIntoConstraints = false
        splitView.addArrangedSubview(taskListVC.view)
        splitView.addArrangedSubview(chatVC!.view)
        
        NSLayoutConstraint.activate([
            splitView.topAnchor.constraint(equalTo: view.topAnchor),
            splitView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            splitView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            splitView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            taskListVC.view.widthAnchor.constraint(equalToConstant: 320)
        ])
    }
}

final class PMTaskListViewController: NSViewController {
    override func loadView() {
        view = NSView()
        view.translatesAutoresizingMaskIntoConstraints = false
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor.consoleZ950.cgColor
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        let header = NSView()
        header.translatesAutoresizingMaskIntoConstraints = false
        header.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(header)
        
        let title = NSTextField(labelWithString: "任务总览")
        title.font = .systemFont(ofSize: 16, weight: .semibold)
        title.textColor = .consoleText
        title.translatesAutoresizingMaskIntoConstraints = false
        header.addSubview(title)
        
        let subtitle = NSTextField(labelWithString: "共 \(MockData.tasks.count) 个任务")
        subtitle.font = .systemFont(ofSize: 14)
        subtitle.textColor = .consoleText2
        subtitle.translatesAutoresizingMaskIntoConstraints = false
        header.addSubview(subtitle)
        
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
            title.topAnchor.constraint(equalTo: header.topAnchor, constant: 12),
            title.leadingAnchor.constraint(equalTo: header.leadingAnchor, constant: 16),
            subtitle.topAnchor.constraint(equalTo: title.bottomAnchor, constant: 4),
            subtitle.leadingAnchor.constraint(equalTo: header.leadingAnchor, constant: 16),
            border.topAnchor.constraint(equalTo: header.bottomAnchor),
            border.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            border.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            border.heightAnchor.constraint(equalToConstant: 1)
        ])
        
        let scroll = NSScrollView()
        scroll.drawsBackground = false
        scroll.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scroll)
        
        let stack = NSStackView()
        stack.orientation = .vertical
        stack.spacing = 12
        stack.edgeInsets = NSEdgeInsets(top: 16, left: 16, bottom: 16, right: 16)
        stack.translatesAutoresizingMaskIntoConstraints = false
        scroll.documentView = stack
        
        NSLayoutConstraint.activate([
            scroll.topAnchor.constraint(equalTo: border.bottomAnchor),
            scroll.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scroll.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            stack.topAnchor.constraint(equalTo: scroll.contentView.topAnchor),
            stack.leadingAnchor.constraint(equalTo: scroll.contentView.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: scroll.contentView.trailingAnchor)
        ])
        
        for task in MockData.tasks {
            let card = createCard(for: task)
            card.translatesAutoresizingMaskIntoConstraints = false
            stack.addArrangedSubview(card)
        }
    }
    
    private func createCard(for task: AITask) -> NSView {
        let card = NSView()
        card.wantsLayer = true
        card.layer?.cornerRadius = 8
        card.layer?.backgroundColor = NSColor.consoleZ900.withAlphaComponent(0.5).cgColor
        card.layer?.borderColor = NSColor.consoleZ800.cgColor
        card.layer?.borderWidth = 1
        card.translatesAutoresizingMaskIntoConstraints = false
        card.heightAnchor.constraint(equalToConstant: 100).isActive = true
        
        let title = NSTextField(labelWithString: task.title)
        title.font = .systemFont(ofSize: 14, weight: .semibold)
        title.textColor = .consoleText
        title.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(title)
        
        let desc = NSTextField(labelWithString: task.description)
        desc.font = .systemFont(ofSize: 12)
        desc.textColor = .consoleText2
        desc.maximumNumberOfLines = 2
        desc.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(desc)
        
        NSLayoutConstraint.activate([
            title.topAnchor.constraint(equalTo: card.topAnchor, constant: 12),
            title.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 12),
            desc.topAnchor.constraint(equalTo: title.bottomAnchor, constant: 4),
            desc.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 12),
            desc.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -12)
        ])
        return card
    }
}

final class ConsoleChatViewController: NSViewController {
    private let agent: AIAgent
    private let stackView = NSStackView()
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
    
    private func setupHeader() {
        let header = NSView()
        header.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(header)
        
        let avatar = NSView()
        avatar.wantsLayer = true
        avatar.layer?.cornerRadius = 8
        avatar.translatesAutoresizingMaskIntoConstraints = false
        let grad = CAGradientLayer()
        grad.colors = [NSColor(hex: "#A855F7").withAlphaComponent(0.2).cgColor, NSColor(hex: "#EC4899").withAlphaComponent(0.2).cgColor]
        grad.frame = CGRect(x: 0, y: 0, width: 40, height: 40)
        grad.cornerRadius = 8
        avatar.layer?.addSublayer(grad)
        
        let emoji = NSTextField(labelWithString: "👔")
        emoji.translatesAutoresizingMaskIntoConstraints = false
        avatar.addSubview(emoji)
        
        header.addSubview(avatar)
        
        let name = NSTextField(labelWithString: agent.name)
        name.font = .systemFont(ofSize: 14, weight: .semibold)
        name.textColor = .consoleText
        name.translatesAutoresizingMaskIntoConstraints = false
        header.addSubview(name)
        
        let sub = NSTextField(labelWithString: "\(agent.role.label) · \(agent.model ?? "claude-3.5-sonnet")")
        sub.font = .systemFont(ofSize: 12)
        sub.textColor = .consoleText2
        sub.translatesAutoresizingMaskIntoConstraints = false
        header.addSubview(sub)
        
        let online = NSView()
        online.wantsLayer = true
        online.layer?.cornerRadius = 12
        online.layer?.backgroundColor = NSColor.consoleGreen.withAlphaComponent(0.2).cgColor
        online.layer?.borderColor = NSColor.consoleGreen.withAlphaComponent(0.3).cgColor
        online.layer?.borderWidth = 1
        online.translatesAutoresizingMaskIntoConstraints = false
        let onlineLbl = NSTextField(labelWithString: "在线")
        onlineLbl.font = .systemFont(ofSize: 12)
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
            header.heightAnchor.constraint(equalToConstant: 72),
            
            avatar.centerYAnchor.constraint(equalTo: header.centerYAnchor),
            avatar.leadingAnchor.constraint(equalTo: header.leadingAnchor, constant: 16),
            avatar.widthAnchor.constraint(equalToConstant: 40),
            avatar.heightAnchor.constraint(equalToConstant: 40),
            emoji.centerXAnchor.constraint(equalTo: avatar.centerXAnchor),
            emoji.centerYAnchor.constraint(equalTo: avatar.centerYAnchor),
            
            name.topAnchor.constraint(equalTo: avatar.topAnchor),
            name.leadingAnchor.constraint(equalTo: avatar.trailingAnchor, constant: 12),
            sub.bottomAnchor.constraint(equalTo: avatar.bottomAnchor),
            sub.leadingAnchor.constraint(equalTo: avatar.trailingAnchor, constant: 12),
            
            online.centerYAnchor.constraint(equalTo: header.centerYAnchor),
            online.trailingAnchor.constraint(equalTo: header.trailingAnchor, constant: -16),
            online.widthAnchor.constraint(equalToConstant: 60),
            online.heightAnchor.constraint(equalToConstant: 24),
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
        stackView.spacing = 16
        stackView.edgeInsets = NSEdgeInsets(top: 20, left: 20, bottom: 20, right: 20)
        stackView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.documentView = stackView
        
        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.topAnchor, constant: 73),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -72),
            stackView.topAnchor.constraint(equalTo: scrollView.contentView.topAnchor),
            stackView.centerXAnchor.constraint(equalTo: scrollView.centerXAnchor),
            stackView.widthAnchor.constraint(equalTo: scrollView.widthAnchor, constant: -40)
        ])
        for m in agent.messages {
            addMessageBubble(m)
        }
    }
    
    private func addMessageBubble(_ m: AIMessage) {
        let isAI = m.sender == .ai
        let container = NSView()
        container.translatesAutoresizingMaskIntoConstraints = false
        stackView.addArrangedSubview(container)
        
        let bubble = NSView()
        bubble.wantsLayer = true
        bubble.layer?.cornerRadius = 8
        bubble.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(bubble)
        
        let content = NSTextField(labelWithString: m.content)
        content.font = .systemFont(ofSize: 14)
        content.textColor = .consoleText
        content.maximumNumberOfLines = 0
        content.translatesAutoresizingMaskIntoConstraints = false
        bubble.addSubview(content)
        
        if isAI {
            bubble.layer?.backgroundColor = agent.role.color.withAlphaComponent(0.2).cgColor
            bubble.layer?.borderColor = agent.role.color.withAlphaComponent(0.3).cgColor
            bubble.layer?.borderWidth = 1
            NSLayoutConstraint.activate([
                bubble.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 44),
                bubble.trailingAnchor.constraint(lessThanOrEqualTo: container.trailingAnchor, constant: -60)
            ])
        } else {
            bubble.layer?.backgroundColor = NSColor.consoleBlue.withAlphaComponent(0.2).cgColor
            bubble.layer?.borderColor = NSColor.consoleBlue.withAlphaComponent(0.3).cgColor
            bubble.layer?.borderWidth = 1
            NSLayoutConstraint.activate([
                bubble.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -44),
                bubble.leadingAnchor.constraint(greaterThanOrEqualTo: container.leadingAnchor, constant: 60)
            ])
        }
        
        NSLayoutConstraint.activate([
            container.heightAnchor.constraint(greaterThanOrEqualTo: bubble.heightAnchor),
            bubble.topAnchor.constraint(equalTo: container.topAnchor),
            bubble.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            content.topAnchor.constraint(equalTo: bubble.topAnchor, constant: 12),
            content.leadingAnchor.constraint(equalTo: bubble.leadingAnchor, constant: 12),
            content.trailingAnchor.constraint(equalTo: bubble.trailingAnchor, constant: -12),
            content.bottomAnchor.constraint(equalTo: bubble.bottomAnchor, constant: -12)
        ])
    }
    
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
        
        inputField.placeholderString = "给项目经理发送消息..."
        inputField.translatesAutoresizingMaskIntoConstraints = false
        inputArea.addSubview(inputField)
        
        let btn = ConsoleSendButton()
        btn.target = self
        btn.action = #selector(sendMessage)
        btn.translatesAutoresizingMaskIntoConstraints = false
        inputArea.addSubview(btn)
        
        let hint = NSTextField(labelWithString: "在此输入可直接干预项目经理的决策")
        hint.font = .systemFont(ofSize: 11)
        hint.textColor = .consoleText3
        hint.translatesAutoresizingMaskIntoConstraints = false
        inputArea.addSubview(hint)
        
        NSLayoutConstraint.activate([
            inputArea.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            inputArea.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            inputArea.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            inputArea.heightAnchor.constraint(equalToConstant: 80),
            
            border.topAnchor.constraint(equalTo: inputArea.topAnchor),
            border.leadingAnchor.constraint(equalTo: inputArea.leadingAnchor),
            border.trailingAnchor.constraint(equalTo: inputArea.trailingAnchor),
            border.heightAnchor.constraint(equalToConstant: 1),
            
            btn.widthAnchor.constraint(equalToConstant: 40),
            btn.heightAnchor.constraint(equalToConstant: 40),
            
            hint.topAnchor.constraint(equalTo: inputField.bottomAnchor, constant: 4),
            hint.centerXAnchor.constraint(equalTo: inputArea.centerXAnchor)
        ])
    }
    
    @objc private func sendMessage() {
        let text = inputField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        
        let userMsg = AIMessage(sender: .human, content: text, timestamp: Date(), role: nil)
        addMessageBubble(userMsg)
        inputField.stringValue = ""
        
        let reply: String
        switch agent.role {
        case .pm: reply = "收到您的建议。我将重新评估项目优先顺序并通知开发团队进行调整。"
        case .developer: reply = "明白。我正在检查相关代码模块，完成后会提交预览供您检查。"
        case .qa: reply = "好的。我将针对这部分功能增加额外的边界条件测试。"
        }
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { [weak self] in
            let aiMsg = AIMessage(sender: .ai, content: reply, timestamp: Date(), role: self?.agent.role)
            self?.addMessageBubble(aiMsg)
        }
    }
}

// MARK: - Dev Workspace

final class DevWorkspaceViewController: NSViewController {
    private let segmentedControl = NSSegmentedControl()
    private let containerView = NSView()
    private var currentVC: NSViewController?
    
    override func loadView() {
        view = NSView()
        view.translatesAutoresizingMaskIntoConstraints = false
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor.consoleZ950.cgColor
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupHeader()
        setupTabs()
        switchToTab(0)
    }
    
    private func setupHeader() {
        let header = NSView()
        header.translatesAutoresizingMaskIntoConstraints = false
        header.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(header)
        
        // Similar header to PM workspace but for Dev
        let avatar = NSView()
        avatar.wantsLayer = true
        avatar.layer?.cornerRadius = 8
        avatar.translatesAutoresizingMaskIntoConstraints = false
        let grad = CAGradientLayer()
        grad.colors = [NSColor.consoleBlue.withAlphaComponent(0.2).cgColor, NSColor(hex: "#06B6D4").withAlphaComponent(0.2).cgColor]
        grad.frame = CGRect(x: 0, y: 0, width: 40, height: 40)
        grad.cornerRadius = 8
        avatar.layer?.addSublayer(grad)
        
        let emoji = NSTextField(labelWithString: "💻")
        emoji.translatesAutoresizingMaskIntoConstraints = false
        avatar.addSubview(emoji)
        
        header.addSubview(avatar)
        
        let name = NSTextField(labelWithString: "Claude 3.5")
        name.font = .systemFont(ofSize: 14, weight: .semibold)
        name.textColor = .consoleText
        name.translatesAutoresizingMaskIntoConstraints = false
        header.addSubview(name)
        
        let sub = NSTextField(labelWithString: "开发团队 · claude-3.5-sonnet")
        sub.font = .systemFont(ofSize: 12)
        sub.textColor = .consoleText2
        sub.translatesAutoresizingMaskIntoConstraints = false
        header.addSubview(sub)
        
        NSLayoutConstraint.activate([
            header.topAnchor.constraint(equalTo: view.topAnchor),
            header.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            header.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            header.heightAnchor.constraint(equalToConstant: 72),
            
            avatar.centerYAnchor.constraint(equalTo: header.centerYAnchor),
            avatar.leadingAnchor.constraint(equalTo: header.leadingAnchor, constant: 16),
            avatar.widthAnchor.constraint(equalToConstant: 40),
            avatar.heightAnchor.constraint(equalToConstant: 40),
            emoji.centerXAnchor.constraint(equalTo: avatar.centerXAnchor),
            emoji.centerYAnchor.constraint(equalTo: avatar.centerYAnchor),
            
            name.topAnchor.constraint(equalTo: avatar.topAnchor),
            name.leadingAnchor.constraint(equalTo: avatar.trailingAnchor, constant: 12),
            sub.bottomAnchor.constraint(equalTo: avatar.bottomAnchor),
            sub.leadingAnchor.constraint(equalTo: avatar.trailingAnchor, constant: 12)
        ])
    }
    
    private func setupTabs() {
        let bar = NSView()
        bar.wantsLayer = true
        bar.layer?.backgroundColor = NSColor.consoleZ900.cgColor
        bar.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(bar)
        
        segmentedControl.segmentCount = 3
        segmentedControl.setLabel("对话", forSegment: 0)
        segmentedControl.setLabel("代码预览", forSegment: 1)
        segmentedControl.setLabel("任务", forSegment: 2)
        segmentedControl.selectedSegment = 0
        segmentedControl.target = self
        segmentedControl.action = #selector(tabChanged(_:))
        segmentedControl.translatesAutoresizingMaskIntoConstraints = false
        bar.addSubview(segmentedControl)
        
        containerView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(containerView)
        
        NSLayoutConstraint.activate([
            bar.topAnchor.constraint(equalTo: view.topAnchor, constant: 72),
            bar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            bar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            bar.heightAnchor.constraint(equalToConstant: 44),
            
            segmentedControl.centerYAnchor.constraint(equalTo: bar.centerYAnchor),
            segmentedControl.leadingAnchor.constraint(equalTo: bar.leadingAnchor, constant: 16),
            
            containerView.topAnchor.constraint(equalTo: bar.bottomAnchor),
            containerView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            containerView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            containerView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }
    
    @objc private func tabChanged(_ sender: NSSegmentedControl) {
        switchToTab(sender.selectedSegment)
    }
    
    private func switchToTab(_ index: Int) {
        currentVC?.view.removeFromSuperview()
        currentVC?.removeFromParent()
        
        let vc: NSViewController
        switch index {
        case 1: vc = DevCodePreviewController()
        case 2: vc = DevTaskListController()
        default:
            let devAgent = MockData.agents.first(where: { $0.role == .developer }) ?? MockData.agents[1]
            vc = ConsoleChatViewController(agent: devAgent)
        }
        
        addChild(vc)
        vc.view.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(vc.view)
        NSLayoutConstraint.activate([
            vc.view.topAnchor.constraint(equalTo: containerView.topAnchor),
            vc.view.leadingAnchor.constraint(equalTo: containerView.leadingAnchor),
            vc.view.trailingAnchor.constraint(equalTo: containerView.trailingAnchor),
            vc.view.bottomAnchor.constraint(equalTo: containerView.bottomAnchor)
        ])
        currentVC = vc
    }
}

final class DevCodePreviewController: NSViewController {
    override func loadView() {
        view = createCodePreview()
    }
    
    private func createCodePreview() -> NSView {
        let v = NSView()
        let editor = NSView()
        editor.wantsLayer = true
        editor.layer?.cornerRadius = 8
        editor.layer?.backgroundColor = NSColor.consoleZ950.cgColor
        editor.translatesAutoresizingMaskIntoConstraints = false
        v.addSubview(editor)
        
        let filename = NSTextField(labelWithString: "LoginForm.swift")
        filename.font = .systemFont(ofSize: 12)
        filename.textColor = .consoleText2
        filename.translatesAutoresizingMaskIntoConstraints = false
        editor.addSubview(filename)
        
        let code = NSTextField(labelWithString: "import AppKit\n\nclass LoginForm: NSView {\n    override init(frame: NSRect) {\n        super.init(frame: frame)\n        setupUI()\n    }\n    \n    func setupUI() {\n        // Code logic here\n        let btn = NSButton()\n        btn.title = \"Login\"\n        addSubview(btn)\n    }\n}")
        code.font = NSFont.monospacedSystemFont(ofSize: 13, weight: .regular)
        code.textColor = NSColor(hex: "#D4D4D8")
        code.translatesAutoresizingMaskIntoConstraints = false
        editor.addSubview(code)
        
        NSLayoutConstraint.activate([
            editor.topAnchor.constraint(equalTo: v.topAnchor, constant: 20),
            editor.leadingAnchor.constraint(equalTo: v.leadingAnchor, constant: 20),
            editor.trailingAnchor.constraint(equalTo: v.trailingAnchor, constant: -20),
            editor.bottomAnchor.constraint(equalTo: v.bottomAnchor, constant: -20),
            filename.topAnchor.constraint(equalTo: editor.topAnchor, constant: 12),
            filename.leadingAnchor.constraint(equalTo: editor.leadingAnchor, constant: 16),
            code.topAnchor.constraint(equalTo: filename.bottomAnchor, constant: 16),
            code.leadingAnchor.constraint(equalTo: editor.leadingAnchor, constant: 16)
        ])
        return v
    }
}

final class DevTaskListController: NSViewController {
    override func loadView() {
        view = createTaskList()
    }
    
    private func createTaskList() -> NSView {
        let v = NSView()
        let stack = NSStackView()
        stack.orientation = .vertical
        stack.spacing = 12
        stack.edgeInsets = NSEdgeInsets(top: 20, left: 20, bottom: 20, right: 20)
        stack.translatesAutoresizingMaskIntoConstraints = false
        v.addSubview(stack)
        
        for task in MockData.tasks {
            let card = NSView()
            card.wantsLayer = true
            card.layer?.cornerRadius = 8
            card.layer?.backgroundColor = NSColor.consoleZ900.cgColor
            card.translatesAutoresizingMaskIntoConstraints = false
            card.heightAnchor.constraint(equalToConstant: 80).isActive = true
            
            let name = NSTextField(labelWithString: task.title)
            name.font = .systemFont(ofSize: 14, weight: .semibold)
            name.textColor = .consoleText
            name.translatesAutoresizingMaskIntoConstraints = false
            card.addSubview(name)
            
            let progress = ConsoleProgressBar()
            progress.progress = task.progress
            progress.translatesAutoresizingMaskIntoConstraints = false
            card.addSubview(progress)
            
            NSLayoutConstraint.activate([
                name.topAnchor.constraint(equalTo: card.topAnchor, constant: 12),
                name.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 12),
                progress.topAnchor.constraint(equalTo: name.bottomAnchor, constant: 12),
                progress.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 12),
                progress.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -12),
                progress.heightAnchor.constraint(equalToConstant: 8)
            ])
            stack.addArrangedSubview(card)
        }
        return v
    }
}

// MARK: - QA Workspace

final class QAWorkspaceViewController: NSViewController {
    private let segmentedControl = NSSegmentedControl()
    private let containerView = NSView()
    private var currentVC: NSViewController?

    override func loadView() {
        view = NSView()
        view.translatesAutoresizingMaskIntoConstraints = false
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor.consoleZ950.cgColor
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupHeader()
        setupTabs()
        switchToTab(0)
    }
    
    private func setupHeader() {
        let header = NSView()
        header.translatesAutoresizingMaskIntoConstraints = false
        header.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(header)
        
        let avatar = NSView()
        avatar.wantsLayer = true
        avatar.layer?.cornerRadius = 8
        avatar.translatesAutoresizingMaskIntoConstraints = false
        let grad = CAGradientLayer()
        grad.colors = [NSColor.consoleGreen.withAlphaComponent(0.2).cgColor, NSColor(hex: "#4ADE80").withAlphaComponent(0.2).cgColor]
        grad.frame = CGRect(x: 0, y: 0, width: 40, height: 40)
        grad.cornerRadius = 8
        avatar.layer?.addSublayer(grad)
        
        let emoji = NSTextField(labelWithString: "🧪")
        emoji.translatesAutoresizingMaskIntoConstraints = false
        avatar.addSubview(emoji)
        
        header.addSubview(avatar)
        
        let name = NSTextField(labelWithString: "QA Bot")
        name.font = .systemFont(ofSize: 14, weight: .semibold)
        name.textColor = .consoleText
        name.translatesAutoresizingMaskIntoConstraints = false
        header.addSubview(name)
        
        let sub = NSTextField(labelWithString: "验收团队 · claude-3-haiku")
        sub.font = .systemFont(ofSize: 12)
        sub.textColor = .consoleText2
        sub.translatesAutoresizingMaskIntoConstraints = false
        header.addSubview(sub)
        
        NSLayoutConstraint.activate([
            header.topAnchor.constraint(equalTo: view.topAnchor),
            header.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            header.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            header.heightAnchor.constraint(equalToConstant: 72),
            avatar.centerYAnchor.constraint(equalTo: header.centerYAnchor),
            avatar.leadingAnchor.constraint(equalTo: header.leadingAnchor, constant: 16),
            avatar.widthAnchor.constraint(equalToConstant: 40),
            avatar.heightAnchor.constraint(equalToConstant: 40),
            emoji.centerXAnchor.constraint(equalTo: avatar.centerXAnchor),
            emoji.centerYAnchor.constraint(equalTo: avatar.centerYAnchor),
            name.topAnchor.constraint(equalTo: avatar.topAnchor),
            name.leadingAnchor.constraint(equalTo: avatar.trailingAnchor, constant: 12),
            sub.bottomAnchor.constraint(equalTo: avatar.bottomAnchor),
            sub.leadingAnchor.constraint(equalTo: avatar.trailingAnchor, constant: 12)
        ])
    }
    
    private func setupTabs() {
        let bar = NSView()
        bar.wantsLayer = true
        bar.layer?.backgroundColor = NSColor.consoleZ900.cgColor
        bar.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(bar)
        
        segmentedControl.segmentCount = 3
        segmentedControl.setLabel("对话", forSegment: 0)
        segmentedControl.setLabel("测试结果", forSegment: 1)
        segmentedControl.setLabel("测试报告", forSegment: 2)
        segmentedControl.selectedSegment = 0
        segmentedControl.target = self
        segmentedControl.action = #selector(tabChanged(_:))
        segmentedControl.translatesAutoresizingMaskIntoConstraints = false
        bar.addSubview(segmentedControl)
        
        containerView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(containerView)
        
        NSLayoutConstraint.activate([
            bar.topAnchor.constraint(equalTo: view.topAnchor, constant: 72),
            bar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            bar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            bar.heightAnchor.constraint(equalToConstant: 44),
            segmentedControl.centerYAnchor.constraint(equalTo: bar.centerYAnchor),
            segmentedControl.leadingAnchor.constraint(equalTo: bar.leadingAnchor, constant: 16),
            containerView.topAnchor.constraint(equalTo: bar.bottomAnchor),
            containerView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            containerView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            containerView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }
    
    @objc private func tabChanged(_ sender: NSSegmentedControl) {
        switchToTab(sender.selectedSegment)
    }
    
    private func switchToTab(_ index: Int) {
        currentVC?.view.removeFromSuperview()
        currentVC?.removeFromParent()
        
        let vc: NSViewController
        switch index {
        case 1: vc = QATestResultsController()
        case 2: vc = QATestReportController()
        default:
            let qaAgent = MockData.agents.first(where: { $0.role == .qa }) ?? MockData.agents[3]
            vc = ConsoleChatViewController(agent: qaAgent)
        }
        
        addChild(vc)
        vc.view.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(vc.view)
        NSLayoutConstraint.activate([
            vc.view.topAnchor.constraint(equalTo: containerView.topAnchor),
            vc.view.leadingAnchor.constraint(equalTo: containerView.leadingAnchor),
            vc.view.trailingAnchor.constraint(equalTo: containerView.trailingAnchor),
            vc.view.bottomAnchor.constraint(equalTo: containerView.bottomAnchor)
        ])
        currentVC = vc
    }
}

final class QATestResultsController: NSViewController {
    override func loadView() { view = createTestResults() }
    
    private func createTestResults() -> NSView {
        let v = NSView()
        let scroll = NSScrollView()
        scroll.drawsBackground = false
        scroll.translatesAutoresizingMaskIntoConstraints = false
        v.addSubview(scroll)
        
        let stack = NSStackView()
        stack.orientation = .vertical
        stack.spacing = 10
        stack.edgeInsets = NSEdgeInsets(top: 20, left: 20, bottom: 20, right: 20)
        stack.translatesAutoresizingMaskIntoConstraints = false
        scroll.documentView = stack
        
        NSLayoutConstraint.activate([
            scroll.topAnchor.constraint(equalTo: v.topAnchor),
            scroll.leadingAnchor.constraint(equalTo: v.leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo: v.trailingAnchor),
            scroll.bottomAnchor.constraint(equalTo: v.bottomAnchor),
            stack.widthAnchor.constraint(equalTo: scroll.widthAnchor)
        ])
        
        // Mock results
        let results = [
            ("用户登录 API 测试", true, "0.23s"),
            ("数据库迁移脚本验证", false, "1.45s"),
            ("前端主页渲染测试", true, "0.89s")
        ]
        
        for (name, success, time) in results {
            let row = NSView()
            row.wantsLayer = true
            row.layer?.cornerRadius = 8
            row.layer?.backgroundColor = success ? NSColor.consoleGreen.withAlphaComponent(0.1).cgColor : NSColor.consoleRed.withAlphaComponent(0.1).cgColor
            row.translatesAutoresizingMaskIntoConstraints = false
            row.heightAnchor.constraint(equalToConstant: 44).isActive = true
            
            let icon = NSTextField(labelWithString: success ? "✓" : "✗")
            icon.textColor = success ? .consoleGreen : .consoleRed
            icon.font = .systemFont(ofSize: 16, weight: .bold)
            icon.translatesAutoresizingMaskIntoConstraints = false
            row.addSubview(icon)
            
            let lbl = NSTextField(labelWithString: name)
            lbl.textColor = .consoleText
            lbl.translatesAutoresizingMaskIntoConstraints = false
            row.addSubview(lbl)
            
            let t = NSTextField(labelWithString: time)
            t.textColor = .consoleText3
            t.font = .systemFont(ofSize: 11)
            t.translatesAutoresizingMaskIntoConstraints = false
            row.addSubview(t)
            
            NSLayoutConstraint.activate([
                icon.leadingAnchor.constraint(equalTo: row.leadingAnchor, constant: 12),
                icon.centerYAnchor.constraint(equalTo: row.centerYAnchor),
                lbl.leadingAnchor.constraint(equalTo: icon.trailingAnchor, constant: 12),
                lbl.centerYAnchor.constraint(equalTo: row.centerYAnchor),
                t.trailingAnchor.constraint(equalTo: row.trailingAnchor, constant: -12),
                t.centerYAnchor.constraint(equalTo: row.centerYAnchor)
            ])
            stack.addArrangedSubview(row)
        }
        return v
    }
}

final class QATestReportController: NSViewController {
    override func loadView() {
        let v = NSView()
        v.translatesAutoresizingMaskIntoConstraints = false
        
        let stack = NSStackView()
        stack.orientation = .vertical
        stack.spacing = 20
        stack.edgeInsets = NSEdgeInsets(top: 24, left: 24, bottom: 24, right: 24)
        stack.translatesAutoresizingMaskIntoConstraints = false
        v.addSubview(stack)
        
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: v.topAnchor),
            stack.leadingAnchor.constraint(equalTo: v.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: v.trailingAnchor)
        ])
        
        // Stats grid
        let stats = NSStackView()
        stats.distribution = .fillEqually
        stats.spacing = 16
        stats.translatesAutoresizingMaskIntoConstraints = false
        stack.addArrangedSubview(stats)
        
        func createStat(num: String, label: String, color: NSColor) -> NSView {
            let box = NSView()
            box.wantsLayer = true
            box.layer?.cornerRadius = 8
            box.layer?.backgroundColor = color.withAlphaComponent(0.1).cgColor
            box.layer?.borderColor = color.withAlphaComponent(0.3).cgColor
            box.layer?.borderWidth = 1
            box.heightAnchor.constraint(equalToConstant: 80).isActive = true
            
            let n = NSTextField(labelWithString: num)
            n.font = .systemFont(ofSize: 24, weight: .bold)
            n.textColor = color
            n.translatesAutoresizingMaskIntoConstraints = false
            box.addSubview(n)
            
            let l = NSTextField(labelWithString: label)
            l.font = .systemFont(ofSize: 12)
            l.textColor = .consoleText3
            l.translatesAutoresizingMaskIntoConstraints = false
            box.addSubview(l)
            
            NSLayoutConstraint.activate([
                n.centerXAnchor.constraint(equalTo: box.centerXAnchor),
                n.topAnchor.constraint(equalTo: box.topAnchor, constant: 12),
                l.centerXAnchor.constraint(equalTo: box.centerXAnchor),
                l.bottomAnchor.constraint(equalTo: box.bottomAnchor, constant: -12)
            ])
            return box
        }
        
        stats.addArrangedSubview(createStat(num: "42", label: "通过", color: .consoleGreen))
        stats.addArrangedSubview(createStat(num: "3", label: "警告", color: .consoleYellow))
        stats.addArrangedSubview(createStat(num: "1", label: "失败", color: .consoleRed))
        
        // Coverage titles
        let coverageTitle = NSTextField(labelWithString: "代码覆盖率")
        coverageTitle.font = .systemFont(ofSize: 14, weight: .semibold)
        stack.addArrangedSubview(coverageTitle)
        
        func createProgress(label: String, val: Double, color: NSColor) -> NSView {
            let row = NSView()
            row.heightAnchor.constraint(equalToConstant: 32).isActive = true
            let l = NSTextField(labelWithString: label)
            l.font = .systemFont(ofSize: 12)
            l.textColor = .consoleText2
            l.translatesAutoresizingMaskIntoConstraints = false
            row.addSubview(l)
            
            let bar = ConsoleProgressBar()
            bar.progress = val
            bar.translatesAutoresizingMaskIntoConstraints = false
            row.addSubview(bar)
            
            let p = NSTextField(labelWithString: "\(Int(val * 100))%")
            p.font = .systemFont(ofSize: 12)
            p.textColor = color
            p.translatesAutoresizingMaskIntoConstraints = false
            row.addSubview(p)
            
            NSLayoutConstraint.activate([
                l.leadingAnchor.constraint(equalTo: row.leadingAnchor),
                l.centerYAnchor.constraint(equalTo: row.centerYAnchor),
                bar.leadingAnchor.constraint(equalTo: row.leadingAnchor, constant: 80),
                bar.trailingAnchor.constraint(equalTo: row.trailingAnchor, constant: -40),
                bar.centerYAnchor.constraint(equalTo: row.centerYAnchor),
                bar.heightAnchor.constraint(equalToConstant: 8),
                p.trailingAnchor.constraint(equalTo: row.trailingAnchor),
                p.centerYAnchor.constraint(equalTo: row.centerYAnchor)
            ])
            return row
        }
        
        stack.addArrangedSubview(createProgress(label: "语句", val: 0.85, color: .consoleGreen))
        stack.addArrangedSubview(createProgress(label: "分支", val: 0.72, color: .consoleYellow))
        stack.addArrangedSubview(createProgress(label: "函数", val: 0.91, color: .consoleGreen))
        
        view = v
    }
    
    private func createPlaceholder() -> NSView {
        let l = NSTextField(labelWithString: "内容载入中 (Mock)")
        l.textColor = .consoleText3
        let v = NSView(); v.addSubview(l)
        l.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([l.centerXAnchor.constraint(equalTo: v.centerXAnchor), l.centerYAnchor.constraint(equalTo: v.centerYAnchor)])
        return v
    }
    
    private func createTestResults() -> NSView {
        let v = NSView()
        let stack = NSStackView()
        stack.orientation = .vertical
        stack.spacing = 8
        stack.edgeInsets = NSEdgeInsets(top: 20, left: 20, bottom: 20, right: 20)
        stack.translatesAutoresizingMaskIntoConstraints = false
        v.addSubview(stack)
        
        let results = [("用户登录验证", true), ("API 连通性测试", true), ("性能压测", false)]
        for (name, success) in results {
            let row = NSView()
            row.wantsLayer = true
            row.layer?.cornerRadius = 6
            row.layer?.backgroundColor = success ? NSColor.consoleGreen.withAlphaComponent(0.1).cgColor : NSColor.consoleRed.withAlphaComponent(0.1).cgColor
            row.translatesAutoresizingMaskIntoConstraints = false
            row.heightAnchor.constraint(equalToConstant: 40).isActive = true
            
            let icon = NSTextField(labelWithString: success ? "✓" : "✗")
            icon.textColor = success ? .consoleGreen : .consoleRed
            icon.font = .systemFont(ofSize: 16, weight: .bold)
            icon.translatesAutoresizingMaskIntoConstraints = false
            row.addSubview(icon)
            
            let label = NSTextField(labelWithString: name)
            label.textColor = .consoleText
            label.translatesAutoresizingMaskIntoConstraints = false
            row.addSubview(label)
            
            NSLayoutConstraint.activate([
                icon.leadingAnchor.constraint(equalTo: row.leadingAnchor, constant: 12),
                icon.centerYAnchor.constraint(equalTo: row.centerYAnchor),
                label.leadingAnchor.constraint(equalTo: icon.trailingAnchor, constant: 12),
                label.centerYAnchor.constraint(equalTo: row.centerYAnchor)
            ])
            stack.addArrangedSubview(row)
        }
        return v
    }
}

// MARK: - Message Flow

final class MessageFlowViewController: NSViewController {
    override func loadView() {
        view = NSView()
        view.translatesAutoresizingMaskIntoConstraints = false
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor.consoleZ950.cgColor
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        let title = NSTextField(labelWithString: "全局消息流")
        title.translatesAutoresizingMaskIntoConstraints = false
        title.font = .systemFont(ofSize: 18, weight: .bold)
        title.textColor = .consoleText
        title.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(title)
        
        let scroll = NSScrollView()
        scroll.drawsBackground = false
        scroll.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scroll)
        
        let stack = NSStackView()
        stack.orientation = .vertical
        stack.spacing = 20
        stack.edgeInsets = NSEdgeInsets(top: 20, left: 40, bottom: 20, right: 40)
        stack.translatesAutoresizingMaskIntoConstraints = false
        scroll.documentView = stack
        
        NSLayoutConstraint.activate([
            title.topAnchor.constraint(equalTo: view.topAnchor, constant: 20),
            title.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            scroll.topAnchor.constraint(equalTo: title.bottomAnchor, constant: 20),
            scroll.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scroll.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            stack.widthAnchor.constraint(equalTo: scroll.widthAnchor)
        ])
        
        // Add mock timeline items
        for agent in MockData.agents {
            for msg in agent.messages where msg.sender == .ai {
                let item = createTimelineItem(for: agent, msg: msg)
                stack.addArrangedSubview(item)
            }
        }
    }
    
    private func createTimelineItem(for agent: AIAgent, msg: AIMessage) -> NSView {
        let v = NSView()
        let bubble = NSView()
        bubble.wantsLayer = true
        bubble.layer?.cornerRadius = 8
        bubble.layer?.backgroundColor = NSColor.consoleZ900.withAlphaComponent(0.5).cgColor
        bubble.layer?.borderColor = NSColor.consoleZ800.cgColor
        bubble.layer?.borderWidth = 1
        bubble.translatesAutoresizingMaskIntoConstraints = false
        v.addSubview(bubble)
        
        let name = NSTextField(labelWithString: agent.name)
        name.font = .systemFont(ofSize: 13, weight: .semibold)
        name.textColor = agent.role.color
        name.translatesAutoresizingMaskIntoConstraints = false
        v.addSubview(name)
        
        let content = NSTextField(labelWithString: msg.content)
        content.font = .systemFont(ofSize: 13)
        content.textColor = .consoleText2
        content.maximumNumberOfLines = 0
        content.translatesAutoresizingMaskIntoConstraints = false
        bubble.addSubview(content)
        
        NSLayoutConstraint.activate([
            name.topAnchor.constraint(equalTo: v.topAnchor),
            name.leadingAnchor.constraint(equalTo: v.leadingAnchor),
            bubble.topAnchor.constraint(equalTo: name.bottomAnchor, constant: 8),
            bubble.leadingAnchor.constraint(equalTo: v.leadingAnchor),
            bubble.trailingAnchor.constraint(equalTo: v.trailingAnchor),
            bubble.bottomAnchor.constraint(equalTo: v.bottomAnchor),
            content.topAnchor.constraint(equalTo: bubble.topAnchor, constant: 12),
            content.leadingAnchor.constraint(equalTo: bubble.leadingAnchor, constant: 12),
            content.trailingAnchor.constraint(equalTo: bubble.trailingAnchor, constant: -12),
            content.bottomAnchor.constraint(equalTo: bubble.bottomAnchor, constant: -12)
        ])
        return v
    }
}

// MARK: - AI Config

final class AIConfigViewController: NSViewController {
    private let listStack = NSStackView()
    private let rightArea = NSView()
    private var selectedAgentId: String?
    
    override func loadView() {
        view = NSView()
        view.translatesAutoresizingMaskIntoConstraints = false
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor.consoleZ950.cgColor
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        let split = NSSplitView()
        split.isVertical = true
        split.dividerStyle = .thin
        split.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(split)
        
        let left = NSView()
        rightArea.translatesAutoresizingMaskIntoConstraints = false
        split.addArrangedSubview(left)
        split.addArrangedSubview(rightArea)
        
        NSLayoutConstraint.activate([
            split.topAnchor.constraint(equalTo: view.topAnchor),
            split.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            split.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            split.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            left.widthAnchor.constraint(equalToConstant: 320)
        ])
        
        let title = NSTextField(labelWithString: "AI 配置中心")
        title.font = .systemFont(ofSize: 16, weight: .semibold)
        title.translatesAutoresizingMaskIntoConstraints = false
        left.addSubview(title)
        
        let scroll = NSScrollView()
        scroll.drawsBackground = false
        scroll.translatesAutoresizingMaskIntoConstraints = false
        left.addSubview(scroll)
        
        listStack.orientation = .vertical
        listStack.spacing = 10
        listStack.edgeInsets = NSEdgeInsets(top: 0, left: 16, bottom: 20, right: 16)
        listStack.translatesAutoresizingMaskIntoConstraints = false
        scroll.documentView = listStack
        
        NSLayoutConstraint.activate([
            title.topAnchor.constraint(equalTo: left.topAnchor, constant: 20),
            title.leadingAnchor.constraint(equalTo: left.leadingAnchor, constant: 16),
            scroll.topAnchor.constraint(equalTo: left.topAnchor, constant: 60),
            scroll.leadingAnchor.constraint(equalTo: left.leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo: left.trailingAnchor),
            scroll.bottomAnchor.constraint(equalTo: left.bottomAnchor),
            listStack.widthAnchor.constraint(equalTo: scroll.widthAnchor)
        ])
        
        updateList()
        showEmptyState()
    }
    
    private func updateList() {
        listStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
        for agent in MockData.agents {
            let card = ConsoleAICard(agent: agent)
            card.isSelected = agent.id == selectedAgentId
            card.heightAnchor.constraint(equalToConstant: 76).isActive = true
            card.onTap = { [weak self] in
                self?.selectedAgentId = agent.id
                self?.updateList()
                self?.showForm(for: agent)
            }
            listStack.addArrangedSubview(card)
        }
    }
    
    private func showEmptyState() {
        rightArea.subviews.forEach { $0.removeFromSuperview() }
        let l = NSTextField(labelWithString: "选择一个 AI 进行配置")
        l.textColor = .consoleText3
        l.translatesAutoresizingMaskIntoConstraints = false
        rightArea.addSubview(l)
        NSLayoutConstraint.activate([
            l.centerXAnchor.constraint(equalTo: rightArea.centerXAnchor),
            l.centerYAnchor.constraint(equalTo: rightArea.centerYAnchor)
        ])
    }
    
    private func showForm(for agent: AIAgent) {
        rightArea.subviews.forEach { $0.removeFromSuperview() }
        
        let header = NSView()
        header.translatesAutoresizingMaskIntoConstraints = false
        rightArea.addSubview(header)
        let title = NSTextField(labelWithString: "配置 \(agent.name)")
        title.font = .systemFont(ofSize: 14, weight: .semibold)
        title.translatesAutoresizingMaskIntoConstraints = false
        header.addSubview(title)
        
        let border = NSView()
        border.wantsLayer = true
        border.layer?.backgroundColor = NSColor.consoleZ800.cgColor
        border.translatesAutoresizingMaskIntoConstraints = false
        rightArea.addSubview(border)
        
        let form = NSStackView()
        form.orientation = .vertical
        form.spacing = 24
        form.edgeInsets = NSEdgeInsets(top: 24, left: 24, bottom: 24, right: 24)
        form.translatesAutoresizingMaskIntoConstraints = false
        rightArea.addSubview(form)
        
        func createSection(title: String, fields: [(String, String)]) -> NSView {
            let card = NSView()
            card.wantsLayer = true
            card.layer?.cornerRadius = 8
            card.layer?.backgroundColor = NSColor.consoleZ900.withAlphaComponent(0.5).cgColor
            card.layer?.borderColor = NSColor.consoleZ800.cgColor
            card.layer?.borderWidth = 1
            card.translatesAutoresizingMaskIntoConstraints = false
            
            let stack = NSStackView()
            stack.orientation = .vertical
            stack.spacing = 12
            stack.edgeInsets = NSEdgeInsets(top: 16, left: 16, bottom: 16, right: 16)
            stack.translatesAutoresizingMaskIntoConstraints = false
            card.addSubview(stack)
            
            let t = NSTextField(labelWithString: title)
            t.font = .systemFont(ofSize: 12, weight: .bold)
            t.textColor = .consoleBlue
            stack.addArrangedSubview(t)
            
            for (label, val) in fields {
                let l = NSTextField(labelWithString: label)
                l.font = .systemFont(ofSize: 11)
                l.textColor = .consoleText2
                stack.addArrangedSubview(l)
                
                let f = ConsoleTextField()
                f.stringValue = val
                f.heightAnchor.constraint(equalToConstant: 32).isActive = true
                stack.addArrangedSubview(f)
            }
            
            NSLayoutConstraint.activate([
                stack.topAnchor.constraint(equalTo: card.topAnchor),
                stack.leadingAnchor.constraint(equalTo: card.leadingAnchor),
                stack.trailingAnchor.constraint(equalTo: card.trailingAnchor),
                stack.bottomAnchor.constraint(equalTo: card.bottomAnchor)
            ])
            return card
        }
        
        let basic = createSection(title: "基本信息", fields: [("名称", agent.name), ("角色", agent.role.label)])
        form.addArrangedSubview(basic)
        
        let advanced: NSView
        switch agent.type {
        case .web: advanced = createSection(title: "Web 配置", fields: [("网页 URL", agent.url ?? "")])
        case .api: advanced = createSection(title: "API 配置", fields: [("API 端点", agent.apiEndpoint ?? ""), ("模型", agent.model ?? "")])
        case .cli: advanced = createSection(title: "CLI 配置", fields: [("命令", agent.command ?? "")])
        }
        form.addArrangedSubview(advanced)
        
        let saveBtn = NSButton(title: "保存配置", target: self, action: #selector(saveTapped))
        saveBtn.translatesAutoresizingMaskIntoConstraints = false
        saveBtn.bezelStyle = .rounded
        form.addArrangedSubview(saveBtn)
        
        NSLayoutConstraint.activate([
            header.topAnchor.constraint(equalTo: rightArea.topAnchor),
            header.leadingAnchor.constraint(equalTo: rightArea.leadingAnchor),
            header.trailingAnchor.constraint(equalTo: rightArea.trailingAnchor),
            header.heightAnchor.constraint(equalToConstant: 60),
            title.centerYAnchor.constraint(equalTo: header.centerYAnchor),
            title.leadingAnchor.constraint(equalTo: header.leadingAnchor, constant: 16),
            border.topAnchor.constraint(equalTo: header.bottomAnchor),
            border.leadingAnchor.constraint(equalTo: rightArea.leadingAnchor),
            border.trailingAnchor.constraint(equalTo: rightArea.trailingAnchor),
            border.heightAnchor.constraint(equalToConstant: 1),
            form.topAnchor.constraint(equalTo: border.bottomAnchor),
            form.leadingAnchor.constraint(equalTo: rightArea.leadingAnchor),
            form.trailingAnchor.constraint(equalTo: rightArea.trailingAnchor)
        ])
    }
    
    @objc private func saveTapped() {
        let alert = NSAlert()
        alert.messageText = "保存成功"
        alert.informativeText = "AI 配置已更新。"
        alert.addButton(withTitle: "确定")
        alert.runModal()
    }
}

// MARK: - Settings

final class SettingsPlaceholderViewController: NSViewController {
    override func loadView() {
        view = NSView()
        view.translatesAutoresizingMaskIntoConstraints = false
        let label = NSTextField(labelWithString: "设置页面")
        label.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(label)
        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            label.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        ])
    }
}

// MARK: - Activity View Controller

final class ConsoleActivityViewController: NSViewController {
    override func loadView() {
        view = NSView()
        view.translatesAutoresizingMaskIntoConstraints = false
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor.consoleZ900.withAlphaComponent(0.5).cgColor
        
        let border = NSView()
        border.wantsLayer = true
        border.layer?.backgroundColor = NSColor.consoleZ800.cgColor
        border.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(border)
        
        NSLayoutConstraint.activate([
            border.topAnchor.constraint(equalTo: view.topAnchor),
            border.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            border.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            border.widthAnchor.constraint(equalToConstant: 1)
        ])
        
        let title = NSTextField(labelWithString: "实时活动")
        title.font = .systemFont(ofSize: 16, weight: .semibold)
        title.textColor = .consoleText
        title.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(title)
        
        let sub = NSTextField(labelWithString: "系统消息流")
        sub.font = .systemFont(ofSize: 14)
        sub.textColor = .consoleText2
        sub.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(sub)
        
        NSLayoutConstraint.activate([
            title.topAnchor.constraint(equalTo: view.topAnchor, constant: 16),
            title.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            sub.topAnchor.constraint(equalTo: title.bottomAnchor, constant: 4),
            sub.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16)
        ])
    }
}

// MARK: - Common Components

final class ConsoleTextField: NSTextField {
    override init(frame: NSRect) {
        super.init(frame: frame)
        applyStyle()
    }
    required init?(coder: NSCoder) { fatalError() }
    
    private func applyStyle() {
        wantsLayer = true
        layer?.cornerRadius = 6
        layer?.backgroundColor = NSColor.consoleZ900.cgColor
        layer?.borderColor = NSColor.consoleZ700.cgColor
        layer?.borderWidth = 1
        textColor = .white
        isBezeled = false
        focusRingType = .none
    }
    
    override var placeholderString: String? {
        didSet {
            if let v = placeholderString {
                (cell as? NSTextFieldCell)?.placeholderAttributedString = NSAttributedString(
                    string: v,
                    attributes: [
                        .foregroundColor: NSColor.consoleText3,
                        .font: NSFont.systemFont(ofSize: 12)
                    ]
                )
            }
        }
    }
}

final class ConsoleSendButton: NSButton {
    init() {
        super.init(frame: .zero)
        image = NSImage(systemSymbolName: "paperplane.fill", accessibilityDescription: "发送")
        contentTintColor = .white
        isBordered = false
        wantsLayer = true
        layer?.cornerRadius = 6
        layer?.backgroundColor = NSColor.consoleBlueDark.cgColor
    }
    required init?(coder: NSCoder) { fatalError() }
}

final class ConsoleStatusDot: NSView {
    private let dot = NSView()
    init(status: AIAgentStatus) {
        super.init(frame: .zero)
        dot.wantsLayer = true
        dot.layer?.cornerRadius = 4
        dot.layer?.backgroundColor = status.color.cgColor
        dot.translatesAutoresizingMaskIntoConstraints = false
        addSubview(dot)
        NSLayoutConstraint.activate([
            dot.centerXAnchor.constraint(equalTo: centerXAnchor),
            dot.centerYAnchor.constraint(equalTo: centerYAnchor),
            dot.widthAnchor.constraint(equalToConstant: 8),
            dot.heightAnchor.constraint(equalToConstant: 8)
        ])
        
        if status.hasPulse {
            let anim = CABasicAnimation(keyPath: "opacity")
            anim.fromValue = 1.0
            anim.toValue = 0.3
            anim.duration = 1.0
            anim.autoreverses = true
            anim.repeatCount = .infinity
            dot.layer?.add(anim, forKey: "pulse")
        }
    }
    required init?(coder: NSCoder) { fatalError() }
}

final class ConsoleProgressBar: NSView {
    private let fill = NSView()
    private var progressConstraint: NSLayoutConstraint?
    var progress: Double = 0 {
        didSet { updateFill() }
    }
    
    override init(frame: NSRect) {
        super.init(frame: frame)
        wantsLayer = true
        layer?.cornerRadius = 4
        layer?.backgroundColor = NSColor.consoleZ800.cgColor
        
        fill.wantsLayer = true
        fill.layer?.cornerRadius = 4
        fill.translatesAutoresizingMaskIntoConstraints = false
        addSubview(fill)
        
        // Define a base gradient
        let grad = CAGradientLayer()
        grad.colors = [NSColor.consoleBlue.cgColor, NSColor(hex: "#06B6D4").cgColor]
        grad.startPoint = CGPoint(x: 0, y: 0.5)
        grad.endPoint = CGPoint(x: 1, y: 0.5)
        grad.cornerRadius = 4
        fill.layer?.addSublayer(grad)
        
        NSLayoutConstraint.activate([
            fill.topAnchor.constraint(equalTo: topAnchor),
            fill.leadingAnchor.constraint(equalTo: leadingAnchor),
            fill.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
        progressConstraint = fill.widthAnchor.constraint(equalTo: widthAnchor, multiplier: 0)
        progressConstraint?.isActive = true
    }
    required init?(coder: NSCoder) { fatalError() }
    
    override func layout() {
        super.layout()
        fill.layer?.sublayers?.first?.frame = fill.bounds
    }

    private func updateFill() {
        progressConstraint?.isActive = false
        progressConstraint = fill.widthAnchor.constraint(equalTo: widthAnchor, multiplier: CGFloat(max(0, min(1, progress))))
        progressConstraint?.isActive = true
        needsLayout = true
    }
}

final class ConsoleRoleBadge: NSView {
    init(role: AIRole) {
        super.init(frame: .zero)
        wantsLayer = true
        layer?.cornerRadius = 4
        layer?.backgroundColor = role.color.withAlphaComponent(0.2).cgColor
        layer?.borderColor = role.color.withAlphaComponent(0.3).cgColor
        layer?.borderWidth = 1
        
        let label = NSTextField(labelWithString: role.label)
        label.font = .systemFont(ofSize: 11)
        label.textColor = role.color
        label.translatesAutoresizingMaskIntoConstraints = false
        addSubview(label)
        
        NSLayoutConstraint.activate([
            label.topAnchor.constraint(equalTo: topAnchor, constant: 2),
            label.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -2),
            label.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 6),
            label.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -6)
        ])
    }
    required init?(coder: NSCoder) { fatalError() }
}

final class ConsoleAICard: NSView {
    var isSelected: Bool = false {
        didSet {
            layer?.backgroundColor = isSelected ? NSColor.consoleZ800.cgColor : NSColor.clear.cgColor
            layer?.borderColor = isSelected ? NSColor.consoleBlue.withAlphaComponent(0.5).cgColor : NSColor.consoleZ800.cgColor
        }
    }
    var onTap: (() -> Void)?
    
    init(agent: AIAgent) {
        super.init(frame: .zero)
        wantsLayer = true
        layer?.cornerRadius = 8
        layer?.borderColor = NSColor.consoleZ800.cgColor
        layer?.borderWidth = 1
        
        let iconBox = NSView()
        iconBox.wantsLayer = true
        iconBox.layer?.cornerRadius = 8
        iconBox.layer?.backgroundColor = NSColor.consoleBlue.withAlphaComponent(0.2).cgColor
        iconBox.layer?.borderColor = NSColor.consoleBlue.withAlphaComponent(0.3).cgColor
        iconBox.layer?.borderWidth = 1
        iconBox.translatesAutoresizingMaskIntoConstraints = false
        addSubview(iconBox)
        
        let icon = NSImageView()
        icon.image = NSImage(systemSymbolName: "brain", accessibilityDescription: nil)
        icon.contentTintColor = NSColor(hex: "#60A5FA")
        icon.translatesAutoresizingMaskIntoConstraints = false
        iconBox.addSubview(icon)
        
        let name = NSTextField(labelWithString: agent.name)
        name.font = .systemFont(ofSize: 14, weight: .medium)
        name.textColor = .consoleText
        name.translatesAutoresizingMaskIntoConstraints = false
        addSubview(name)
        
        let dot = ConsoleStatusDot(status: agent.status)
        dot.translatesAutoresizingMaskIntoConstraints = false
        addSubview(dot)
        
        let roleTag = ConsoleRoleBadge(role: agent.role)
        roleTag.translatesAutoresizingMaskIntoConstraints = false
        addSubview(roleTag)
        
        NSLayoutConstraint.activate([
            iconBox.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),
            iconBox.centerYAnchor.constraint(equalTo: centerYAnchor),
            iconBox.widthAnchor.constraint(equalToConstant: 40),
            iconBox.heightAnchor.constraint(equalToConstant: 40),
            icon.centerXAnchor.constraint(equalTo: iconBox.centerXAnchor),
            icon.centerYAnchor.constraint(equalTo: iconBox.centerYAnchor),
            
            name.topAnchor.constraint(equalTo: iconBox.topAnchor),
            name.leadingAnchor.constraint(equalTo: iconBox.trailingAnchor, constant: 12),
            
            dot.centerYAnchor.constraint(equalTo: name.centerYAnchor),
            dot.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
            
            roleTag.bottomAnchor.constraint(equalTo: iconBox.bottomAnchor),
            roleTag.leadingAnchor.constraint(equalTo: iconBox.trailingAnchor, constant: 12)
        ])
    }
    required init?(coder: NSCoder) { fatalError() }
    
    override func mouseDown(with event: NSEvent) {
        onTap?()
    }
}
