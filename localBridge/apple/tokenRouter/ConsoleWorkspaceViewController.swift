import AppKit

// MARK: - Workspace Router

final class ConsoleWorkspaceViewController: NSViewController {
    private var currentVC: NSViewController?

    override func loadView() {
        // ⚠️ 不设置 translatesAutoresizingMaskIntoConstraints = false
        view = NSView()
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor.consoleZ950.cgColor
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        switchTo(index: 0)
    }

    func switchTo(index: Int) {
        currentVC?.view.removeFromSuperview()
        currentVC?.removeFromParent()

        let newVC: NSViewController
        switch index {
        case 0:  newVC = PMWorkspaceViewController()
        case 1:  newVC = DevWorkspaceViewController()
        case 2:  newVC = QAWorkspaceViewController()
        case 3:  newVC = MessageFlowViewController()
        case 4:  newVC = AIConfigViewController()
        case 5:  newVC = SettingsPlaceholderViewController()
        default: newVC = NSViewController()
        }

        addChild(newVC)
        // 作为 subview 添加时才设置 translatesAutoresizingMaskIntoConstraints = false
        newVC.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(newVC.view)

        let trailing = newVC.view.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        trailing.priority = NSLayoutConstraint.Priority(999)

        NSLayoutConstraint.activate([
            newVC.view.topAnchor.constraint(equalTo: view.topAnchor),
            newVC.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            trailing,
            newVC.view.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        currentVC = newVC
    }
}

// MARK: - Activity Panel

final class ConsoleActivityViewController: NSViewController {
    override func loadView() {
        // ⚠️ 不设置 translatesAutoresizingMaskIntoConstraints = false
        view = NSView()
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor.consoleZ900.cgColor
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        let border = NSView()
        border.wantsLayer = true
        border.layer?.backgroundColor = NSColor.consoleZ800.cgColor
        border.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(border)

        let title = NSTextField(labelWithString: "实时活动")
        title.font      = .systemFont(ofSize: 14, weight: .semibold)
        title.textColor = .consoleText
        title.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(title)

        let sub = NSTextField(labelWithString: "系统消息流")
        sub.font      = .systemFont(ofSize: 12)
        sub.textColor = .consoleText2
        sub.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(sub)

        NSLayoutConstraint.activate([
            border.topAnchor.constraint(equalTo: view.topAnchor),
            border.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            border.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            border.widthAnchor.constraint(equalToConstant: 1),

            title.topAnchor.constraint(equalTo: view.topAnchor, constant: 16),
            title.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            sub.topAnchor.constraint(equalTo: title.bottomAnchor, constant: 4),
            sub.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16)
        ])
    }
}

// MARK: - Settings Placeholder

final class SettingsPlaceholderViewController: NSViewController {
    override func loadView() {
        view = NSView()
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor.consoleZ950.cgColor
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        let label = NSTextField(labelWithString: "设置页面")
        label.textColor = .consoleText2
        label.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(label)
        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            label.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        ])
    }
}

// MARK: - Terminal Panel

final class ConsoleTerminalViewController: NSViewController {
    override func loadView() {
        view = NSView()
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor.consoleZ900.cgColor
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        
        let border = NSView()
        border.wantsLayer = true
        border.layer?.backgroundColor = NSColor.consoleZ800.cgColor
        border.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(border)

        let terminalLabel = NSTextField(labelWithString: "➜  aihub git:(main) ✗")
        terminalLabel.font = NSFont.monospacedSystemFont(ofSize: 12, weight: .regular)
        terminalLabel.textColor = .consoleText
        terminalLabel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(terminalLabel)

        NSLayoutConstraint.activate([
            border.topAnchor.constraint(equalTo: view.topAnchor),
            border.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            border.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            border.heightAnchor.constraint(equalToConstant: 1),

            terminalLabel.topAnchor.constraint(equalTo: view.topAnchor, constant: 12),
            terminalLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16)
        ])
    }
}
