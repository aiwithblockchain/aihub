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
        tableView.reloadData()
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
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 10),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -10),
            scrollView.topAnchor.constraint(equalTo: view.topAnchor),
            scrollView.bottomAnchor.constraint(equalTo: settingsButton.topAnchor, constant: -10),
            
            settingsButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 14),
            settingsButton.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -14),
            settingsButton.heightAnchor.constraint(equalToConstant: 32)
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
        settingsButton.font = NSFont.systemFont(ofSize: 12)
        settingsButton.contentTintColor = DS.colorTextSecond
        
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
    private let iconView = NSImageView()
    private let statusDot = NSView()
    private let statusLabel = NSTextField(labelWithString: "")
    private let titleLabel = NSTextField(labelWithString: "")
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
            statusDot.layer?.backgroundColor = DS.dotConnected.cgColor
        } else if status == "Waiting..." {
            statusDot.layer?.backgroundColor = DS.dotConnecting.cgColor
        } else {
            statusDot.layer?.backgroundColor = DS.dotOffline.cgColor
        }
    }
    
    func applySelectionStyle(isSelected: Bool) {
        wantsLayer = true
        layer?.cornerRadius = DS.radiusM
        if isSelected {
            layer?.backgroundColor = DS.colorPrimary.withAlphaComponent(0.15).cgColor
            titleLabel.textColor    = DS.colorPrimary
            iconView.contentTintColor = DS.colorPrimary
        } else {
            layer?.backgroundColor = NSColor.clear.cgColor
            titleLabel.textColor    = DS.colorTextPrimary
            iconView.contentTintColor = DS.colorTextSecond
        }
    }
}

private extension ConversationCellView {
    func configureSubviews() {
        wantsLayer = true
        
        iconView.translatesAutoresizingMaskIntoConstraints = false
        if #available(macOS 11.0, *) {
            iconView.symbolConfiguration = NSImage.SymbolConfiguration(pointSize: 18, weight: .medium)
        }
        iconView.contentTintColor = DS.colorTextSecond
        
        statusDot.translatesAutoresizingMaskIntoConstraints = false
        statusDot.wantsLayer = true
        statusDot.layer?.cornerRadius = 4
        
        statusLabel.font = DS.fontCaption
        statusLabel.textColor = DS.colorTextTertiary
        
        titleLabel.font = DS.fontBody.withSize(13)
        titleLabel.textColor = DS.colorTextPrimary
        titleLabel.lineBreakMode = .byTruncatingTail
        titleLabel.translatesAutoresizingMaskIntoConstraints = false

        previewLabel.font = DS.fontCaption
        previewLabel.textColor = DS.colorTextSecond
        previewLabel.lineBreakMode = .byTruncatingTail
        previewLabel.translatesAutoresizingMaskIntoConstraints = false

        let topRow = NSStackView(views: [titleLabel, NSView(), statusDot, statusLabel])
        topRow.orientation = .horizontal
        topRow.alignment = .centerY
        topRow.spacing = 4
        
        let textStack = NSStackView(views: [topRow, previewLabel])
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
