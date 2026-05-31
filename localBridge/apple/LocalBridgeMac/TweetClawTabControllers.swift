import AppKit

// Removed TweetClawHumanViewController - Functionality merged into TweetClawClawViewController

private final class InsetTextFieldCell: NSTextFieldCell {
    private let horizontalInset: CGFloat = 12

    override func drawingRect(forBounds rect: NSRect) -> NSRect {
        adjustedRect(for: rect)
    }

    override func titleRect(forBounds rect: NSRect) -> NSRect {
        adjustedRect(for: rect)
    }

    override func edit(withFrame rect: NSRect, in controlView: NSView, editor textObj: NSText, delegate: Any?, event: NSEvent?) {
        super.edit(withFrame: adjustedRect(for: rect), in: controlView, editor: textObj, delegate: delegate, event: event)
    }

    override func select(withFrame rect: NSRect, in controlView: NSView, editor textObj: NSText, delegate: Any?, start selStart: Int, length selLength: Int) {
        super.select(withFrame: adjustedRect(for: rect), in: controlView, editor: textObj, delegate: delegate, start: selStart, length: selLength)
    }

    private func adjustedRect(for rect: NSRect) -> NSRect {
        let horizontalRect = rect.insetBy(dx: horizontalInset, dy: 0)
        let naturalHeight = cellSize(forBounds: horizontalRect).height
        let centeredY = horizontalRect.origin.y + floor((horizontalRect.height - naturalHeight) / 2)
        return NSRect(
            x: horizontalRect.origin.x,
            y: centeredY,
            width: horizontalRect.width,
            height: naturalHeight
        )
    }
}

private final class InsetTextField: NSTextField {
    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        cell = InsetTextFieldCell()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        cell = InsetTextFieldCell()
    }
}

final class TweetClawClawViewController: NSViewController, NSTableViewDelegate, NSTableViewDataSource {
    private let tableView = NSTableView()
    private let headerImageView = NSImageView()
    private let headerTitleLabel = NSTextField(labelWithString: "")
    private var detailTextView: NSTextView!
    private var mainRightScrollView: NSScrollView!
    private let headerSeparator = NSView()

    // 高度约束，用于让文本视图在 StackView 中"撑开"
    private var detailHeightConstraint: NSLayoutConstraint?

    // Instance Selector
    private let instanceLabel = NSTextField(labelWithString: LanguageManager.shared.localized("tweetclaw.target_instance"))
    private let instancePopup = NSPopUpButton(frame: .zero, pullsDown: false)
    private let refreshInstancesButton = NSButton(title: "↻", target: nil, action: #selector(refreshInstancesClicked))
    private var instanceSnapshots: [LocalBridgeGoManager.InstanceSnapshot] = []
    private var isRefreshingInstances = false
    private var refreshAnimationTimer: Timer?
    private let refreshFrames = ["↻", "↺", "↻", "↺"]
    private var refreshFrameIndex = 0

    struct ApiDoc: Codable {
        let id: String
        let name: String
        let name_zh: String?
        let summary: String
        let summary_zh: String?
        let method: String
        let path: String
        let description: String
        let description_zh: String?
        let body: String?
        let body_zh: String?
        let curl: String
        let response: String

        enum CodingKeys: String, CodingKey {
            case id, name, name_zh, summary, summary_zh, method, path, description, description_zh, curl, response
            case body = "request_body"
            case body_zh = "request_body_zh"
        }

        var localizedName: String {
            if LanguageManager.shared.currentLanguage == .chinese, let nameZh = name_zh, !nameZh.isEmpty {
                return nameZh
            }
            return name
        }

        var localizedSummary: String {
            if LanguageManager.shared.currentLanguage == .chinese, let summaryZh = summary_zh, !summaryZh.isEmpty {
                return summaryZh
            }
            return summary
        }

        var localizedDescription: String {
            if LanguageManager.shared.currentLanguage == .chinese, let descZh = description_zh, !descZh.isEmpty {
                return descZh
            }
            return description
        }

        var localizedBody: String? {
            if LanguageManager.shared.currentLanguage == .chinese, let bodyZh = body_zh, !bodyZh.isEmpty {
                return bodyZh
            }
            return body
        }
    }

    // 分组数据模型
    private struct Section {
        let titleKey: String
        let docs: [ApiDoc]
        var isExpanded: Bool = true

        var localizedTitle: String {
            LanguageManager.shared.localized(titleKey)
        }
    }

    // 两个分组：X 和 XHS
    private var sections: [Section] = []

    // 扁平化的行数据，供 tableView 使用
    // 每行要么是 section header，要么是 doc
    private enum Row {
        case sectionHeader(sectionIndex: Int)
        case doc(sectionIndex: Int, docIndex: Int)
    }
    private var rows: [Row] = []

    private func rebuildRows() {
        rows = []
        for (si, section) in sections.enumerated() {
            rows.append(.sectionHeader(sectionIndex: si))
            if section.isExpanded {
                for di in 0..<section.docs.count {
                    rows.append(.doc(sectionIndex: si, docIndex: di))
                }
            }
        }
    }
    
    override func loadView() {
        view = NSView()
        view.wantsLayer = true
        view.layer?.backgroundColor = DSV2.surface.cgColor
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        loadDocs()
        setupUI()

        // 注册主题变化通知
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleThemeChange),
            name: ThemeManager.themeDidChangeNotification,
            object: nil
        )

        // 注册语言变化通知
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleLanguageChange),
            name: LanguageManager.languageDidChangeNotification,
            object: nil
        )

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleInstancesDidChange),
            name: LocalBridgeGoManager.instancesDidChangeNotification,
            object: nil
        )

        // 初始化文本
        headerTitleLabel.stringValue = LanguageManager.shared.localized("tweetclaw.title")

        loadInstances()
    }

    @objc private func handleLanguageChange() {
        headerTitleLabel.stringValue = LanguageManager.shared.localized("tweetclaw.title")
        instanceLabel.stringValue = LanguageManager.shared.localized("tweetclaw.target_instance")

        // Refresh instance popup if empty
        if instanceSnapshots.isEmpty {
            applyInstances([])
        }

        // Rebuild rows (section titles are localized)
        rebuildRows()

        // Refresh API card list
        tableView.reloadData()

        // Refresh detail view
        updateSelectedDetail()
    }

    @objc private func handleInstancesDidChange(_ notification: Notification) {
        if let snapshots = notification.userInfo?["instances"] as? [LocalBridgeGoManager.InstanceSnapshot] {
            applyInstances(snapshots.filter { $0.clientName == "tweetClaw" })
            return
        }

        loadInstances()
    }

    @objc private func handleThemeChange() {
        // 更新主视图背景
        view.layer?.backgroundColor = DSV2.surface.cgColor

        // 更新所有文本颜色
        headerTitleLabel.textColor = DSV2.onSurface
        headerImageView.contentTintColor = DSV2.primary
        instanceLabel.textColor = DSV2.onSurfaceTertiary

        // 更新文本视图
        detailTextView?.textColor = DSV2.onSurface

        // 更新按钮
        applyRefreshButtonStyle(isRefreshing: isRefreshingInstances)

        // 更新容器背景
        if let detailContainer = detailTextView?.superview {
            detailContainer.layer?.backgroundColor = DSV2.surfaceContainerHigh.cgColor
            detailContainer.layer?.borderColor = DSV2.cardBorder.cgColor
        }

        // 重新加载表格以更新 API 卡片
        tableView.reloadData()
        
        headerSeparator.layer?.backgroundColor = DSV2.divider.withAlphaComponent(0.8).cgColor

        view.needsDisplay = true
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    /// 从 AppDelegate 加载 tweetClaw 实例列表，更新下拉框
    private func loadInstances() {
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            let snapshots = self?.fetchInstances() ?? []
            DispatchQueue.main.async {
                self?.applyInstances(snapshots)
            }
        }
    }

    private func fetchInstances() -> [LocalBridgeGoManager.InstanceSnapshot] {
        let all = AppDelegate.shared?.getConnectedInstances() ?? []
        return all.filter { $0.clientName == "tweetClaw" }
    }

    private func applyInstances(_ snapshots: [LocalBridgeGoManager.InstanceSnapshot]) {
        instanceSnapshots = snapshots
        instancePopup.removeAllItems()
        instancePopup.menu?.removeAllItems()

        if instanceSnapshots.isEmpty {
            let item = NSMenuItem()
            item.attributedTitle = attributedInstanceTitle(
                LanguageManager.shared.localized("tweetclaw.no_instance"),
                color: DSV2.error,
                font: DSV2.fontMonoSm
            )
            instancePopup.menu?.addItem(item)
            instancePopup.select(item)
            return
        }

        for snapshot in instanceSnapshots {
            let item = NSMenuItem()
            item.attributedTitle = attributedInstanceTitle(displayName(for: snapshot))
            instancePopup.menu?.addItem(item)
        }

        instancePopup.selectItem(at: 0)
    }

    private func displayName(for snapshot: LocalBridgeGoManager.InstanceSnapshot) -> String {
        let legacySuffix = " \(LanguageManager.shared.localized("common.legacy"))"
        
        if let instanceName = snapshot.instanceName?.trimmingCharacters(in: .whitespacesAndNewlines),
           !instanceName.isEmpty {
            return snapshot.isTemporary ? "\(instanceName)\(legacySuffix)" : instanceName
        }

        if let screenName = snapshot.xScreenName?.trimmingCharacters(in: .whitespacesAndNewlines),
           !screenName.isEmpty {
            return snapshot.isTemporary ? "@\(screenName)\(legacySuffix)" : "@\(screenName)"
        }

        let fallbackId = String(snapshot.instanceId.prefix(8))
        return snapshot.isTemporary ? "[\(fallbackId)...]\(legacySuffix)" : "[\(fallbackId)...]"
    }

    private func attributedInstanceTitle(
        _ title: String,
        color: NSColor = DSV2.onSurface,
        font: NSFont = DSV2.fontMonoSm
    ) -> NSAttributedString {
        NSAttributedString(string: title, attributes: [
            .foregroundColor: color,
            .font: font
        ])
    }

    private func setRefreshingInstances(_ isRefreshing: Bool) {
        isRefreshingInstances = isRefreshing
        refreshInstancesButton.isEnabled = !isRefreshing
        instancePopup.isEnabled = !isRefreshing
        applyRefreshButtonStyle(isRefreshing: isRefreshing)

        if isRefreshing {
            startRefreshAnimation()
        } else {
            stopRefreshAnimation()
        }
    }

    private func startRefreshAnimation() {
        stopRefreshAnimation()
        refreshFrameIndex = 0
        updateRefreshButtonSymbol(refreshFrames[refreshFrameIndex], isRefreshing: true)
        refreshAnimationTimer = Timer.scheduledTimer(withTimeInterval: 0.12, repeats: true) { [weak self] _ in
            guard let self else { return }
            self.refreshFrameIndex = (self.refreshFrameIndex + 1) % self.refreshFrames.count
            self.updateRefreshButtonSymbol(self.refreshFrames[self.refreshFrameIndex], isRefreshing: true)
        }
    }

    private func stopRefreshAnimation() {
        refreshAnimationTimer?.invalidate()
        refreshAnimationTimer = nil
        updateRefreshButtonSymbol("↻", isRefreshing: false)
    }

    private func applyRefreshButtonStyle(isRefreshing: Bool = false) {
        refreshInstancesButton.layer?.backgroundColor = isRefreshing
            ? DSV2.primary.withAlphaComponent(0.16).cgColor
            : DSV2.surfaceBright.cgColor
        refreshInstancesButton.layer?.borderColor = (isRefreshing ? DSV2.primary.withAlphaComponent(0.5) : DSV2.cardBorder).cgColor
        updateRefreshButtonSymbol(isRefreshing ? refreshFrames[refreshFrameIndex] : "↻", isRefreshing: isRefreshing)
    }

    private func updateRefreshButtonSymbol(_ symbol: String, isRefreshing: Bool) {
        let attributes: [NSAttributedString.Key: Any] = [
            .foregroundColor: isRefreshing ? DSV2.primary : DSV2.onSurfaceVariant,
            .font: NSFont.systemFont(ofSize: 14, weight: .semibold)
        ]
        refreshInstancesButton.attributedTitle = NSAttributedString(string: symbol, attributes: attributes)
    }

    private func selectedInstanceId() -> String? {
        guard !instanceSnapshots.isEmpty else { return nil }
        let idx = instancePopup.indexOfSelectedItem
        guard instanceSnapshots.indices.contains(idx) else { return nil }
        return instanceSnapshots[idx].instanceId
    }

    @objc private func refreshInstancesClicked() {
        guard !isRefreshingInstances else { return }

        setRefreshingInstances(true)
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            let snapshots = self?.fetchInstances() ?? []
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                self?.applyInstances(snapshots)
                self?.setRefreshingInstances(false)
            }
        }
    }
    
    private func loadDocs() {
        let xDocs = loadDocFile(name: "api_docs", candidateURLs: candidateURLs(for: "api_docs"))
        let xhsDocs = loadDocFile(name: "api_xhs_doc", candidateURLs: candidateURLs(for: "api_xhs_doc"))
        sections = [
            Section(titleKey: "tweetclaw.section.x", docs: xDocs, isExpanded: true),
            Section(titleKey: "tweetclaw.section.xhs", docs: xhsDocs, isExpanded: true)
        ]
        rebuildRows()
    }

    private func loadDocFile(name: String, candidateURLs: [URL]) -> [ApiDoc] {
        for url in candidateURLs {
            if let data = try? Data(contentsOf: url) {
                do {
                    let docs = try JSONDecoder().decode([ApiDoc].self, from: data)
                    print("[LocalBridgeMac] Loaded \(name).json from \(url.path)")
                    return docs
                } catch {
                    print("[LocalBridgeMac] JSON Decode Error from \(url.path): \(error)")
                }
            }
        }
        return []
    }

    private func candidateURLs(for name: String) -> [URL] {
        let fileManager = FileManager.default
        let currentDirectory = URL(fileURLWithPath: fileManager.currentDirectoryPath, isDirectory: true)
        let repoRoot = fileManager.homeDirectoryForCurrentUser
            .appendingPathComponent("aiwithblockchain/aihub/localBridge/apple", isDirectory: true)

        return [
            Bundle.main.url(forResource: name, withExtension: "json"),
            currentDirectory.appendingPathComponent("\(name).json"),
            currentDirectory.appendingPathComponent("LocalBridgeMac/\(name).json"),
            repoRoot.appendingPathComponent("LocalBridgeMac/\(name).json")
        ].compactMap { $0 }
    }
    
    private func setupUI() {
        // --- Header ---
        if #available(macOS 11.0, *) {
            headerImageView.image = NSImage(systemSymbolName: "network", accessibilityDescription: nil)
            headerImageView.symbolConfiguration = NSImage.SymbolConfiguration(pointSize: 20, weight: .semibold)
            headerImageView.contentTintColor = DSV2.primary
        }
        headerImageView.translatesAutoresizingMaskIntoConstraints = false
        headerTitleLabel.font = DSV2.fontTitleLg
        headerTitleLabel.textColor = DSV2.onSurface

        let headerStack = NSStackView(views: [headerImageView, headerTitleLabel])
        headerStack.orientation = .horizontal
        headerStack.spacing = 8
        headerStack.alignment = .centerY
        headerStack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(headerStack)

        // --- Left Column: API List ---
        let listScrollView = NSScrollView()
        listScrollView.hasVerticalScroller = true
        listScrollView.drawsBackground = false
        listScrollView.borderType = .noBorder
        listScrollView.translatesAutoresizingMaskIntoConstraints = false
        listScrollView.wantsLayer = true
        listScrollView.layer?.backgroundColor = DSV2.surface.cgColor
        listScrollView.layer?.cornerRadius = DSV2.radiusContainer
        listScrollView.layer?.borderWidth = 1
        listScrollView.layer?.borderColor = DSV2.cardBorder.cgColor

        tableView.intercellSpacing = NSSize(width: 0, height: DSV2.spacing4)
        tableView.allowsEmptySelection = false

        let column = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("ApiColumn"))
        column.resizingMask = .autoresizingMask
        tableView.addTableColumn(column)
        listScrollView.documentView = tableView
        view.addSubview(listScrollView)

        // --- Header Separator ---
        headerSeparator.wantsLayer = true
        headerSeparator.layer?.backgroundColor = DSV2.divider.withAlphaComponent(0.8).cgColor
        headerSeparator.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(headerSeparator)

        // --- Right Column: Documentation Only ---

        // 1. Instance Row (Top)
        instanceLabel.font = DSV2.fontLabelSm
        instanceLabel.textColor = DSV2.onSurfaceTertiary
        instanceLabel.translatesAutoresizingMaskIntoConstraints = false

        instancePopup.translatesAutoresizingMaskIntoConstraints = false
        instancePopup.wantsLayer = true
        instancePopup.bezelStyle = .rounded
        instancePopup.font = DSV2.fontMonoSm
        instancePopup.contentTintColor = DSV2.onSurface
        instancePopup.appearance = NSAppearance(named: .aqua)
        instancePopup.setContentHuggingPriority(.defaultLow, for: .horizontal)

        refreshInstancesButton.target = self
        refreshInstancesButton.wantsLayer = true
        refreshInstancesButton.isBordered = false
        refreshInstancesButton.layer?.backgroundColor = DSV2.surfaceBright.cgColor
        refreshInstancesButton.layer?.cornerRadius = DSV2.radiusButton
        refreshInstancesButton.layer?.borderWidth = 1
        refreshInstancesButton.layer?.borderColor = DSV2.cardBorder.cgColor
        updateRefreshButtonSymbol("↻", isRefreshing: false)
        refreshInstancesButton.translatesAutoresizingMaskIntoConstraints = false
        refreshInstancesButton.widthAnchor.constraint(equalToConstant: 32).isActive = true
        refreshInstancesButton.heightAnchor.constraint(equalToConstant: 32).isActive = true

        let instanceRow = NSStackView(views: [instanceLabel, instancePopup, refreshInstancesButton, NSView()])
        instanceRow.orientation = .horizontal
        instanceRow.spacing = 8
        instanceRow.alignment = .centerY
        instanceRow.edgeInsets = NSEdgeInsets(top: 0, left: DSV2.spacing4, bottom: 0, right: 0)
        instanceRow.translatesAutoresizingMaskIntoConstraints = false

        // 2. Documentation Container with ScrollView
        let detailScrollView = NSScrollView()
        detailScrollView.hasVerticalScroller = true
        detailScrollView.hasHorizontalScroller = false
        detailScrollView.drawsBackground = false
        detailScrollView.borderType = .noBorder
        detailScrollView.translatesAutoresizingMaskIntoConstraints = false
        detailScrollView.wantsLayer = true
        detailScrollView.layer?.backgroundColor = DSV2.surfaceContainerHigh.cgColor
        detailScrollView.layer?.cornerRadius = DSV2.radiusContainer
        detailScrollView.layer?.borderWidth = 1
        detailScrollView.layer?.borderColor = DSV2.cardBorder.cgColor
        DSV2.applyBrightScroller(to: detailScrollView)

        detailTextView = NSTextView()
        detailTextView.isEditable = false
        detailTextView.isSelectable = true
        detailTextView.drawsBackground = false
        detailTextView.font = DSV2.fontBodyMd
        detailTextView.textColor = DSV2.onSurface
        detailTextView.textContainerInset = NSSize(width: DSV2.spacing4, height: DSV2.spacing4)
        detailTextView.isVerticallyResizable = true
        detailTextView.isHorizontallyResizable = false
        detailTextView.autoresizingMask = [.width]
        detailTextView.textContainer?.widthTracksTextView = true
        detailTextView.textContainer?.containerSize = NSSize(width: 0, height: CGFloat.greatestFiniteMagnitude)
        detailTextView.maxSize = NSSize(width: CGFloat.greatestFiniteMagnitude, height: CGFloat.greatestFiniteMagnitude)

        detailScrollView.documentView = detailTextView

        // Store reference for scrolling
        mainRightScrollView = detailScrollView

        // 3. Outer Container for Fixed Header + Scrollable Area
        let rightColumnOuterStack = NSStackView(views: [
            instanceRow,
            detailScrollView
        ])
        rightColumnOuterStack.orientation = .vertical
        rightColumnOuterStack.alignment = .leading
        rightColumnOuterStack.spacing = DSV2.spacing4
        rightColumnOuterStack.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(rightColumnOuterStack)

        headerImageView.contentTintColor = DSV2.primary

        NSLayoutConstraint.activate([
            headerStack.topAnchor.constraint(equalTo: view.topAnchor, constant: DSV2.spacing6),
            headerStack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: DSV2.spacing6 + 12),

            headerSeparator.topAnchor.constraint(equalTo: headerStack.bottomAnchor, constant: 12),
            headerSeparator.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            headerSeparator.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            headerSeparator.heightAnchor.constraint(equalToConstant: 1),

            listScrollView.topAnchor.constraint(equalTo: headerSeparator.bottomAnchor, constant: 30),
            listScrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: DSV2.spacing6),
            listScrollView.widthAnchor.constraint(equalToConstant: 300),
            listScrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -DSV2.spacing6),

            // Outer Stack Constraints
            rightColumnOuterStack.topAnchor.constraint(equalTo: listScrollView.topAnchor),
            rightColumnOuterStack.leadingAnchor.constraint(equalTo: listScrollView.trailingAnchor, constant: DSV2.spacing4),
            rightColumnOuterStack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -DSV2.spacing6),
            rightColumnOuterStack.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -DSV2.spacing6),

            instanceRow.widthAnchor.constraint(equalTo: rightColumnOuterStack.widthAnchor),
            detailScrollView.widthAnchor.constraint(equalTo: rightColumnOuterStack.widthAnchor)
        ])

        // 设置代理（放到最后，防止在界面完全初始化前触发选择事件导致的 Crash）
        tableView.delegate = self
        tableView.dataSource = self
        tableView.usesAutomaticRowHeights = false
        tableView.rowHeight = 80
        tableView.headerView = nil
        tableView.selectionHighlightStyle = .none
        tableView.backgroundColor = .clear
        tableView.allowsEmptySelection = true

        selectDefaultRow()
    }




    /// 公开方法：强制选中第一个 doc 行并显示详情，由 DetailViewController 触发
    func selectDefaultRow() {
        guard let firstDocRow = rows.firstIndex(where: { if case .doc = $0 { return true }; return false }) else { return }
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.tableView.selectRowIndexes(IndexSet(integer: firstDocRow), byExtendingSelection: false)
            self.refreshCardStyles()
            self.updateSelectedDetail()
        }
    }

    /// 强制刷新所有可见行的样式
    func refreshCardStyles() {
        let selectedRow = tableView.selectedRow
        for row in 0..<tableView.numberOfRows {
            if let cellView = tableView.view(atColumn: 0, row: row, makeIfNecessary: false) {
                switch rows[row] {
                case .sectionHeader:
                    break // section header 无选中样式
                case .doc:
                    applyCardStyle(to: cellView, isSelected: row == selectedRow)
                }
            }
        }
    }

    private func applyCardStyle(to cell: NSView, isSelected: Bool) {
        cell.wantsLayer = true
        cell.layer?.cornerRadius = DSV2.radiusCard
        cell.layer?.masksToBounds = true

        if isSelected {
            let bgAlpha: CGFloat = ThemeManager.shared.isDarkMode ? 0.2 : 0.4
            cell.layer?.backgroundColor = DSV2.softAccentFill.withAlphaComponent(bgAlpha).cgColor
            cell.layer?.borderWidth = 1.2
            cell.layer?.borderColor = DSV2.primary.withAlphaComponent(0.3).cgColor
        } else {
            cell.layer?.backgroundColor = DSV2.surfaceContainerLow.cgColor
            cell.layer?.borderWidth = 1
            cell.layer?.borderColor = DSV2.cardBorder.withAlphaComponent(0.3).cgColor
        }

        if let nameLabel = cell.subviews.first(where: { $0.identifier == NSUserInterfaceItemIdentifier("apiNameLabel") }) as? NSTextField {
            nameLabel.textColor = isSelected ? DSV2.primary : DSV2.onSurface
        }
        if let summaryLabel = cell.subviews.first(where: { $0.identifier == NSUserInterfaceItemIdentifier("apiSummaryLabel") }) as? NSTextField {
            summaryLabel.textColor = DSV2.onSurfaceVariant
        }
    }

    func updateSelectedDetail() {
        let row = tableView.selectedRow
        guard row >= 0 && row < rows.count else { return }
        if case .doc(let si, let di) = rows[row] {
            updateDetailView(with: sections[si].docs[di])
        }
    }

    func numberOfRows(in tableView: NSTableView) -> Int {
        return rows.count
    }

    func tableView(_ tableView: NSTableView, viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
        guard row < rows.count else { return nil }

        switch rows[row] {
        case .sectionHeader(let si):
            return makeSectionHeaderCell(sectionIndex: si)
        case .doc(let si, let di):
            return makeDocCell(doc: sections[si].docs[di], row: row)
        }
    }

    private func makeSectionHeaderCell(sectionIndex: Int) -> NSView {
        let identifier = NSUserInterfaceItemIdentifier("SectionHeaderCell")
        if let existing = tableView.makeView(withIdentifier: identifier, owner: self) {
            if let titleLabel = existing.subviews.first(where: { $0.identifier == NSUserInterfaceItemIdentifier("sectionTitleLabel") }) as? NSTextField {
                titleLabel.stringValue = sections[sectionIndex].localizedTitle
            }
            if let chevron = existing.subviews.first(where: { $0.identifier == NSUserInterfaceItemIdentifier("sectionChevron") }) as? NSTextField {
                chevron.stringValue = sections[sectionIndex].isExpanded ? "▾" : "▸"
            }
            // ensure gesture recognizer exists (defensive: reused cell from unexpected source)
            if existing.gestureRecognizers.isEmpty {
                let click = NSClickGestureRecognizer(target: self, action: #selector(sectionHeaderClicked(_:)))
                existing.addGestureRecognizer(click)
            }
            return existing
        }

        let cell = NSView()
        cell.identifier = identifier
        cell.wantsLayer = true

        let chevron = NSTextField(labelWithString: sections[sectionIndex].isExpanded ? "▾" : "▸")
        chevron.font = NSFont.systemFont(ofSize: 11, weight: .semibold)
        chevron.textColor = DSV2.onSurfaceVariant
        chevron.translatesAutoresizingMaskIntoConstraints = false
        chevron.identifier = NSUserInterfaceItemIdentifier("sectionChevron")

        let titleLabel = NSTextField(labelWithString: sections[sectionIndex].localizedTitle)
        titleLabel.font = NSFont.systemFont(ofSize: 11, weight: .semibold)
        titleLabel.textColor = DSV2.onSurfaceVariant
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        titleLabel.identifier = NSUserInterfaceItemIdentifier("sectionTitleLabel")

        cell.addSubview(chevron)
        cell.addSubview(titleLabel)

        NSLayoutConstraint.activate([
            chevron.leadingAnchor.constraint(equalTo: cell.leadingAnchor, constant: 8),
            chevron.centerYAnchor.constraint(equalTo: cell.centerYAnchor),
            chevron.widthAnchor.constraint(equalToConstant: 14),

            titleLabel.leadingAnchor.constraint(equalTo: chevron.trailingAnchor, constant: 4),
            titleLabel.trailingAnchor.constraint(equalTo: cell.trailingAnchor, constant: -8),
            titleLabel.centerYAnchor.constraint(equalTo: cell.centerYAnchor)
        ])

        let click = NSClickGestureRecognizer(target: self, action: #selector(sectionHeaderClicked(_:)))
        cell.addGestureRecognizer(click)

        return cell
    }

    private func makeDocCell(doc: ApiDoc, row: Int) -> NSView {
        let identifier = NSUserInterfaceItemIdentifier("ApiCell")
        var cell = tableView.makeView(withIdentifier: identifier, owner: self) as? NSTableCellView

        if cell == nil {
            cell = NSTableCellView()
            cell?.identifier = identifier
            cell?.wantsLayer = true

            let nameLabel = PassthroughTextField(labelWithString: "")
            nameLabel.font = DSV2.fontTitleSm
            nameLabel.translatesAutoresizingMaskIntoConstraints = false
            nameLabel.identifier = NSUserInterfaceItemIdentifier("apiNameLabel")

            let summaryLabel = PassthroughTextField(wrappingLabelWithString: "")
            summaryLabel.font = DSV2.fontBodySm
            summaryLabel.textColor = DSV2.onSurfaceVariant
            summaryLabel.translatesAutoresizingMaskIntoConstraints = false
            summaryLabel.identifier = NSUserInterfaceItemIdentifier("apiSummaryLabel")

            cell?.addSubview(nameLabel)
            cell?.addSubview(summaryLabel)

            NSLayoutConstraint.activate([
                nameLabel.topAnchor.constraint(equalTo: cell!.topAnchor, constant: 12),
                nameLabel.leadingAnchor.constraint(equalTo: cell!.leadingAnchor, constant: 12),
                nameLabel.trailingAnchor.constraint(equalTo: cell!.trailingAnchor, constant: -12),

                summaryLabel.topAnchor.constraint(equalTo: nameLabel.bottomAnchor, constant: 8),
                summaryLabel.leadingAnchor.constraint(equalTo: cell!.leadingAnchor, constant: 12),
                summaryLabel.trailingAnchor.constraint(equalTo: cell!.trailingAnchor, constant: -12),
                summaryLabel.bottomAnchor.constraint(equalTo: cell!.bottomAnchor, constant: -12)
            ])
        }

        let isSelected = tableView.selectedRow == row
        applyCardStyle(to: cell!, isSelected: isSelected)

        if let nameLabel = cell?.subviews.first(where: { $0.identifier == NSUserInterfaceItemIdentifier("apiNameLabel") }) as? NSTextField {
            nameLabel.stringValue = doc.localizedName
        }
        if let summaryLabel = cell?.subviews.first(where: { $0.identifier == NSUserInterfaceItemIdentifier("apiSummaryLabel") }) as? NSTextField {
            summaryLabel.stringValue = doc.localizedSummary
        }

        return cell!
    }

    @objc private func sectionHeaderClicked(_ gesture: NSClickGestureRecognizer) {
        guard let cell = gesture.view else { return }
        let clickedRow = tableView.row(for: cell)
        guard clickedRow >= 0 && clickedRow < rows.count,
              case .sectionHeader(let si) = rows[clickedRow],
              sections.indices.contains(si) else { return }

        sections[si].isExpanded.toggle()
        rebuildRows()
        tableView.reloadData()
        refreshCardStyles()
    }

    func tableView(_ tableView: NSTableView, heightOfRow row: Int) -> CGFloat {
        guard row < rows.count else { return 80 }
        if case .sectionHeader = rows[row] { return 32 }
        return 80
    }

    func tableView(_ tableView: NSTableView, shouldSelectRow row: Int) -> Bool {
        guard row < rows.count else { return false }
        if case .sectionHeader = rows[row] { return false }
        return true
    }

    func tableViewSelectionDidChange(_ notification: Notification) {
        refreshCardStyles()

        let row = tableView.selectedRow
        guard row >= 0 && row < rows.count else {
            updateDetailView(with: nil)
            return
        }

        if case .doc(let si, let di) = rows[row] {
            updateDetailView(with: sections[si].docs[di])
        }

        mainRightScrollView?.contentView.scrollToVisible(NSRect.zero)
    }

    private func updateDetailView(with doc: ApiDoc?) {
        guard let textView = detailTextView else {
            return
        }

        guard let doc = doc else {
            textView.string = LanguageManager.shared.localized("tweetclaw.api_placeholder")
            return
        }

        let attrStr = NSMutableAttributedString()

        // 定义段落样式
        let titleParagraphStyle = NSMutableParagraphStyle()
        titleParagraphStyle.lineSpacing = 2
        titleParagraphStyle.paragraphSpacing = 16

        let headingParagraphStyle = NSMutableParagraphStyle()
        headingParagraphStyle.lineSpacing = 2
        headingParagraphStyle.paragraphSpacing = 8
        headingParagraphStyle.paragraphSpacingBefore = 12

        let bodyParagraphStyle = NSMutableParagraphStyle()
        bodyParagraphStyle.lineSpacing = 6
        bodyParagraphStyle.paragraphSpacing = 16

        let codeParagraphStyle = NSMutableParagraphStyle()
        codeParagraphStyle.lineSpacing = 4
        codeParagraphStyle.paragraphSpacing = 16

        // 1. API 名称（大标题）
        attrStr.append(NSAttributedString(
            string: "\(doc.localizedName)\n",
            attributes: [
                .font: NSFont.systemFont(ofSize: 24, weight: .semibold),
                .foregroundColor: DSV2.onSurface,
                .paragraphStyle: titleParagraphStyle
            ]
        ))

        // 2. HTTP 方法和路径
        attrStr.append(NSAttributedString(
            string: "\(doc.method) ",
            attributes: [
                .font: NSFont.monospacedSystemFont(ofSize: 13, weight: .semibold),
                .foregroundColor: DSV2.primary
            ]
        ))
        attrStr.append(NSAttributedString(
            string: "\(doc.path)\n\n",
            attributes: [
                .font: NSFont.monospacedSystemFont(ofSize: 13, weight: .regular),
                .foregroundColor: DSV2.onSurfaceVariant
            ]
        ))

        // 3. SUMMARY（概述）
        attrStr.append(NSAttributedString(
            string: "\(LanguageManager.shared.localized("api.summary"))\n",
            attributes: [
                .font: NSFont.systemFont(ofSize: 13, weight: .semibold),
                .foregroundColor: DSV2.onSurface,
                .paragraphStyle: headingParagraphStyle
            ]
        ))
        attrStr.append(NSAttributedString(
            string: "\(doc.localizedSummary)\n",
            attributes: [
                .font: NSFont.systemFont(ofSize: 13, weight: .regular),
                .foregroundColor: DSV2.onSurfaceVariant,
                .paragraphStyle: bodyParagraphStyle
            ]
        ))

        // 4. DESCRIPTION（详细描述）
        attrStr.append(NSAttributedString(
            string: "\(LanguageManager.shared.localized("api.description"))\n",
            attributes: [
                .font: NSFont.systemFont(ofSize: 13, weight: .semibold),
                .foregroundColor: DSV2.onSurface,
                .paragraphStyle: headingParagraphStyle
            ]
        ))
        attrStr.append(NSAttributedString(
            string: "\(doc.localizedDescription)\n",
            attributes: [
                .font: NSFont.systemFont(ofSize: 13, weight: .regular),
                .foregroundColor: DSV2.onSurfaceVariant,
                .paragraphStyle: bodyParagraphStyle
            ]
        ))

        // 5. REQUEST BODY（如果有）
        if let body = doc.localizedBody {
            attrStr.append(NSAttributedString(
                string: "\(LanguageManager.shared.localized("api.request_body"))\n",
                attributes: [
                    .font: NSFont.systemFont(ofSize: 13, weight: .semibold),
                    .foregroundColor: DSV2.onSurface,
                    .paragraphStyle: headingParagraphStyle
                ]
            ))
            attrStr.append(NSAttributedString(
                string: "\(body)\n",
                attributes: [
                    .font: NSFont.monospacedSystemFont(ofSize: 12, weight: .regular),
                    .foregroundColor: DSV2.tertiary,
                    .paragraphStyle: codeParagraphStyle
                ]
            ))
        }

        // 6. cURL EXAMPLE
        attrStr.append(NSAttributedString(
            string: "\(LanguageManager.shared.localized("api.curl_example"))\n",
            attributes: [
                .font: NSFont.systemFont(ofSize: 13, weight: .semibold),
                .foregroundColor: DSV2.onSurface,
                .paragraphStyle: headingParagraphStyle
            ]
        ))

        let highlightedCurl = highlightCurl(doc.curl)
        let mutableCurl = NSMutableAttributedString(attributedString: highlightedCurl)
        // 给代码块增加背景色属性 (配合 textView 的渲染)
        mutableCurl.addAttribute(.backgroundColor, value: DSV2.codeBackground, range: NSRange(location: 0, length: mutableCurl.length))
        mutableCurl.addAttribute(.paragraphStyle, value: codeParagraphStyle, range: NSRange(location: 0, length: mutableCurl.length))
        
        attrStr.append(mutableCurl)
        attrStr.append(NSAttributedString(string: "\n"))

        // 7. RESPONSE FORMAT
        attrStr.append(NSAttributedString(
            string: "\(LanguageManager.shared.localized("api.response_format"))\n",
            attributes: [
                .font: NSFont.systemFont(ofSize: 13, weight: .semibold),
                .foregroundColor: DSV2.onSurface,
                .paragraphStyle: headingParagraphStyle
            ]
        ))
        attrStr.append(NSAttributedString(
            string: "\(doc.response)\n",
            attributes: [
                .font: NSFont.monospacedSystemFont(ofSize: 12, weight: .regular),
                .foregroundColor: DSV2.onSurface,
                .paragraphStyle: codeParagraphStyle
            ]
        ))

        textView.textStorage?.setAttributedString(attrStr)
        textView.scrollToBeginningOfDocument(nil)
    }
    
    private func highlightCurl(_ text: String) -> NSAttributedString {
        let attrStr = NSMutableAttributedString(string: text, attributes: [
            .font: DSV2.fontMonoSm,
            .foregroundColor: DSV2.onSurfaceVariant
        ])
        
        // 简单关键字高亮
        let keywords = [
            ("curl", DSV2.primary),
            ("-X", DSV2.primary),
            ("GET", DSV2.secondary),
            ("POST", DSV2.tertiary),
            ("PUT", DSV2.primary),
            ("DELETE", DSV2.error),
            ("-H", DSV2.primary),
            ("-d", DSV2.primary)
        ]
        
        for (word, color) in keywords {
            let range = (text as NSString).range(of: word)
            if range.location != NSNotFound {
                attrStr.addAttribute(.foregroundColor, value: color, range: range)
            }
        }
        
        // 简单的 URL 高亮检测 (http...)
        if let urlRange = text.range(of: "http[s]?://[\\w.-]+(:\\d+)?(/[\\w.-]*)*", options: .regularExpression) {
            attrStr.addAttribute(.foregroundColor, value: DSV2.secondary, range: NSRange(urlRange, in: text))
        }
        
        return attrStr
    }
}
