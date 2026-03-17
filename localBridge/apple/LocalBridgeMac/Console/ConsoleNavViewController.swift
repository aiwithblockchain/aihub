import AppKit

// MARK: - Nav Delegate Protocol

protocol ConsoleNavDelegate: AnyObject {
    func didSelectNavItem(at index: Int)
}

// MARK: - Nav View Controller

final class ConsoleNavViewController: NSViewController {
    weak var delegate: ConsoleNavDelegate?

    private var selectedIndex = 0
    private var navButtons: [NSButton] = []
    private let selectionIndicator = NSView()
    private var selectionCenterYConstraint: NSLayoutConstraint?

    struct NavItem { let icon: String; let label: String }

    private let items = [
        NavItem(icon: "briefcase",                               label: "项目经理"),
        NavItem(icon: "chevron.left.forwardslash.chevron.right", label: "开发团队"),
        NavItem(icon: "checkmark.circle",                        label: "验收团队"),
        NavItem(icon: "message",                                 label: "消息流"),
        NavItem(icon: "network",                                 label: "AI 配置"),
        NavItem(icon: "gearshape",                               label: "设置")
    ]

    // MARK: - View Lifecycle

    override func loadView() {
        // ⚠️ 不设置 translatesAutoresizingMaskIntoConstraints = false
        view = NSView()
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor.consoleZ900.cgColor
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        setupBorder()
        setupButtons()
        setupBottomControls()
    }

    // MARK: - Border

    private func setupBorder() {
        let border = NSView()
        border.wantsLayer = true
        border.layer?.backgroundColor = NSColor.consoleZ800.cgColor
        border.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(border)
        let borderTrailing = border.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        borderTrailing.priority = NSLayoutConstraint.Priority(999)

        let borderBottom = border.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        borderBottom.priority = NSLayoutConstraint.Priority(999)

        NSLayoutConstraint.activate([
            border.topAnchor.constraint(equalTo: view.topAnchor),
            borderTrailing,
            borderBottom,
            border.widthAnchor.constraint(equalToConstant: 1)
        ])
    }

    // MARK: - Nav Buttons

    private func setupButtons() {
        let stack = NSStackView()
        stack.orientation = .vertical
        stack.spacing     = 0
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)

        selectionIndicator.wantsLayer = true
        selectionIndicator.layer?.backgroundColor = NSColor.consoleBlue.cgColor
        selectionIndicator.layer?.cornerRadius    = 2
        selectionIndicator.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(selectionIndicator)

        for (i, item) in items.enumerated() {
            let btn = NSButton()
            btn.image = NSImage(systemSymbolName: item.icon, accessibilityDescription: item.label)
            btn.isBordered = false
            btn.title  = ""
            btn.tag    = i
            btn.target = self
            btn.action = #selector(navTapped(_:))
            btn.toolTip = "\(item.label) (⌘\(i + 1))"
            btn.translatesAutoresizingMaskIntoConstraints = false
            btn.heightAnchor.constraint(equalToConstant: 40).isActive = true
            btn.widthAnchor.constraint(equalToConstant: 64).isActive  = true
            
            // 重要：确保按钮在 Hover 时有响应，有助于触发系统 Tooltip
            btn.showsBorderOnlyWhileMouseInside = true 
            
            stack.addArrangedSubview(btn)
            navButtons.append(btn)
        }

        let stackTrailing = stack.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        stackTrailing.priority = NSLayoutConstraint.Priority(999)

        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: view.topAnchor, constant: 64),
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            stackTrailing,
            selectionIndicator.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            selectionIndicator.widthAnchor.constraint(equalToConstant: 3),
            selectionIndicator.heightAnchor.constraint(equalToConstant: 24)
        ])

        updateSelection()
    }

    @objc private func navTapped(_ sender: NSButton) {
        selectTab(at: sender.tag)
    }

    func selectTab(at index: Int) {
        guard index >= 0 && index < items.count else { return }
        selectedIndex = index
        updateSelection()
        delegate?.didSelectNavItem(at: selectedIndex)
    }

    private func updateSelection() {
        for (i, btn) in navButtons.enumerated() {
            let sel = i == selectedIndex
            btn.contentTintColor = sel ? .consoleBlue : .consoleText3
            btn.wantsLayer = true
            btn.layer?.backgroundColor = sel ? NSColor.consoleZ800.cgColor : NSColor.clear.cgColor
            if sel {
                selectionCenterYConstraint?.isActive = false
                selectionCenterYConstraint = selectionIndicator.centerYAnchor.constraint(equalTo: btn.centerYAnchor)
                selectionCenterYConstraint?.isActive = true
            }
        }
    }

    // MARK: - Bottom Controls

    private let statusDot = ConsoleStatusDot(status: .working)

    private func setupBottomControls() {
        let playBtn = NSButton()
        playBtn.image = NSImage(systemSymbolName: "pause.fill", accessibilityDescription: "控制")
        playBtn.contentTintColor = .consoleText3
        playBtn.isBordered = false
        playBtn.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(playBtn)

        statusDot.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(statusDot)

        NSLayoutConstraint.activate([
            playBtn.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -48),
            playBtn.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            playBtn.widthAnchor.constraint(equalToConstant: 48),
            playBtn.heightAnchor.constraint(equalToConstant: 40),
            statusDot.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -20),
            statusDot.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            statusDot.widthAnchor.constraint(equalToConstant: 8),
            statusDot.heightAnchor.constraint(equalToConstant: 8)
        ])
    }
}
