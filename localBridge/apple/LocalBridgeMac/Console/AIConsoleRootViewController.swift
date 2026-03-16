import AppKit

// MARK: - Root View Controller

final class AIConsoleRootViewController: NSViewController {
    private let navVC      = ConsoleNavViewController()
    private let splitView  = NSSplitView()
    private let sidebarVC  = ConsoleSidebarViewController()
    private let workVC     = ConsoleWorkspaceViewController()
    private let activityVC = ConsoleActivityViewController()

    private var didSetInitialDividers = false

    // MARK: - View Lifecycle

    override func loadView() {
        // ⚠️ 根 view 绝不设置 translatesAutoresizingMaskIntoConstraints = false
        view = NSView()
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor.consoleZ950.cgColor
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        setupNav()
        setupSplitView()
        navVC.delegate = self
    }

    override func viewDidLayout() {
        super.viewDidLayout()
        guard !didSetInitialDividers, splitView.frame.width > 0 else { return }
        didSetInitialDividers = true
        applyInitialDividers()
    }

    // MARK: - 初始分割线（在真实宽度已知后设置）

    private func applyInitialDividers() {
        let total     = splitView.frame.width
        let sidebarW: CGFloat = 220
        let activityW: CGFloat = 260
        let workW = max(total - sidebarW - activityW, 300)
        splitView.setPosition(sidebarW, ofDividerAt: 0)
        splitView.setPosition(sidebarW + workW, ofDividerAt: 1)
    }

    // MARK: - Setup

    private func setupNav() {
        addChild(navVC)
        // 子视图添加到 superview 时才设置 translatesAutoresizingMaskIntoConstraints = false
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
        splitView.isVertical   = true
        splitView.dividerStyle = .thin
        splitView.delegate     = self
        splitView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(splitView)

        // NSSplitView 用 frame 管理这些子视图，不要设置 translatesAutoresizingMaskIntoConstraints
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
    }

    // MARK: - Toggle Actions

    @objc private func toggleSidebar() {
        let isCollapsed = splitView.isSubviewCollapsed(sidebarVC.view)
        NSAnimationContext.runAnimationGroup { ctx in
            ctx.duration = 0.22
            ctx.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
            sidebarVC.view.isHidden = !isCollapsed
            splitView.layoutSubtreeIfNeeded()
        }
    }

    @objc private func toggleActivity() {
        let isCollapsed = splitView.isSubviewCollapsed(activityVC.view)
        NSAnimationContext.runAnimationGroup { ctx in
            ctx.duration = 0.22
            ctx.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
            activityVC.view.isHidden = !isCollapsed
            splitView.layoutSubtreeIfNeeded()
        }
    }
}

// MARK: - NSSplitViewDelegate

extension AIConsoleRootViewController: NSSplitViewDelegate {

    func splitView(_ splitView: NSSplitView,
                   constrainMinCoordinate proposedMin: CGFloat,
                   ofSubviewAt index: Int) -> CGFloat {
        if index == 0 { return 160 }
        if index == 1 { return 460 }   // 160 sidebar_min + 300 workspace_min
        return proposedMin
    }

    func splitView(_ splitView: NSSplitView,
                   constrainMaxCoordinate proposedMax: CGFloat,
                   ofSubviewAt index: Int) -> CGFloat {
        let total = splitView.frame.width
        if index == 0 { return min(total * 0.30, 320) }
        if index == 1 { return total - 200 }
        return proposedMax
    }

    func splitView(_ splitView: NSSplitView,
                   shouldHideDividerAt dividerIndex: Int) -> Bool { false }

    func splitView(_ splitView: NSSplitView,
                   effectiveRect proposedEffectiveRect: NSRect,
                   forDrawnRect drawnRect: NSRect,
                   ofDividerAt dividerIndex: Int) -> NSRect {
        proposedEffectiveRect.insetBy(dx: -3, dy: 0)
    }
}

// MARK: - ConsoleNavDelegate

extension AIConsoleRootViewController: ConsoleNavDelegate {
    func didSelectNavItem(at index: Int) {
        sidebarVC.update(for: index)
        workVC.switchTo(index: index)
    }
}
