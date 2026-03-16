import AppKit

// MARK: - Sidebar View Controller

final class ConsoleSidebarViewController: NSViewController {
    private let titleLabel    = NSTextField(labelWithString: "项目经理")
    private let subtitleLabel = NSTextField(labelWithString: "1 个 AI")
    private let stackView     = NSStackView()
    private let scrollView    = NSScrollView()

    // MARK: View Lifecycle

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

    // MARK: Header

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

    // MARK: List

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

    // MARK: Public Update

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
