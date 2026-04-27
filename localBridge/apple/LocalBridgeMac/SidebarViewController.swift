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

    private let hoverTooltipContainer = NSView()
    private let hoverTooltipLabel = NSTextField(labelWithString: "")

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
                type: .instances,
                title: LanguageManager.shared.localized("sidebar.instances.title"),
                subtitle: LanguageManager.shared.localized("sidebar.instances.subtitle"),
                preview: LanguageManager.shared.localized("sidebar.instances.preview"),
                timestamp: LanguageManager.shared.localized("common.now")
            )
        ]
    }

    private let tableView = NSTableView(frame: .zero)
    private let rightDivider = NSView()
    private let settingsButton = SidebarBottomButton()
    private let helpButton = SidebarBottomButton()
    private let quitButton = SidebarBottomButton()

    override func loadView() {
        view = NSView()
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        loadConversations()
        configureView()
        configureTableView()
        configureSettingsButton()
        configureHelpButton()
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
        view.layer?.backgroundColor = DSV2.surface.cgColor
        rightDivider.layer?.backgroundColor = DSV2.divider.cgColor
        hoverTooltipLabel.textColor = DSV2.onSurface
        hoverTooltipContainer.layer?.backgroundColor = DSV2.surfaceBright.cgColor
        hoverTooltipContainer.layer?.borderColor = DSV2.cardBorder.cgColor
        
        settingsButton.updateAppearance()
        helpButton.updateAppearance()
        quitButton.updateAppearance()

        // Update all visible cells to refresh background colors and configuration
        let visibleRows = tableView.rows(in: tableView.visibleRect)
        for row in visibleRows.location..<(visibleRows.location + visibleRows.length) {
            if let cellView = tableView.view(atColumn: 0, row: row, makeIfNecessary: false) as? ConversationCellView {
                // 重新配置 cell 以更新所有颜色（包括 statusDot）
                cellView.configure(with: conversations[row])
                // 重新更新外观样式（包括 1:1 背景和选中态）
                cellView.updateAppearance(isSelected: row == tableView.selectedRow, isHovered: cellView.isHovered)
            }
        }

        view.needsDisplay = true
    }

    @objc private func handleLanguageChange() {
        // 重新加载对话列表
        loadConversations()

        // 更新底部按钮 tooltip
        settingsButton.toolTip = LanguageManager.shared.localized("settings.title")
        helpButton.toolTip = LanguageManager.shared.localized("app.help")
        quitButton.toolTip = LanguageManager.shared.localized("app.quit")

        hideHoverTooltip()
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
        58
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

        cellView.onHoverChanged = { [weak self, weak tableView, weak cellView] isHovering in
            guard let self, let tableView, let cellView else { return }
            
            // Update cell style for hover
            cellView.isHovered = isHovering
            let currentRow = tableView.row(for: cellView)
            let isSelected = tableView.selectedRow == currentRow
            cellView.updateAppearance(isSelected: isSelected, isHovered: isHovering)
            
            if isHovering {
                guard currentRow >= 0 && currentRow < self.conversations.count else { return }
                let rowRect = tableView.rect(ofRow: currentRow)
                let rowRectInSidebar = tableView.convert(rowRect, to: self.view)
                self.showHoverTooltip(title: self.conversations[currentRow].title, y: rowRectInSidebar.midY)
            } else {
                self.hideHoverTooltip()
            }
        }

        cellView.configure(with: conversations[row])

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

        settingsButton.isSelectedNode = false

        delegate?.sidebarViewController(self, didSelect: conversations[selectedRow])
    }
}

private extension SidebarViewController {
    func refreshSelectionForAllVisibleRows() {
        let visibleRows = tableView.rows(in: tableView.visibleRect)
        let selectedRow = tableView.selectedRow
        for row in visibleRows.location..<(visibleRows.location + visibleRows.length) {
            if let cellView = tableView.view(atColumn: 0, row: row, makeIfNecessary: false) as? ConversationCellView {
                cellView.updateAppearance(isSelected: row == selectedRow, isHovered: cellView.isHovered)
            }
        }
    }

    func configureView() {
        view.wantsLayer = true
        view.layer?.backgroundColor = DSV2.surface.cgColor
        view.layer?.borderWidth = 0

        rightDivider.wantsLayer = true
        rightDivider.layer?.backgroundColor = DSV2.divider.cgColor
        rightDivider.translatesAutoresizingMaskIntoConstraints = false

        hoverTooltipContainer.wantsLayer = true
        hoverTooltipContainer.layer?.backgroundColor = DSV2.surfaceBright.cgColor
        hoverTooltipContainer.layer?.cornerRadius = 8
        hoverTooltipContainer.layer?.borderWidth = 1
        hoverTooltipContainer.layer?.borderColor = DSV2.cardBorder.cgColor
        hoverTooltipContainer.layer?.shadowColor = NSColor.black.withAlphaComponent(0.12).cgColor
        hoverTooltipContainer.layer?.shadowOpacity = 1
        hoverTooltipContainer.layer?.shadowRadius = 8
        hoverTooltipContainer.layer?.shadowOffset = CGSize(width: 0, height: 3)
        hoverTooltipContainer.isHidden = true
        hoverTooltipContainer.alphaValue = 0

        // Increase font size to 14
        hoverTooltipLabel.font = NSFont.systemFont(ofSize: 14, weight: .medium)
        hoverTooltipLabel.textColor = DSV2.onSurface
        hoverTooltipLabel.isBordered = false
        hoverTooltipLabel.drawsBackground = false
        hoverTooltipLabel.isEditable = false
        hoverTooltipLabel.backgroundColor = .clear
        
        hoverTooltipContainer.addSubview(hoverTooltipLabel)
    }

    func configureTableView() {
        let column = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("ConversationColumn"))
        column.resizingMask = .autoresizingMask
        column.width = 47
        column.minWidth = 47
        column.maxWidth = 47

        tableView.addTableColumn(column)
        tableView.headerView = nil
        tableView.rowSizeStyle = .default

        // Strictly enforce column width and restrict horizontal expansion
        tableView.columnAutoresizingStyle = .uniformColumnAutoresizingStyle

        // 禁用系统的选中高亮样式，使用我们自定义的
        tableView.selectionHighlightStyle = .none

        tableView.allowsEmptySelection = true
        tableView.backgroundColor = .clear
        tableView.focusRingType = .none
        tableView.intercellSpacing = NSSize(width: 0, height: 0)
        tableView.delegate = self
        tableView.dataSource = self

        // 确保 tableView 使用 NSView-based cells
        tableView.style = .plain
    }

    func configureLayout() {
        let scrollView = NSScrollView()
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.borderType = .noBorder
        scrollView.hasVerticalScroller = false
        scrollView.hasHorizontalScroller = false
        scrollView.verticalScrollElasticity = .none
        scrollView.horizontalScrollElasticity = .none
        scrollView.drawsBackground = false
        scrollView.contentInsets = NSEdgeInsets(top: 0, left: 0, bottom: 0, right: 0)
        scrollView.documentView = tableView

        view.addSubview(scrollView)
        view.addSubview(rightDivider)
        view.addSubview(settingsButton)
        view.addSubview(helpButton)
        view.addSubview(quitButton)

        NSLayoutConstraint.activate([
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 12),
            scrollView.trailingAnchor.constraint(equalTo: rightDivider.leadingAnchor, constant: -12),
            scrollView.topAnchor.constraint(equalTo: view.topAnchor, constant: 16),
            scrollView.bottomAnchor.constraint(equalTo: settingsButton.topAnchor, constant: -12),

            rightDivider.topAnchor.constraint(equalTo: view.topAnchor),
            rightDivider.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            rightDivider.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            rightDivider.widthAnchor.constraint(equalToConstant: 1),

            settingsButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 10),
            settingsButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -10),
            settingsButton.bottomAnchor.constraint(equalTo: helpButton.topAnchor, constant: -10),
            settingsButton.heightAnchor.constraint(equalToConstant: 36),

            helpButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 10),
            helpButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -10),
            helpButton.bottomAnchor.constraint(equalTo: quitButton.topAnchor, constant: -10),
            helpButton.heightAnchor.constraint(equalToConstant: 36),

            quitButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 10),
            quitButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -10),
            quitButton.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -12),
            quitButton.heightAnchor.constraint(equalToConstant: 36)
        ])
    }

    func configureSettingsButton() {
        if #available(macOS 11.0, *) {
            let config = NSImage.SymbolConfiguration(pointSize: 18, weight: .medium)
            settingsButton.image = NSImage(systemSymbolName: "gearshape", accessibilityDescription: "Settings")?.withSymbolConfiguration(config)
        }

        settingsButton.title = ""
        settingsButton.bezelStyle = .regularSquare
        settingsButton.isBordered = false
        settingsButton.imagePosition = .imageOnly
        settingsButton.toolTip = LanguageManager.shared.localized("settings.title")
        settingsButton.defaultColor = DSV2.onSurfaceVariant
        settingsButton.hoverColor = DSV2.primary
        settingsButton.wantsLayer = true
        settingsButton.layer?.cornerRadius = 10

        settingsButton.target = self
        settingsButton.action = #selector(showSettingsMenu)
        settingsButton.translatesAutoresizingMaskIntoConstraints = false
        settingsButton.updateAppearance()
    }

    func configureHelpButton() {
        if #available(macOS 11.0, *) {
            let config = NSImage.SymbolConfiguration(pointSize: 18, weight: .medium)
            helpButton.image = NSImage(systemSymbolName: "questionmark.circle", accessibilityDescription: "Help")?.withSymbolConfiguration(config)
        }

        helpButton.title = ""
        helpButton.bezelStyle = .regularSquare
        helpButton.isBordered = false
        helpButton.imagePosition = .imageOnly
        helpButton.toolTip = LanguageManager.shared.localized("app.help")
        helpButton.defaultColor = DSV2.onSurfaceVariant
        helpButton.hoverColor = DSV2.primary
        helpButton.wantsLayer = true
        helpButton.layer?.cornerRadius = 10

        helpButton.target = self
        helpButton.action = #selector(openHelpWebsite)
        helpButton.translatesAutoresizingMaskIntoConstraints = false
        helpButton.updateAppearance()
    }

    func configureQuitButton() {
        if #available(macOS 11.0, *) {
            let config = NSImage.SymbolConfiguration(pointSize: 18, weight: .medium)
            quitButton.image = NSImage(systemSymbolName: "power", accessibilityDescription: "Quit")?.withSymbolConfiguration(config)
        }

        quitButton.title = ""
        quitButton.bezelStyle = .regularSquare
        quitButton.isBordered = false
        quitButton.imagePosition = .imageOnly
        quitButton.toolTip = LanguageManager.shared.localized("app.quit")
        quitButton.defaultColor = DSV2.error.withAlphaComponent(0.8)
        quitButton.hoverColor = DSV2.error
        quitButton.wantsLayer = true
        quitButton.layer?.cornerRadius = 10

        quitButton.target = self
        quitButton.action = #selector(quitApplication)
        quitButton.translatesAutoresizingMaskIntoConstraints = false
        quitButton.updateAppearance()
    }

    func showHoverTooltip(title: String, y: CGFloat) {
        guard let contentView = view.window?.contentView else { return }
        
        if hoverTooltipContainer.superview != contentView {
            hoverTooltipContainer.removeFromSuperview()
            contentView.addSubview(hoverTooltipContainer)
        }
        
        hoverTooltipLabel.stringValue = title
        hoverTooltipLabel.sizeToFit()
        let textSize = hoverTooltipLabel.bounds.size
        
        let padding: CGFloat = 6
        let width = textSize.width + padding * 2
        let height = textSize.height + padding * 2
        
        // Reduce gap: from 82 down to 74 (closer to sidebar edge which is 72)
        let localPoint = NSPoint(x: 74, y: y)
        let windowPoint = self.view.convert(localPoint, to: nil)
        let contentPoint = contentView.convert(windowPoint, from: nil)
        
        hoverTooltipContainer.frame = NSRect(
            x: contentPoint.x,
            y: contentPoint.y - height / 2,
            width: width,
            height: height
        )
        
        hoverTooltipLabel.frame = NSRect(
            x: padding,
            y: padding,
            width: textSize.width,
            height: textSize.height
        )
        
        hoverTooltipContainer.isHidden = false
        hoverTooltipContainer.alphaValue = 1
    }

    func hideHoverTooltip() {
        hoverTooltipContainer.isHidden = true
        hoverTooltipContainer.alphaValue = 0
    }

    @objc func showSettingsMenu(_ sender: NSButton) {
        tableView.deselectAll(nil)
        refreshSelectionForAllVisibleRows()
        settingsButton.isSelectedNode = true
        delegate?.sidebarViewControllerDidSelectSettings(self)
    }

    @objc func openHelpWebsite(_ sender: NSButton) {
        if let url = URL(string: "https://aiwithblockchain.github.io/") {
            NSWorkspace.shared.open(url)
        }
    }

    @objc func quitApplication(_ sender: NSButton) {
        NSApplication.shared.terminate(nil)
    }
}

private final class SidebarBottomButton: NSButton {
    var defaultColor: NSColor = DSV2.onSurface {
        didSet { updateAppearance() }
    }
    var hoverColor: NSColor = DSV2.primary {
        didSet { updateAppearance() }
    }
    var isSelectedNode: Bool = false {
        didSet { updateAppearance() }
    }
    private var isHovered: Bool = false {
        didSet { updateAppearance() }
    }

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        trackingAreas.forEach { removeTrackingArea($0) }
        let trackingArea = NSTrackingArea(
            rect: bounds,
            options: [.mouseEnteredAndExited, .activeAlways, .inVisibleRect],
            owner: self,
            userInfo: nil
        )
        addTrackingArea(trackingArea)
    }

    override func mouseEntered(with event: NSEvent) {
        isHovered = true
        super.mouseEntered(with: event)
    }

    override func mouseExited(with event: NSEvent) {
        isHovered = false
        super.mouseExited(with: event)
    }

    func updateAppearance() {
        if #available(macOS 11.0, *) {
            // Apply background color for selected/hover state
            if isSelectedNode {
                let sidebarAlpha: CGFloat = ThemeManager.shared.isDarkMode ? 0.18 : 1.0
                layer?.backgroundColor = DSV2.softAccentFill.withAlphaComponent(sidebarAlpha).cgColor
                contentTintColor = hoverColor
            } else if isHovered {
                layer?.backgroundColor = DSV2.surfaceContainerHighest.withAlphaComponent(0.3).cgColor
                contentTintColor = hoverColor
            } else {
                layer?.backgroundColor = NSColor.clear.cgColor
                contentTintColor = defaultColor
            }
        }
    }
}
private final class ConversationCellView: NSTableCellView {
    var onHoverChanged: ((Bool) -> Void)?

    var isHovered: Bool = false
    private let selectionBackgroundView = PassthroughView()
    private let iconView = PassthroughImageView()
    private let hoverTitleLabel = NSTextField(labelWithString: "")
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

    override func updateTrackingAreas() {
        super.updateTrackingAreas()

        trackingAreas.forEach(removeTrackingArea)
        let trackingArea = NSTrackingArea(
            rect: bounds,
            options: [.mouseEnteredAndExited, .activeAlways, .inVisibleRect],
            owner: self,
            userInfo: nil
        )
        addTrackingArea(trackingArea)
    }

    override func mouseEntered(with event: NSEvent) {
        onHoverChanged?(true)
    }

    override func mouseExited(with event: NSEvent) {
        onHoverChanged?(false)
    }

    func configure(with conversation: Conversation) {
        titleLabel.stringValue = conversation.title
        hoverTitleLabel.stringValue = conversation.title
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
        updateAppearance(isSelected: isSelected, isHovered: self.isHovered)
    }

    func updateAppearance(isSelected: Bool, isHovered: Bool) {
        // Ensure the main cell layer is clear
        wantsLayer = true
        layer?.backgroundColor = NSColor.clear.cgColor
        
        selectionBackgroundView.wantsLayer = true
        selectionBackgroundView.layer?.cornerRadius = 14
        hoverTitleLabel.textColor = DSV2.onSurface

        if isSelected {
            // 保持侧边栏导航原有的透明度逻辑：深色 18%，浅色 100%
            let sidebarAlpha: CGFloat = ThemeManager.shared.isDarkMode ? 0.18 : 1.0
            selectionBackgroundView.layer?.backgroundColor = DSV2.softAccentFill.withAlphaComponent(sidebarAlpha).cgColor
            iconView.contentTintColor = DSV2.primary
        } else if isHovered {
            selectionBackgroundView.layer?.backgroundColor = DSV2.surfaceContainerHighest.withAlphaComponent(0.3).cgColor
            iconView.contentTintColor = DSV2.primary
        } else {
            selectionBackgroundView.layer?.backgroundColor = NSColor.clear.cgColor
            iconView.contentTintColor = DSV2.onSurfaceVariant
        }
        
        selectionBackgroundView.layer?.borderWidth = 0
        selectionBackgroundView.layer?.borderColor = NSColor.clear.cgColor
    }
}

private extension ConversationCellView {
    func configureSubviews() {
        wantsLayer = true
        layer?.backgroundColor = NSColor.clear.cgColor

        iconView.translatesAutoresizingMaskIntoConstraints = false
        if #available(macOS 11.0, *) {
            iconView.symbolConfiguration = NSImage.SymbolConfiguration(pointSize: 20, weight: .medium)
        }
        iconView.contentTintColor = DSV2.onSurfaceVariant

        hoverTitleLabel.font = NSFont.systemFont(ofSize: 12, weight: .medium)
        hoverTitleLabel.textColor = DSV2.onSurface
        hoverTitleLabel.isHidden = true
        hoverTitleLabel.translatesAutoresizingMaskIntoConstraints = false

        titleLabel.isHidden = true
        subtitleLabel.isHidden = true
        previewLabel.isHidden = true
        statusDot.isHidden = true
        statusLabel.isHidden = true

        selectionBackgroundView.translatesAutoresizingMaskIntoConstraints = false
        selectionBackgroundView.wantsLayer = true
        selectionBackgroundView.layer?.cornerRadius = 14
        
        addSubview(selectionBackgroundView)
        addSubview(iconView)

        NSLayoutConstraint.activate([
            widthAnchor.constraint(greaterThanOrEqualToConstant: 36),
            
            selectionBackgroundView.centerXAnchor.constraint(equalTo: centerXAnchor),
            selectionBackgroundView.centerYAnchor.constraint(equalTo: centerYAnchor),
            selectionBackgroundView.widthAnchor.constraint(equalToConstant: 48),
            selectionBackgroundView.heightAnchor.constraint(equalToConstant: 48),

            iconView.centerXAnchor.constraint(equalTo: centerXAnchor),
            iconView.centerYAnchor.constraint(equalTo: centerYAnchor),
            iconView.widthAnchor.constraint(equalToConstant: 24),
            iconView.heightAnchor.constraint(equalToConstant: 24)
        ])
    }
}
