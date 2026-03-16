import AppKit

// MARK: - Root View Controller

final class AIConsoleRootViewController: NSViewController {
    private let navVC          = ConsoleNavViewController()
    private let splitView      = NSSplitView()
    private let sidebarVC      = ConsoleSidebarViewController()
    private let workVC         = ConsoleWorkspaceViewController()
    private let activityVC     = ConsoleActivityViewController()

    private let sidebarToggleBtn  = NSButton()
    private let activityToggleBtn = NSButton()

    private var lastSidebarWidth:  CGFloat = 220
    private var lastActivityWidth: CGFloat = 260

    // MARK: View Lifecycle

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

    // MARK: Setup

    private func setupNav() {
        addChild(navVC)
        navVC.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(navVC.view)

        NSLayoutConstraint.activate([
            navVC.view.topAnchor.constraint(equalTo: view.topAnchor),
            navVC.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            navVC.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            navVC.view.widthAnchor.constraint(equalToConstant: 48)
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

        // 侧边栏 220，右侧活动面板 260
        splitView.setPosition(220, ofDividerAt: 0)
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            let totalWidth = self.splitView.frame.width
            self.splitView.setPosition(totalWidth - 260, ofDividerAt: 1)
        }
    }

    private func setupToggleButtons() {
        [sidebarToggleBtn, activityToggleBtn].forEach { btn in
            btn.wantsLayer = true
            btn.layer?.cornerRadius = 12
            btn.layer?.backgroundColor = NSColor.consoleZ800.cgColor
            btn.layer?.borderColor = NSColor.consoleZ700.cgColor
            btn.layer?.borderWidth = 1
            btn.isBordered = false
            btn.title = ""
            btn.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview(btn)
        }

        sidebarToggleBtn.image = NSImage(systemSymbolName: "chevron.left", accessibilityDescription: nil)
        sidebarToggleBtn.contentTintColor = .consoleText3
        sidebarToggleBtn.target = self
        sidebarToggleBtn.action = #selector(toggleSidebar)

        activityToggleBtn.image = NSImage(systemSymbolName: "chevron.right", accessibilityDescription: nil)
        activityToggleBtn.contentTintColor = .consoleText3
        activityToggleBtn.target = self
        activityToggleBtn.action = #selector(toggleActivity)

        NSLayoutConstraint.activate([
            sidebarToggleBtn.topAnchor.constraint(equalTo: view.topAnchor, constant: 14),
            sidebarToggleBtn.leadingAnchor.constraint(equalTo: sidebarVC.view.trailingAnchor, constant: -14),
            sidebarToggleBtn.widthAnchor.constraint(equalToConstant: 24),
            sidebarToggleBtn.heightAnchor.constraint(equalToConstant: 24),

            activityToggleBtn.topAnchor.constraint(equalTo: view.topAnchor, constant: 14),
            activityToggleBtn.trailingAnchor.constraint(equalTo: activityVC.view.leadingAnchor, constant: 14),
            activityToggleBtn.widthAnchor.constraint(equalToConstant: 24),
            activityToggleBtn.heightAnchor.constraint(equalToConstant: 24)
        ])
    }

    // MARK: Actions

    @objc private func toggleSidebar() {
        let isCollapsed = splitView.isSubviewCollapsed(sidebarVC.view)
        if !isCollapsed { lastSidebarWidth = sidebarVC.view.frame.width }

        NSAnimationContext.runAnimationGroup { ctx in
            ctx.duration = 0.22
            ctx.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
            sidebarVC.view.isHidden = !isCollapsed
            let icon = !isCollapsed ? "chevron.right" : "chevron.left"
            sidebarToggleBtn.animator().image = NSImage(systemSymbolName: icon, accessibilityDescription: nil)
            splitView.layoutSubtreeIfNeeded()
        }
    }

    @objc private func toggleActivity() {
        let isCollapsed = splitView.isSubviewCollapsed(activityVC.view)
        if !isCollapsed { lastActivityWidth = activityVC.view.frame.width }

        NSAnimationContext.runAnimationGroup { ctx in
            ctx.duration = 0.22
            ctx.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
            activityVC.view.isHidden = !isCollapsed
            let icon = !isCollapsed ? "chevron.left" : "chevron.right"
            activityToggleBtn.animator().image = NSImage(systemSymbolName: icon, accessibilityDescription: nil)
            splitView.layoutSubtreeIfNeeded()
        }
    }
}

// MARK: - NSSplitViewDelegate

extension AIConsoleRootViewController: NSSplitViewDelegate {

    func splitView(_ splitView: NSSplitView, constrainMinCoordinate proposedMin: CGFloat, ofSubviewAt index: Int) -> CGFloat {
        // 侧边栏最小 160，中间区域左边界最小保证聊天区至少 320
        if index == 0 { return 160 }
        if index == 1 { return 160 + 320 }  // sidebar_min + workspace_min
        return proposedMin
    }

    func splitView(_ splitView: NSSplitView, constrainMaxCoordinate proposedMax: CGFloat, ofSubviewAt index: Int) -> CGFloat {
        let total = splitView.frame.width
        // 侧边栏最大不超过总宽 30%
        if index == 0 { return min(total * 0.30, 320) }
        // 中间+侧边栏最大，保证右侧活动面板至少 200
        if index == 1 { return total - 200 }
        return proposedMax
    }

    func splitView(_ splitView: NSSplitView, shouldHideDividerAt dividerIndex: Int) -> Bool {
        return false
    }

    func splitView(_ splitView: NSSplitView, effectiveRect proposedEffectiveRect: NSRect,
                   forDrawnRect drawnRect: NSRect, ofDividerAt dividerIndex: Int) -> NSRect {
        // 加宽分割线点击区域，提升拖动手感
        return proposedEffectiveRect.insetBy(dx: -3, dy: 0)
    }
}

// MARK: - ConsoleNavDelegate

extension AIConsoleRootViewController: ConsoleNavDelegate {
    func didSelectNavItem(at index: Int) {
        sidebarVC.update(for: index)
        workVC.switchTo(index: index)
    }
}
