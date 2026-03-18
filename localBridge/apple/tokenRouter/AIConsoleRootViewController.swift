import AppKit

// MARK: - Root View Controller

final class AIConsoleRootViewController: NSViewController {
    private let initialSelectedIndex: Int
    private let navVC      = ConsoleNavViewController()
    private let parentSplitView = NSSplitView() // Vertical: main area vs terminal
    private let mainSplitView   = NSSplitView() // Horizontal: sidebar vs work vs activity
    
    private let sidebarVC  = ConsoleSidebarViewController()
    private let workVC     = ConsoleWorkspaceViewController()
    private let activityVC = ConsoleActivityViewController()
    private let terminalVC = ConsoleTerminalViewController()

    private var didSetInitialDividers = false
    private var lastAppearanceMatch: NSAppearance.Name?
    private(set) var currentSelectedIndex: Int

    init(selectedIndex: Int = 0) {
        self.initialSelectedIndex = selectedIndex
        self.currentSelectedIndex = selectedIndex
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError()
    }

    // MARK: - View Lifecycle

    override func loadView() {
        print("RootVC: loadView")
        let rootView = ThemeAwareView()
        rootView.wantsLayer = true
        rootView.layer?.backgroundColor = NSColor.consoleZ950.cgColor
        rootView.onEffectiveAppearanceChange = { [weak self] in
            self?.handleEffectiveAppearanceChange()
        }
        view = rootView
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        lastAppearanceMatch = effectiveAppearanceName()
        setupNav()
        setupTopToolbar()
        setupSplitViews()
        navVC.delegate = self
        if initialSelectedIndex != 0 {
            navVC.selectTab(at: initialSelectedIndex)
        }
    }

    override func viewDidLayout() {
        super.viewDidLayout()
        guard !didSetInitialDividers, mainSplitView.frame.width > 0 else { return }
        didSetInitialDividers = true
        applyInitialDividers()
    }

    private func handleEffectiveAppearanceChange() {
        let currentMatch = effectiveAppearanceName()
        guard currentMatch != lastAppearanceMatch else { return }
        lastAppearanceMatch = currentMatch
        ThemeManager.shared.notifySystemAppearanceChangedIfNeeded()
    }

    // MARK: - 初始分割线
    private func applyInitialDividers() {
        let totalW = mainSplitView.frame.width
        let sidebarW: CGFloat = 220
        let activityW: CGFloat = 260
        mainSplitView.setPosition(sidebarW, ofDividerAt: 0)
        mainSplitView.setPosition(totalW - activityW, ofDividerAt: 1)

        let totalH = parentSplitView.frame.height
        parentSplitView.setPosition(totalH - 180, ofDividerAt: 0)
        
        // 初始隐藏终端
        terminalVC.view.isHidden = true
    }

    private func effectiveAppearanceName() -> NSAppearance.Name? {
        view.effectiveAppearance.bestMatch(from: [.darkAqua, .aqua])
    }

    // MARK: - Setup
    private func setupNav() {
        addChild(navVC)
        navVC.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(navVC.view)
        NSLayoutConstraint.activate([
            navVC.view.topAnchor.constraint(equalTo: view.topAnchor),
            navVC.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            navVC.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            navVC.view.widthAnchor.constraint(equalToConstant: 64)
        ])
    }

    private func setupTopToolbar() {
        let topBar = NSView()
        topBar.wantsLayer = true
        topBar.layer?.backgroundColor = NSColor.consoleZ950.cgColor
        topBar.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(topBar)
        
        // 标题与项目信息
        let projectTitle = NSTextField(labelWithString: "Antigravity Bridge")
        projectTitle.font = .systemFont(ofSize: 12, weight: .bold)
        projectTitle.textColor = .consoleText
        projectTitle.translatesAutoresizingMaskIntoConstraints = false
        topBar.addSubview(projectTitle)

        let toolbar = NSStackView()
        toolbar.orientation = .horizontal
        toolbar.spacing = 8
        toolbar.translatesAutoresizingMaskIntoConstraints = false
        topBar.addSubview(toolbar)

        let btnSidebar  = makeToolbarButton(icon: "sidebar.left", action: #selector(toggleSidebar), tip: "显示/隐藏侧边栏")
        let btnBottom   = makeToolbarButton(icon: "rectangle.bottomthird.inset.filled", action: #selector(toggleBottomPanel), tip: "显示/隐藏终端")
        let btnActivity = makeToolbarButton(icon: "sidebar.right", action: #selector(toggleActivity), tip: "显示/隐藏活动面板")
        let btnSettings = makeToolbarButton(icon: "gearshape", action: #selector(openSettings), tip: "设置")

        [btnSidebar, btnBottom, btnActivity, btnSettings].forEach { toolbar.addArrangedSubview($0) }

        NSLayoutConstraint.activate([
            topBar.topAnchor.constraint(equalTo: view.topAnchor),
            topBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            topBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            topBar.heightAnchor.constraint(equalToConstant: 40),
            
            projectTitle.centerYAnchor.constraint(equalTo: topBar.centerYAnchor),
            projectTitle.leadingAnchor.constraint(equalTo: topBar.leadingAnchor, constant: 80),
            
            toolbar.centerYAnchor.constraint(equalTo: topBar.centerYAnchor),
            toolbar.trailingAnchor.constraint(equalTo: topBar.trailingAnchor, constant: -12),
        ])
        
        let border = NSView()
        border.wantsLayer = true
        border.layer?.backgroundColor = NSColor.consoleZ700.cgColor
        border.translatesAutoresizingMaskIntoConstraints = false
        topBar.addSubview(border)
        NSLayoutConstraint.activate([
            border.leadingAnchor.constraint(equalTo: topBar.leadingAnchor),
            border.trailingAnchor.constraint(equalTo: topBar.trailingAnchor),
            border.bottomAnchor.constraint(equalTo: topBar.bottomAnchor),
            border.heightAnchor.constraint(equalToConstant: 1)
        ])
    }

    private func makeToolbarButton(icon: String, action: Selector, tip: String) -> NSButton {
        let btn = NSButton()
        btn.image = NSImage(systemSymbolName: icon, accessibilityDescription: tip)
        btn.isBordered = false
        btn.contentTintColor = .consoleText2
        btn.target = self
        btn.action = action
        btn.toolTip = tip
        btn.translatesAutoresizingMaskIntoConstraints = false
        btn.widthAnchor.constraint(equalToConstant: 28).isActive = true
        btn.heightAnchor.constraint(equalToConstant: 28).isActive = true
        return btn
    }

    private func setupSplitViews() {
        parentSplitView.isVertical = false // Vertical split
        parentSplitView.dividerStyle = .thin
        parentSplitView.delegate = self
        parentSplitView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(parentSplitView)

        mainSplitView.isVertical = true // Horizontal split
        mainSplitView.dividerStyle = .thin
        mainSplitView.delegate = self
        
        [sidebarVC, workVC, activityVC].forEach {
            addChild($0)
            mainSplitView.addArrangedSubview($0.view)
        }

        addChild(terminalVC)
        parentSplitView.addArrangedSubview(mainSplitView)
        parentSplitView.addArrangedSubview(terminalVC.view)

        NSLayoutConstraint.activate([
            parentSplitView.topAnchor.constraint(equalTo: view.topAnchor, constant: 40),
            parentSplitView.leadingAnchor.constraint(equalTo: navVC.view.trailingAnchor),
            parentSplitView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            parentSplitView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }

    // MARK: - Actions
    @objc private func toggleSidebar() {
        animateToggle(view: sidebarVC.view, split: mainSplitView)
    }

    @objc private func toggleActivity() {
        animateToggle(view: activityVC.view, split: mainSplitView)
    }

    @objc private func toggleBottomPanel() {
        animateToggle(view: terminalVC.view, split: parentSplitView)
    }

    @objc private func openSettings() {
        let settingsVC = AIKeySettingsViewController()
        self.presentAsSheet(settingsVC)
    }

    private func animateToggle(view: NSView, split: NSSplitView) {
        let isHidden = view.isHidden
        NSAnimationContext.runAnimationGroup { ctx in
            ctx.duration = 0.2
            ctx.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
            view.isHidden = !isHidden
            split.adjustSubviews() // 关键：调这个而不是 layoutSubtree，强制重新分配空间
        }
    }

    // MARK: - Key Shortcuts
    override func performKeyEquivalent(with event: NSEvent) -> Bool {
        let flags = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
        if flags == .command {
            if let chars = event.charactersIgnoringModifiers,
               let firstChar = chars.first,
               let num = Int(String(firstChar)), num >= 1 && num <= 6 {
                navVC.selectTab(at: num - 1)
                return true
            }
        }
        return super.performKeyEquivalent(with: event)
    }
}

// MARK: - NSSplitViewDelegate
extension AIConsoleRootViewController: NSSplitViewDelegate {
    func splitView(_ splitView: NSSplitView, constrainMinCoordinate proposedMin: CGFloat, ofSubviewAt index: Int) -> CGFloat {
        if splitView == mainSplitView {
            if index == 0 { return 160 }
            if index == 1 { return 400 }
        }
        return proposedMin
    }

    func splitView(_ splitView: NSSplitView, effectiveRect proposedEffectiveRect: NSRect, forDrawnRect drawnRect: NSRect, ofDividerAt dividerIndex: Int) -> NSRect {
        proposedEffectiveRect.insetBy(dx: -3, dy: -3)
    }
}

// MARK: - ConsoleNavDelegate
extension AIConsoleRootViewController: ConsoleNavDelegate {
    func didSelectNavItem(at index: Int) {
        currentSelectedIndex = index
        sidebarVC.update(for: index)
        workVC.switchTo(index: index)
    }
}
