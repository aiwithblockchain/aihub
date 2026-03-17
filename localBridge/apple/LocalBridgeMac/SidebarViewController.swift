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

    override func loadView() {
        view = NSView()
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        configureView()
        configureTableView()
        configureSettingsButton()
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
        68
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
        return cellView
    }

    func tableViewSelectionDidChange(_ notification: Notification) {
        let selectedRow = tableView.selectedRow
        guard conversations.indices.contains(selectedRow) else {
            return
        }

        delegate?.sidebarViewController(self, didSelect: conversations[selectedRow])
    }
}

private extension SidebarViewController {
    func configureView() {
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor.windowBackgroundColor.cgColor
    }

    func configureTableView() {
        let column = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("ConversationColumn"))
        column.resizingMask = .autoresizingMask

        tableView.addTableColumn(column)
        tableView.headerView = nil
        tableView.rowSizeStyle = .default
        if #available(macOS 11.0, *) {
            tableView.style = .sourceList
        } else {
            tableView.selectionHighlightStyle = .sourceList
        }
        tableView.allowsEmptySelection = true
        tableView.backgroundColor = .clear
        tableView.focusRingType = .none
        tableView.intercellSpacing = NSSize(width: 0, height: 6)
        tableView.delegate = self
        tableView.dataSource = self
    }

    func configureLayout() {
        let scrollView = NSScrollView()
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.hasVerticalScroller = true
        scrollView.drawsBackground = false
        scrollView.documentView = tableView

        view.addSubview(scrollView)
        view.addSubview(settingsButton)

        NSLayoutConstraint.activate([
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.topAnchor.constraint(equalTo: view.topAnchor),
            scrollView.bottomAnchor.constraint(equalTo: settingsButton.topAnchor, constant: -10),
            
            settingsButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 14),
            settingsButton.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -14),
            settingsButton.widthAnchor.constraint(equalToConstant: 24),
            settingsButton.heightAnchor.constraint(equalToConstant: 24)
        ])
    }
    
    func configureSettingsButton() {
        if #available(macOS 11.0, *) {
            settingsButton.image = NSImage(systemSymbolName: "gearshape", accessibilityDescription: "Settings")
        } else {
            settingsButton.image = NSImage(systemSymbolName: "action", accessibilityDescription: "Settings")
        }
        settingsButton.isBordered = false
        settingsButton.bezelStyle = .regularSquare
        settingsButton.target = self
        settingsButton.action = #selector(showSettingsMenu)
        settingsButton.translatesAutoresizingMaskIntoConstraints = false
    }
    
    @objc func showSettingsMenu(_ sender: NSButton) {
        tableView.deselectAll(nil)
        delegate?.sidebarViewControllerDidSelectSettings(self)
    }
}

private final class ConversationCellView: NSTableCellView {
    private let titleLabel = NSTextField(labelWithString: "")
    private let timeLabel = NSTextField(labelWithString: "")
    private let previewLabel = NSTextField(labelWithString: "")

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        configureSubviews()
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    func configure(with conversation: Conversation) {
        titleLabel.stringValue = conversation.title
        timeLabel.stringValue = conversation.timestamp
        previewLabel.stringValue = conversation.preview
    }
}

private extension ConversationCellView {
    func configureSubviews() {
        wantsLayer = true
        layer?.cornerRadius = 10

        titleLabel.font = .systemFont(ofSize: 14, weight: .semibold)
        titleLabel.lineBreakMode = .byTruncatingTail

        timeLabel.font = .systemFont(ofSize: 11)
        timeLabel.textColor = .secondaryLabelColor
        timeLabel.alignment = .right

        previewLabel.font = .systemFont(ofSize: 12)
        previewLabel.textColor = .secondaryLabelColor
        previewLabel.lineBreakMode = .byTruncatingTail

        let titleRow = NSStackView(views: [titleLabel, timeLabel])
        titleRow.orientation = .horizontal
        titleRow.alignment = .centerY
        titleRow.distribution = .fill
        titleRow.spacing = 8

        let contentStack = NSStackView(views: [titleRow, previewLabel])
        contentStack.translatesAutoresizingMaskIntoConstraints = false
        contentStack.orientation = .vertical
        contentStack.spacing = 6

        addSubview(contentStack)

        NSLayoutConstraint.activate([
            contentStack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 14),
            contentStack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -14),
            contentStack.centerYAnchor.constraint(equalTo: centerYAnchor),
        ])
    }
}
