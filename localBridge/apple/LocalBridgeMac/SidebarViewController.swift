import AppKit

protocol SidebarViewControllerDelegate: AnyObject {
    func sidebarViewController(
        _ controller: SidebarViewController,
        didSelect conversation: Conversation
    )
    func sidebarViewControllerDidSelectSettings(_ controller: SidebarViewController)
}

final class SidebarViewController: NSViewController {
    weak var delegate: SidebarViewControllerDelegate?

    var defaultConversation: Conversation? {
        conversations.first
    }

    private let conversations: [Conversation] = [
        Conversation(
            title: "TweetClaw",
            subtitle: "WebSocket Extension",
            preview: "Connected to Chrome Extension. Ready for commands.",
            timestamp: "Now"
        ),
        Conversation(
            title: "AIClaw",
            subtitle: "AI Platform Hub",
            preview: "Monitor ChatGPT, Gemini, Grok tabs and status.",
            timestamp: "Now"
        ),
        Conversation(
            title: "Bridge Logs",
            subtitle: "System",
            preview: "Waiting for local service connection...",
            timestamp: "周四"
        ),
        Conversation(
            title: "已连接实例",
            subtitle: "Multi-Profile",
            preview: "查看所有在线的浏览器扩展实例",
            timestamp: "Now"
        )
    ]

    private let tableView = NSTableView(frame: .zero)
    private let settingsButton = NSButton()
    private let quitButton = NSButton()

    override func loadView() {
        view = NSView()
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        configureView()
        configureTableView()
        configureSettingsButton()
        configureQuitButton()
        configureLayout()
    }

    override func viewDidAppear() {
        super.viewDidAppear()

        guard tableView.selectedRow == -1, !conversations.isEmpty else {
            return
        }

        tableView.selectRowIndexes(IndexSet(integer: 0), byExtendingSelection: false)
        delegate?.sidebarViewController(self, didSelect: conversations[0])
    }
}

extension SidebarViewController: NSTableViewDataSource, NSTableViewDelegate {
    func numberOfRows(in tableView: NSTableView) -> Int {
        conversations.count
    }

    func tableView(_ tableView: NSTableView, heightOfRow row: Int) -> CGFloat {
        56
    }

    func tableView(_ tableView: NSTableView, viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
        let identifier = NSUserInterfaceItemIdentifier("ConversationCellView")
        let cellView: ConversationCellView

        if let reusedView = tableView.makeView(withIdentifier: identifier, owner: self) as? ConversationCellView {
            cellView = reusedView
        } else {
            cellView = ConversationCellView()
            cellView.identifier = identifier
        }

        cellView.configure(with: conversations[row])

        // 确保每次都应用正确的选中状态
        let isSelected = tableView.selectedRow == row
        cellView.applySelectionStyle(isSelected: isSelected)

        return cellView
    }

    func tableViewSelectionDidChange(_ notification: Notification) {
        let selectedRow = tableView.selectedRow
        guard conversations.indices.contains(selectedRow) else {
            return
        }

        delegate?.sidebarViewController(self, didSelect: conversations[selectedRow])

        // 只刷新可见的行，而不是整个表格
        let visibleRows = tableView.rows(in: tableView.visibleRect)
        for row in visibleRows.location..<(visibleRows.location + visibleRows.length) {
            if let cellView = tableView.view(atColumn: 0, row: row, makeIfNecessary: false) as? ConversationCellView {
                cellView.applySelectionStyle(isSelected: row == selectedRow)
            }
        }
    }
}

private extension SidebarViewController {
    func configureView() {
        view.wantsLayer = true
        view.layer?.backgroundColor = DSV2.surfaceContainerLow.cgColor
    }

    func configureTableView() {
        let column = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("ConversationColumn"))
        column.resizingMask = .autoresizingMask

        tableView.addTableColumn(column)
        tableView.headerView = nil
        tableView.rowSizeStyle = .default

        // 禁用系统的选中高亮样式，使用我们自定义的
        tableView.selectionHighlightStyle = .none

        tableView.allowsEmptySelection = true
        tableView.backgroundColor = .clear
        tableView.focusRingType = .none
        tableView.intercellSpacing = NSSize(width: 0, height: 6)
        tableView.delegate = self
        tableView.dataSource = self

        // 确保 tableView 使用 NSView-based cells
        tableView.style = .plain
    }

    func configureLayout() {
        let scrollView = NSScrollView()
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.hasVerticalScroller = true
        scrollView.drawsBackground = false
        scrollView.documentView = tableView

        view.addSubview(scrollView)
        view.addSubview(settingsButton)
        view.addSubview(quitButton)

        NSLayoutConstraint.activate([
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 10),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -10),
            scrollView.topAnchor.constraint(equalTo: view.topAnchor),
            scrollView.bottomAnchor.constraint(equalTo: settingsButton.topAnchor, constant: -10),

            settingsButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 14),
            settingsButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -14),
            settingsButton.bottomAnchor.constraint(equalTo: quitButton.topAnchor, constant: -8),
            settingsButton.heightAnchor.constraint(equalToConstant: 32),

            quitButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 14),
            quitButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -14),
            quitButton.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -14),
            quitButton.heightAnchor.constraint(equalToConstant: 32)
        ])
    }

    func configureSettingsButton() {
        if #available(macOS 11.0, *) {
            settingsButton.image = NSImage(systemSymbolName: "gearshape", accessibilityDescription: "Settings")
        }

        settingsButton.title = "Settings"
        settingsButton.bezelStyle = .regularSquare
        settingsButton.isBordered = false
        settingsButton.imagePosition = .imageLeading
        settingsButton.alignment = .left
        settingsButton.font = DSV2.fontBodySm
        settingsButton.contentTintColor = DSV2.onSurfaceVariant

        settingsButton.target = self
        settingsButton.action = #selector(showSettingsMenu)
        settingsButton.translatesAutoresizingMaskIntoConstraints = false
    }

    func configureQuitButton() {
        if #available(macOS 11.0, *) {
            quitButton.image = NSImage(systemSymbolName: "power", accessibilityDescription: "Quit")
        }

        quitButton.title = "退出"
        quitButton.bezelStyle = .regularSquare
        quitButton.isBordered = false
        quitButton.imagePosition = .imageLeading
        quitButton.alignment = .left
        quitButton.font = DSV2.fontBodySm
        quitButton.contentTintColor = DSV2.error

        quitButton.target = self
        quitButton.action = #selector(quitApplication)
        quitButton.translatesAutoresizingMaskIntoConstraints = false
    }

    @objc func showSettingsMenu(_ sender: NSButton) {
        tableView.deselectAll(nil)
        delegate?.sidebarViewControllerDidSelectSettings(self)
    }

    @objc func quitApplication(_ sender: NSButton) {
        NSApplication.shared.terminate(nil)
    }
}

private final class ConversationCellView: NSTableCellView {
    private let iconView = NSImageView()
    private let statusDot = NSView()
    private let statusLabel = NSTextField(labelWithString: "")
    private let titleLabel = NSTextField(labelWithString: "")
    private let subtitleLabel = NSTextField(labelWithString: "")
    private let previewLabel = NSTextField(labelWithString: "")

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        configureSubviews()
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    // 确保背景完全透明
    override var backgroundStyle: NSView.BackgroundStyle {
        get { return .normal }
        set { /* 忽略系统设置 */ }
    }

    override func prepareForReuse() {
        super.prepareForReuse()
        // 确保重用时背景保持透明
        wantsLayer = true
        layer?.backgroundColor = NSColor.clear.cgColor
    }

    func configure(with conversation: Conversation) {
        titleLabel.stringValue = conversation.title
        subtitleLabel.stringValue = conversation.subtitle
        previewLabel.stringValue = conversation.preview

        // Icon selection
        if #available(macOS 11.0, *) {
            let symbolName: String
            switch conversation.title {
            case "TweetClaw": symbolName = "network"
            case "AIClaw": symbolName = "cpu"
            case "Bridge Logs": symbolName = "doc.text.magnifyingglass"
            case "已连接实例": symbolName = "antenna.radiowaves.left.and.right"
            default: symbolName = "gearshape.fill"
            }
            iconView.image = NSImage(systemSymbolName: symbolName, accessibilityDescription: nil)
        }

        // Status Dot logic
        let status = conversation.timestamp
        statusLabel.stringValue = status

        if status == "Connected" || status == "Now" {
            statusDot.layer?.backgroundColor = DSV2.tertiary.cgColor
        } else if status == "Waiting..." {
            statusDot.layer?.backgroundColor = DSV2.secondary.cgColor
        } else {
            statusDot.layer?.backgroundColor = DSV2.onSurfaceTertiary.cgColor
        }
    }
    
    func applySelectionStyle(isSelected: Bool) {
        wantsLayer = true
        layer?.cornerRadius = DSV2.radiusCard

        if isSelected {
            // 使用更明显的选中背景色 (surfaceContainerHighest)
            layer?.backgroundColor = DSV2.surfaceContainerHighest.cgColor
            layer?.borderWidth = 1
            layer?.borderColor = DSV2.primary.withAlphaComponent(0.3).cgColor
            titleLabel.font = NSFont.systemFont(ofSize: 13, weight: .semibold)
            titleLabel.textColor = DSV2.primary
            subtitleLabel.textColor = DSV2.primary.withAlphaComponent(0.8)
            previewLabel.textColor = DSV2.onSurface
            statusLabel.textColor = DSV2.primary
            iconView.contentTintColor = DSV2.primary
        } else {
            layer?.backgroundColor = NSColor.clear.cgColor
            layer?.borderWidth = 0
            layer?.borderColor = NSColor.clear.cgColor
            titleLabel.font = DSV2.fontBodyMd.withSize(13)
            titleLabel.textColor = DSV2.onSurface
            subtitleLabel.textColor = DSV2.onSurfaceVariant
            previewLabel.textColor = DSV2.onSurfaceVariant
            statusLabel.textColor = DSV2.onSurfaceTertiary
            iconView.contentTintColor = DSV2.onSurfaceVariant
        }
    }
}

private extension ConversationCellView {
    func configureSubviews() {
        wantsLayer = true
        // 确保 cell 本身背景透明
        layer?.backgroundColor = NSColor.clear.cgColor

        iconView.translatesAutoresizingMaskIntoConstraints = false
        if #available(macOS 11.0, *) {
            iconView.symbolConfiguration = NSImage.SymbolConfiguration(pointSize: 18, weight: .medium)
        }
        iconView.contentTintColor = DSV2.onSurfaceVariant

        statusDot.translatesAutoresizingMaskIntoConstraints = false
        statusDot.wantsLayer = true
        statusDot.layer?.cornerRadius = 4

        statusLabel.font = DSV2.fontLabelSm
        statusLabel.textColor = DSV2.onSurfaceTertiary

        titleLabel.font = DSV2.fontBodyMd.withSize(13)
        titleLabel.textColor = DSV2.onSurface
        titleLabel.lineBreakMode = .byTruncatingTail
        titleLabel.translatesAutoresizingMaskIntoConstraints = false

        subtitleLabel.font = DSV2.fontBodySm
        subtitleLabel.textColor = DSV2.onSurfaceVariant
        subtitleLabel.lineBreakMode = .byTruncatingTail
        subtitleLabel.translatesAutoresizingMaskIntoConstraints = false

        previewLabel.font = DSV2.fontBodySm
        previewLabel.textColor = DSV2.onSurfaceVariant
        previewLabel.lineBreakMode = .byTruncatingTail
        previewLabel.translatesAutoresizingMaskIntoConstraints = false

        let topRow = NSStackView(views: [titleLabel, NSView(), statusDot, statusLabel])
        topRow.orientation = .horizontal
        topRow.alignment = .centerY
        topRow.spacing = 4

        let textStack = NSStackView(views: [topRow, subtitleLabel])
        textStack.orientation = .vertical
        textStack.alignment = .leading
        textStack.spacing = 2
        textStack.translatesAutoresizingMaskIntoConstraints = false

        addSubview(iconView)
        addSubview(textStack)

        NSLayoutConstraint.activate([
            iconView.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),
            iconView.centerYAnchor.constraint(equalTo: centerYAnchor),
            iconView.widthAnchor.constraint(equalToConstant: 28),
            iconView.heightAnchor.constraint(equalToConstant: 28),

            statusDot.widthAnchor.constraint(equalToConstant: 8),
            statusDot.heightAnchor.constraint(equalToConstant: 8),

            textStack.leadingAnchor.constraint(equalTo: iconView.trailingAnchor, constant: 10),
            textStack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
            textStack.centerYAnchor.constraint(equalTo: centerYAnchor),

            topRow.widthAnchor.constraint(equalTo: textStack.widthAnchor)
        ])
    }
}
