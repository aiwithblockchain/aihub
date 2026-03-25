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

    private var conversations: [Conversation] = []

    private func loadConversations() {
        conversations = [
            Conversation(
                type: .tweetclaw,
                title: LanguageManager.shared.localized("sidebar.tweetclaw.title"),
                subtitle: LanguageManager.shared.localized("sidebar.tweetclaw.subtitle"),
                preview: LanguageManager.shared.localized("sidebar.tweetclaw.preview"),
                timestamp: LanguageManager.shared.localized("common.now")
            ),
            Conversation(
                type: .aiclaw,
                title: LanguageManager.shared.localized("sidebar.aiclaw.title"),
                subtitle: LanguageManager.shared.localized("sidebar.aiclaw.subtitle"),
                preview: LanguageManager.shared.localized("sidebar.aiclaw.preview"),
                timestamp: LanguageManager.shared.localized("common.now")
            ),
            Conversation(
                type: .logs,
                title: LanguageManager.shared.localized("sidebar.logs.title"),
                subtitle: LanguageManager.shared.localized("sidebar.logs.subtitle"),
                preview: LanguageManager.shared.localized("sidebar.logs.preview"),
                timestamp: LanguageManager.shared.localized("common.now")
            ),
            Conversation(
                type: .instances,
                title: LanguageManager.shared.localized("sidebar.instances.title"),
                subtitle: LanguageManager.shared.localized("sidebar.instances.subtitle"),
                preview: LanguageManager.shared.localized("sidebar.instances.preview"),
                timestamp: LanguageManager.shared.localized("common.now")
            )
        ]
    }

    private let tableView = NSTableView(frame: .zero)
    private let settingsButton = NSButton()
    private let quitButton = NSButton()

    override func loadView() {
        view = NSView()
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        loadConversations()
        configureView()
        configureTableView()
        configureSettingsButton()
        configureQuitButton()
        configureLayout()

        // 注册主题变化通知
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleThemeChange),
            name: ThemeManager.themeDidChangeNotification,
            object: nil
        )

        // 注册语言变更通知
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleLanguageChange),
            name: LanguageManager.languageDidChangeNotification,
            object: nil
        )
    }

    @objc private func handleThemeChange() {
        // 更新侧边栏背景色
        view.layer?.backgroundColor = DSV2.surfaceContainerLow.cgColor

        // 更新按钮颜色
        settingsButton.contentTintColor = DSV2.onSurfaceVariant
        quitButton.contentTintColor = DSV2.onSurfaceVariant

        // 更新所有可见的 cell
        let visibleRows = tableView.rows(in: tableView.visibleRect)
        for row in visibleRows.location..<(visibleRows.location + visibleRows.length) {
            if let cellView = tableView.view(atColumn: 0, row: row, makeIfNecessary: false) as? ConversationCellView {
                // 重新配置 cell 以更新所有颜色（包括 statusDot）
                cellView.configure(with: conversations[row])
                // 重新应用选中状态
                cellView.applySelectionStyle(isSelected: row == tableView.selectedRow)
            }
        }

        view.needsDisplay = true
    }

    @objc private func handleLanguageChange() {
        // 重新加载对话列表
        loadConversations()
        
        // 更新底部按钮
        settingsButton.title = LanguageManager.shared.localized("settings.title")
        quitButton.title = LanguageManager.shared.localized("app.quit")
        
        tableView.reloadData()
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    override func viewDidAppear() {
        super.viewDidAppear()
        // 初始选中逻辑现在由 ConversationsSplitViewController 统一调度
    }

    func selectDefaultRow() {
        if !conversations.isEmpty {
            tableView.selectRowIndexes(IndexSet(integer: 0), byExtendingSelection: false)
            refreshSelectionForAllVisibleRows()
        }
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
        refreshSelectionForAllVisibleRows()
        
        let selectedRow = tableView.selectedRow
        guard conversations.indices.contains(selectedRow) else {
            return
        }

        delegate?.sidebarViewController(self, didSelect: conversations[selectedRow])
    }
}

private extension SidebarViewController {
    func refreshSelectionForAllVisibleRows() {
        let visibleRows = tableView.rows(in: tableView.visibleRect)
        let selectedRow = tableView.selectedRow
        for row in visibleRows.location..<(visibleRows.location + visibleRows.length) {
            if let cellView = tableView.view(atColumn: 0, row: row, makeIfNecessary: false) as? ConversationCellView {
                cellView.applySelectionStyle(isSelected: row == selectedRow)
            }
        }
    }

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
        scrollView.contentInsets = NSEdgeInsets(top: 12, left: 0, bottom: 0, right: 0)
        scrollView.documentView = tableView

        view.addSubview(scrollView)
        view.addSubview(settingsButton)
        view.addSubview(quitButton)

        NSLayoutConstraint.activate([
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 10),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -10),
            scrollView.topAnchor.constraint(equalTo: view.topAnchor, constant: 8),
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

        settingsButton.title = LanguageManager.shared.localized("settings.title")
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

        quitButton.title = LanguageManager.shared.localized("app.quit")
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
        refreshSelectionForAllVisibleRows()
        delegate?.sidebarViewControllerDidSelectSettings(self)
    }

    @objc func quitApplication(_ sender: NSButton) {
        NSApplication.shared.terminate(nil)
    }
}
private final class ConversationCellView: NSTableCellView {
    private let iconView = PassthroughImageView()
    private let statusDot = PassthroughView()
    private let statusLabel = PassthroughTextField(labelWithString: "")
    private let titleLabel = PassthroughTextField(labelWithString: "")
    private let subtitleLabel = PassthroughTextField(labelWithString: "")
    private let previewLabel = PassthroughTextField(labelWithString: "")

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

        // Icon selection based on type
        if #available(macOS 11.0, *) {
            let symbolName: String
            switch conversation.type {
            case .tweetclaw: symbolName = "network"
            case .aiclaw: symbolName = "cpu"
            case .logs: symbolName = "doc.text.magnifyingglass"
            case .instances: symbolName = "antenna.radiowaves.left.and.right"
            }
            iconView.image = NSImage(systemSymbolName: symbolName, accessibilityDescription: nil)
        }

        // Status Dot logic
        statusLabel.stringValue = conversation.timestamp

        // Status determination based on type and timestamp content
        // We know what the 'positive' status values are for English & Chinese
        let status = conversation.timestamp
        let isNow = status == LanguageManager.shared.localized("common.now")
        let isConnected = status == LanguageManager.shared.localized("tweetclaw.connected") || status == "Connected"
        
        if isNow || isConnected {
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
            // 采用更具冲击力的选中样式：背景加亮 + 明显的蓝色边框
            layer?.backgroundColor = DSV2.primary.withAlphaComponent(0.15).cgColor
            layer?.borderWidth = 1.5
            layer?.borderColor = DSV2.primary.cgColor
            titleLabel.font = NSFont.systemFont(ofSize: 13, weight: .bold)
            titleLabel.textColor = DSV2.primary
            subtitleLabel.textColor = DSV2.primary.withAlphaComponent(0.9)
            previewLabel.textColor = DSV2.onSurface
            statusLabel.textColor = DSV2.primary
            iconView.contentTintColor = DSV2.primary
        } else {
            layer?.backgroundColor = NSColor.clear.cgColor
            layer?.borderWidth = 0
            layer?.borderColor = NSColor.clear.cgColor
            titleLabel.font = NSFont.systemFont(ofSize: 13, weight: .regular)
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
