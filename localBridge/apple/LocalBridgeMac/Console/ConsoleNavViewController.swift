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

    struct NavItem {
        let icon: String
        let label: String
    }

    private let items = [
        NavItem(icon: "briefcase",                             label: "项目经理"),
        NavItem(icon: "chevron.left.forwardslash.chevron.right", label: "开发团队"),
        NavItem(icon: "checkmark.circle",                      label: "验收团队"),
        NavItem(icon: "message",                               label: "消息流"),
        NavItem(icon: "network",                               label: "AI 配置"),
        NavItem(icon: "gearshape",                             label: "设置")
    ]

    // MARK: View Lifecycle

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

    // MARK: Logo

    private func setupLogo() {
        let logoContainer = NSView()
        logoContainer.wantsLayer = true
        logoContainer.layer?.cornerRadius = 8
        logoContainer.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(logoContainer)

        let gradient = CAGradientLayer()
        gradient.colors = [NSColor(hex: "#3B82F6").cgColor, NSColor(hex: "#9333EA").cgColor]
        gradient.startPoint = CGPoint(x: 0, y: 0)
        gradient.endPoint   = CGPoint(x: 1, y: 1)
        gradient.frame        = CGRect(x: 0, y: 0, width: 40, height: 40)
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

    // MARK: Nav Buttons

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

    // MARK: Bottom Controls

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
