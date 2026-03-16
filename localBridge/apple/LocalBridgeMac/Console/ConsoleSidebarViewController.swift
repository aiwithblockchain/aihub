import AppKit

// MARK: - Sidebar View Controller

final class ConsoleSidebarViewController: NSViewController {
    private let titleLabel    = NSTextField(labelWithString: "项目经理")
    private let subtitleLabel = NSTextField(labelWithString: "1 个 AI")
    private let stackView     = NSStackView()
    private let scrollView    = NSScrollView()

    // MARK: - View Lifecycle

    override func loadView() {
        // ⚠️ 不设置 translatesAutoresizingMaskIntoConstraints = false
        view = NSView()
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor.consoleZ900.withAlphaComponent(0.6).cgColor
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        setupBorder()
        setupHeader()
        setupList()
        update(for: 0)
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
        NSLayoutConstraint.activate([
            border.topAnchor.constraint(equalTo: view.topAnchor),
            borderTrailing,
            border.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            border.widthAnchor.constraint(equalToConstant: 1)
        ])
    }

    // MARK: - Header

    private func setupHeader() {
        titleLabel.font      = .systemFont(ofSize: 13, weight: .semibold)
        titleLabel.textColor = .consoleText
        titleLabel.translatesAutoresizingMaskIntoConstraints = false

        subtitleLabel.font      = .systemFont(ofSize: 11)
        subtitleLabel.textColor = .consoleText2
        subtitleLabel.translatesAutoresizingMaskIntoConstraints = false

        let addBtn = NSButton()
        addBtn.image = NSImage(systemSymbolName: "plus", accessibilityDescription: "增加")
        addBtn.contentTintColor       = .consoleText2
        addBtn.isBordered             = false
        addBtn.wantsLayer             = true
        addBtn.layer?.cornerRadius    = 6
        addBtn.layer?.backgroundColor = NSColor.consoleZ800.cgColor
        addBtn.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(titleLabel)
        view.addSubview(subtitleLabel)
        view.addSubview(addBtn)

        let btnTrailing = addBtn.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -12)
        btnTrailing.priority = NSLayoutConstraint.Priority(999)

        NSLayoutConstraint.activate([
            titleLabel.topAnchor.constraint(equalTo: view.topAnchor, constant: 14),
            titleLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 12),
            titleLabel.trailingAnchor.constraint(lessThanOrEqualTo: addBtn.leadingAnchor, constant: -8),

            subtitleLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 2),
            subtitleLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 12),

            addBtn.centerYAnchor.constraint(equalTo: titleLabel.centerYAnchor),
            btnTrailing,
            addBtn.widthAnchor.constraint(equalToConstant: 24),
            addBtn.heightAnchor.constraint(equalToConstant: 24)
        ])

        let border = NSView()
        border.wantsLayer = true
        border.layer?.backgroundColor = NSColor.consoleZ800.cgColor
        border.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(border)
        let headerBorderTrailing = border.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        headerBorderTrailing.priority = NSLayoutConstraint.Priority(999)
        NSLayoutConstraint.activate([
            border.topAnchor.constraint(equalTo: view.topAnchor, constant: 64),
            border.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            headerBorderTrailing,
            border.heightAnchor.constraint(equalToConstant: 1)
        ])
    }

    // MARK: - List

    private func setupList() {
        scrollView.drawsBackground = false
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scrollView)

        stackView.orientation = .vertical
        stackView.spacing     = 6
        stackView.edgeInsets  = NSEdgeInsets(top: 10, left: 8, bottom: 10, right: 8)
        stackView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.documentView = stackView

        let scrollTrailing = scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        scrollTrailing.priority = NSLayoutConstraint.Priority(999)

        let stackTrailing = stackView.trailingAnchor.constraint(equalTo: scrollView.contentView.trailingAnchor)
        stackTrailing.priority = NSLayoutConstraint.Priority(999)

        let scrollBottom = scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        scrollBottom.priority = NSLayoutConstraint.Priority(999)

        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.topAnchor, constant: 65),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollTrailing,
            scrollBottom,
            stackView.topAnchor.constraint(equalTo: scrollView.contentView.topAnchor),
            stackView.leadingAnchor.constraint(equalTo: scrollView.contentView.leadingAnchor),
            stackTrailing
        ])
    }

    // MARK: - Public Update

    func update(for index: Int) {
        stackView.arrangedSubviews.forEach { $0.removeFromSuperview() }

        let filtered: [AIAgent]
        switch index {
        case 0: titleLabel.stringValue = "项目经理"; filtered = MockData.agents.filter { $0.role == .pm }
        case 1: titleLabel.stringValue = "开发人员"; filtered = MockData.agents.filter { $0.role == .developer }
        case 2: titleLabel.stringValue = "验收人员"; filtered = MockData.agents.filter { $0.role == .qa }
        default: titleLabel.stringValue = "AI 列表"; filtered = MockData.agents
        }

        subtitleLabel.stringValue = "\(filtered.count) 个 AI"

        for agent in filtered {
            let card = ConsoleAICard(agent: agent)
            card.translatesAutoresizingMaskIntoConstraints = false
            card.heightAnchor.constraint(equalToConstant: 68).isActive = true
            stackView.addArrangedSubview(card)
        }
    }
}
