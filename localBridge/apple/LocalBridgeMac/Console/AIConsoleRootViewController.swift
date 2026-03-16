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

    private var lastSidebarWidth:  CGFloat = 260
    private var lastActivityWidth: CGFloat = 300

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

        splitView.setPosition(260, ofDividerAt: 0)
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

    // MARK: Actions

    @objc private func toggleSidebar() {
        let isCollapsed = splitView.isSubviewCollapsed(sidebarVC.view)
        if !isCollapsed { lastSidebarWidth = sidebarVC.view.frame.width }

        NSAnimationContext.runAnimationGroup { ctx in
            ctx.duration = 0.25
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
            ctx.duration = 0.25
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
        if index == 0 { return 180 }
        return proposedMin
    }

    func splitView(_ splitView: NSSplitView, constrainMaxCoordinate proposedMax: CGFloat, ofSubviewAt index: Int) -> CGFloat {
        let total = splitView.frame.width
        if index == 0 { return total * 0.4 }
        if index == 1 { return total - 200 }
        return proposedMax
    }

    func splitView(_ splitView: NSSplitView, shouldHideDividerAt dividerIndex: Int) -> Bool {
        return false
    }

    func splitView(_ splitView: NSSplitView, effectiveRect proposedEffectiveRect: NSRect,
                   forDrawnRect drawnRect: NSRect, ofDividerAt dividerIndex: Int) -> NSRect {
        return proposedEffectiveRect.insetBy(dx: -2, dy: 0)
    }
}

// MARK: - ConsoleNavDelegate

extension AIConsoleRootViewController: ConsoleNavDelegate {
    func didSelectNavItem(at index: Int) {
        sidebarVC.update(for: index)
        workVC.switchTo(index: index)
    }
}
