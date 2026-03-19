import AppKit

// MARK: - Sidebar View Controller

final class ConsoleSidebarViewController: NSViewController {
    private let titleLabel = NSTextField(labelWithString: "项目经理")

    override func loadView() {
        view = NSView()
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor(hex: "#2D2D2D").cgColor // 深灰色背景
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        setupBorder()
        setupHeader()
    }

    private func setupBorder() {
        let border = NSView()
        border.wantsLayer = true
        border.layer?.backgroundColor = NSColor.consoleZ800.cgColor
        border.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(border)
        let borderTrailing = border.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        borderTrailing.priority = NSLayoutConstraint.Priority(999)
        NSLayoutConstraint.activate([
            border.topAnchor.constraint(equalTo: view.topAnchor),
            borderTrailing,
            border.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            border.widthAnchor.constraint(equalToConstant: 1)
        ])
    }

    private func setupHeader() {
        titleLabel.font      = .systemFont(ofSize: 13, weight: .semibold)
        titleLabel.textColor = .consoleText
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(titleLabel)

        NSLayoutConstraint.activate([
            titleLabel.topAnchor.constraint(equalTo: view.topAnchor, constant: 16),
            titleLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 12)
        ])
    }

    func update(for index: Int) {
        // 保留接口，但不做任何操作
    }
}
