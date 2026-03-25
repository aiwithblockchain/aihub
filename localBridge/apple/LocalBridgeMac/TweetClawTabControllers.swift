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

    // 高度约束，用于让文本视图在 StackView 中"撑开"
    private var detailHeightConstraint: NSLayoutConstraint?

    // Instance Selector
    private let instanceLabel = NSTextField(labelWithString: "TARGET INSTANCE")
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
        let summary: String        // Concise functional description
        let method: String
        let path: String
        let description: String
        let body: String?
        let curl: String
        let response: String
        
        enum CodingKeys: String, CodingKey {
            case id, name, summary, method, path, description, curl, response
            case body = "request_body"
        }
    }


    private var docs: [ApiDoc] = []
    
    override func loadView() {
        view = NSView()
        view.wantsLayer = true
        view.layer?.backgroundColor = DSV2.surfaceContainerLow.cgColor
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

        // 初始化文本
        headerTitleLabel.stringValue = LanguageManager.shared.localized("tweetclaw.title")

        loadInstances()
    }

    @objc private func handleLanguageChange() {
        headerTitleLabel.stringValue = LanguageManager.shared.localized("tweetclaw.title")
    }

    @objc private func handleThemeChange() {
        // 更新主视图背景
        view.layer?.backgroundColor = DSV2.surfaceContainerLow.cgColor

        // 更新所有文本颜色
        headerTitleLabel.textColor = DSV2.onSurface
        headerImageView.contentTintColor = DSV2.primary
        instanceLabel.textColor = DSV2.onSurfaceTertiary

        // 更新文本视图
        detailTextView?.textColor = DSV2.tertiary

        // 更新按钮
        applyRefreshButtonStyle(isRefreshing: isRefreshingInstances)

        // 更新容器背景
        if let detailContainer = detailTextView?.superview {
            detailContainer.layer?.backgroundColor = DSV2.surfaceContainerLowest.cgColor
            detailContainer.layer?.borderColor = DSV2.outlineVariant.withAlphaComponent(0.1).cgColor
        }

        // 重新加载表格以更新 API 卡片
        tableView.reloadData()

        view.needsDisplay = true
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    /// 从 AppDelegate 加载 tweetClaw 实例列表，更新下拉框
    private func loadInstances() {
        applyInstances(fetchInstances())
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
                "No instance available",
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
        if let instanceName = snapshot.instanceName?.trimmingCharacters(in: .whitespacesAndNewlines),
           !instanceName.isEmpty {
            return snapshot.isTemporary ? "\(instanceName) (Legacy)" : instanceName
        }

        if let screenName = snapshot.xScreenName?.trimmingCharacters(in: .whitespacesAndNewlines),
           !screenName.isEmpty {
            return snapshot.isTemporary ? "@\(screenName) (Legacy)" : "@\(screenName)"
        }

        let fallbackId = String(snapshot.instanceId.prefix(8))
        return snapshot.isTemporary ? "[\(fallbackId)...] (Legacy)" : "[\(fallbackId)...]"
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
        refreshInstancesButton.layer?.backgroundColor = (isRefreshing ? DSV2.primary.withAlphaComponent(0.18) : DSV2.surfaceContainerHigh).cgColor
        refreshInstancesButton.layer?.borderColor = (isRefreshing ? DSV2.primary.withAlphaComponent(0.75) : DSV2.outlineVariant.withAlphaComponent(0.35)).cgColor
        updateRefreshButtonSymbol(isRefreshing ? refreshFrames[refreshFrameIndex] : "↻", isRefreshing: isRefreshing)
    }

    private func updateRefreshButtonSymbol(_ symbol: String, isRefreshing: Bool) {
        let attributes: [NSAttributedString.Key: Any] = [
            .foregroundColor: isRefreshing ? NSColor.white : DSV2.primary,
            .font: NSFont.systemFont(ofSize: 14, weight: .bold)
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
        for url in apiDocsCandidateURLs() {
            if let data = try? Data(contentsOf: url) {
                do {
                    self.docs = try JSONDecoder().decode([ApiDoc].self, from: data)
                    print("[LocalBridgeMac] Loaded api_docs.json from \(url.path)")
                    return
                } catch {
                    print("[LocalBridgeMac] JSON Decode Error from \(url.path): \(error)")
                }
            }
        }
    }

    private func apiDocsCandidateURLs() -> [URL] {
        let fileManager = FileManager.default
        let currentDirectory = URL(fileURLWithPath: fileManager.currentDirectoryPath, isDirectory: true)
        let repoRoot = fileManager.homeDirectoryForCurrentUser
            .appendingPathComponent("aiwithblockchain/aihub/localBridge/apple", isDirectory: true)

        return [
            Bundle.main.url(forResource: "api_docs", withExtension: "json"),
            currentDirectory.appendingPathComponent("api_docs.json"),
            currentDirectory.appendingPathComponent("LocalBridgeMac/api_docs.json"),
            repoRoot.appendingPathComponent("LocalBridgeMac/api_docs.json")
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

        tableView.intercellSpacing = NSSize(width: 0, height: DSV2.spacing2)
        tableView.allowsEmptySelection = false

        let column = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("ApiColumn"))
        column.resizingMask = .autoresizingMask
        tableView.addTableColumn(column)
        listScrollView.documentView = tableView
        view.addSubview(listScrollView)

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
        instancePopup.appearance = NSAppearance(named: .darkAqua)
        instancePopup.setContentHuggingPriority(.defaultLow, for: .horizontal)

        refreshInstancesButton.target = self
        refreshInstancesButton.wantsLayer = true
        refreshInstancesButton.isBordered = false
        refreshInstancesButton.layer?.backgroundColor = DSV2.surfaceContainerHigh.cgColor
        refreshInstancesButton.layer?.cornerRadius = DSV2.radiusButton
        refreshInstancesButton.layer?.borderWidth = 1
        refreshInstancesButton.layer?.borderColor = DSV2.outlineVariant.withAlphaComponent(0.35).cgColor
        updateRefreshButtonSymbol("↻", isRefreshing: false)
        refreshInstancesButton.translatesAutoresizingMaskIntoConstraints = false
        refreshInstancesButton.widthAnchor.constraint(equalToConstant: 32).isActive = true
        refreshInstancesButton.heightAnchor.constraint(equalToConstant: 32).isActive = true

        let instanceRow = NSStackView(views: [instanceLabel, instancePopup, refreshInstancesButton, NSView()])
        instanceRow.orientation = .horizontal
        instanceRow.spacing = 8
        instanceRow.alignment = .centerY
        instanceRow.translatesAutoresizingMaskIntoConstraints = false

        // 2. Documentation Container with ScrollView
        let detailScrollView = NSScrollView()
        detailScrollView.hasVerticalScroller = true
        detailScrollView.hasHorizontalScroller = false
        detailScrollView.drawsBackground = false
        detailScrollView.borderType = .noBorder
        detailScrollView.translatesAutoresizingMaskIntoConstraints = false
        detailScrollView.wantsLayer = true
        detailScrollView.layer?.backgroundColor = DSV2.surfaceContainerLowest.cgColor
        detailScrollView.layer?.cornerRadius = DSV2.radiusCard
        detailScrollView.layer?.borderWidth = 1
        detailScrollView.layer?.borderColor = DSV2.outlineVariant.withAlphaComponent(0.1).cgColor
        DSV2.applyBrightScroller(to: detailScrollView)

        detailTextView = NSTextView()
        detailTextView.isEditable = false
        detailTextView.isSelectable = true
        detailTextView.drawsBackground = false
        detailTextView.font = DSV2.fontMonoMd
        detailTextView.textColor = DSV2.tertiary
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
            headerStack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: DSV2.spacing6),

            listScrollView.topAnchor.constraint(equalTo: headerStack.bottomAnchor, constant: DSV2.spacing6),
            listScrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: DSV2.spacing6),
            listScrollView.widthAnchor.constraint(equalToConstant: 220),
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
        tableView.rowHeight = 68
        tableView.headerView = nil
        tableView.selectionHighlightStyle = .none
        tableView.backgroundColor = .clear

        selectDefaultRow()
    }




    private func makeSectionHeader(_ title: String) -> NSTextField {
        let label = NSTextField(labelWithString: title)
        label.font = DSV2.fontTitleSm
        label.textColor = DSV2.onSurfaceVariant
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }

    /// 根据内容自动更新文本视图的高度约束，实现"撑开"效果

    /// 公开方法：强制选中第一行并显示详情，由 DetailViewController 触发
    func selectDefaultRow() {
        guard !docs.isEmpty else { return }
        
        DispatchQueue.main.async {
            self.tableView.selectRowIndexes(IndexSet(integer: 0), byExtendingSelection: false)
            self.refreshCardStyles() // 立即应用样式
            self.updateSelectedDetail()
        }
    }

    /// 强制刷新所有可见 API 卡片的选中/未选中样式，防止样色"粘滞"
    func refreshCardStyles() {
        let selectedRow = tableView.selectedRow
        for row in 0..<tableView.numberOfRows {
            if let cellView = tableView.view(atColumn: 0, row: row, makeIfNecessary: false) {
                let isNowSelected = row == selectedRow
                applyCardStyle(to: cellView, isSelected: isNowSelected)
            }
        }
    }

    /// 统一卡片样式应用逻辑
    private func applyCardStyle(to cell: NSView, isSelected: Bool) {
        cell.wantsLayer = true
        cell.layer?.cornerRadius = DSV2.radiusCard
        
        if isSelected {
            // 选中状态：4px 显眼蓝框
            cell.layer?.backgroundColor = DSV2.surfaceContainerHighest.cgColor
            cell.layer?.borderWidth = 4
            cell.layer?.borderColor = NSColor.systemBlue.cgColor
            cell.layer?.masksToBounds = false
        } else {
            // 未选中状态：还原窄灰边框
            cell.layer?.backgroundColor = DSV2.surfaceContainerHigh.cgColor
            cell.layer?.borderWidth = 1.0
            cell.layer?.borderColor = DSV2.outlineVariant.withAlphaComponent(0.15).cgColor
            cell.layer?.masksToBounds = true
        }
    }

    /// 按当前选中行更新详情
    func updateSelectedDetail() {
        let row = tableView.selectedRow
        guard row >= 0 && row < docs.count else { return }
        updateDetailView(with: docs[row])
    }
    
    func numberOfRows(in tableView: NSTableView) -> Int {
        return docs.count
    }
    
    func tableView(_ tableView: NSTableView, viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
        let identifier = NSUserInterfaceItemIdentifier("ApiCell")
        var cell = tableView.makeView(withIdentifier: identifier, owner: self) as? NSTableCellView

        if cell == nil {
            cell = NSTableCellView()
            cell?.identifier = identifier
            cell?.wantsLayer = true

            let nameLabel = PassthroughTextField(labelWithString: "")
            nameLabel.font = DSV2.fontTitleSm
            nameLabel.translatesAutoresizingMaskIntoConstraints = false
            nameLabel.tag = 101

            let summaryLabel = PassthroughTextField(wrappingLabelWithString: "")
            summaryLabel.font = DSV2.fontBodySm
            summaryLabel.textColor = DSV2.onSurfaceVariant
            summaryLabel.translatesAutoresizingMaskIntoConstraints = false
            summaryLabel.tag = 102

            let methodLabel = PassthroughTextField(labelWithString: "")
            methodLabel.font = DSV2.fontLabelSm
            methodLabel.alignment = .center
            methodLabel.wantsLayer = true
            methodLabel.layer?.cornerRadius = DSV2.radiusInput
            methodLabel.translatesAutoresizingMaskIntoConstraints = false
            methodLabel.tag = 103

            cell?.addSubview(nameLabel)
            cell?.addSubview(summaryLabel)
            cell?.addSubview(methodLabel)

            NSLayoutConstraint.activate([
                methodLabel.topAnchor.constraint(equalTo: cell!.topAnchor, constant: 10),
                methodLabel.leadingAnchor.constraint(equalTo: cell!.leadingAnchor, constant: 8),
                methodLabel.widthAnchor.constraint(equalToConstant: 42),
                methodLabel.heightAnchor.constraint(equalToConstant: 16),

                nameLabel.centerYAnchor.constraint(equalTo: methodLabel.centerYAnchor),
                nameLabel.leadingAnchor.constraint(equalTo: methodLabel.trailingAnchor, constant: 8),
                nameLabel.trailingAnchor.constraint(equalTo: cell!.trailingAnchor, constant: -8),

                summaryLabel.topAnchor.constraint(equalTo: nameLabel.bottomAnchor, constant: 4),
                summaryLabel.leadingAnchor.constraint(equalTo: cell!.leadingAnchor, constant: 8),
                summaryLabel.trailingAnchor.constraint(equalTo: cell!.trailingAnchor, constant: -8),
                summaryLabel.bottomAnchor.constraint(lessThanOrEqualTo: cell!.bottomAnchor, constant: -10)
            ])
        }

        let doc = docs[row]
        let isSelected = tableView.selectedRow == row
        
        // 使用统一的样式应用逻辑
        applyCardStyle(to: cell!, isSelected: isSelected)

        if let methodLabel = cell?.viewWithTag(103) as? NSTextField {
            methodLabel.stringValue = doc.method.uppercased()
            let color = methodColor(doc.method)
            methodLabel.textColor = .white
            methodLabel.backgroundColor = color
            methodLabel.drawsBackground = true
        }

        if let nameLabel = cell?.viewWithTag(101) as? NSTextField {
            nameLabel.stringValue = doc.name
            nameLabel.textColor = isSelected ? DSV2.primary : DSV2.onSurface
        }

        if let summaryLabel = cell?.viewWithTag(102) as? NSTextField {
            summaryLabel.stringValue = doc.summary
            summaryLabel.textColor = isSelected ? DSV2.primary.withAlphaComponent(0.8) : DSV2.onSurfaceVariant
        }

        return cell
    }
    
    func tableViewSelectionDidChange(_ notification: Notification) {
        refreshCardStyles() // 关键：每当选中项变更，立即刷新所有可见 Cell 的 Layer 样式

        let row = tableView.selectedRow

        guard row >= 0 && row < docs.count else {
            updateDetailView(with: nil)
            return
        }
        updateDetailView(with: docs[row])

        // 选中新 API 时，将整个区域滚动到最顶部
        mainRightScrollView?.contentView.scrollToVisible(NSRect.zero)
    }

    private func updateDetailView(with doc: ApiDoc?) {
        guard let textView = detailTextView else {
            return
        }

        guard let doc = doc else {
            textView.string = "Select an API from the left sidebar to view details."
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
            string: "\(doc.name)\n",
            attributes: [
                .font: NSFont.systemFont(ofSize: 20, weight: .bold),
                .foregroundColor: DSV2.onSurface,
                .paragraphStyle: titleParagraphStyle
            ]
        ))

        // 2. HTTP 方法和路径
        attrStr.append(NSAttributedString(
            string: "\(doc.method) ",
            attributes: [
                .font: NSFont.monospacedSystemFont(ofSize: 13, weight: .semibold),
                .foregroundColor: methodColor(doc.method)
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
            string: "SUMMARY\n",
            attributes: [
                .font: NSFont.systemFont(ofSize: 13, weight: .semibold),
                .foregroundColor: DSV2.onSurface,
                .paragraphStyle: headingParagraphStyle
            ]
        ))
        attrStr.append(NSAttributedString(
            string: "\(doc.summary)\n",
            attributes: [
                .font: NSFont.systemFont(ofSize: 13, weight: .regular),
                .foregroundColor: DSV2.onSurface,
                .paragraphStyle: bodyParagraphStyle
            ]
        ))

        // 4. DESCRIPTION（详细描述）
        attrStr.append(NSAttributedString(
            string: "DESCRIPTION\n",
            attributes: [
                .font: NSFont.systemFont(ofSize: 13, weight: .semibold),
                .foregroundColor: DSV2.onSurface,
                .paragraphStyle: headingParagraphStyle
            ]
        ))
        attrStr.append(NSAttributedString(
            string: "\(doc.description)\n",
            attributes: [
                .font: NSFont.systemFont(ofSize: 13, weight: .regular),
                .foregroundColor: DSV2.onSurfaceVariant,
                .paragraphStyle: bodyParagraphStyle
            ]
        ))

        // 5. REQUEST BODY（如果有）
        if let body = doc.body {
            attrStr.append(NSAttributedString(
                string: "REQUEST BODY\n",
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
            string: "cURL EXAMPLE\n",
            attributes: [
                .font: NSFont.systemFont(ofSize: 13, weight: .semibold),
                .foregroundColor: DSV2.onSurface,
                .paragraphStyle: headingParagraphStyle
            ]
        ))
        attrStr.append(NSAttributedString(
            string: "\(doc.curl)\n",
            attributes: [
                .font: NSFont.monospacedSystemFont(ofSize: 12, weight: .regular),
                .foregroundColor: DSV2.tertiary,
                .paragraphStyle: codeParagraphStyle
            ]
        ))

        // 7. RESPONSE FORMAT
        attrStr.append(NSAttributedString(
            string: "RESPONSE FORMAT\n",
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
                .foregroundColor: DSV2.tertiary,
                .paragraphStyle: codeParagraphStyle
            ]
        ))

        textView.textStorage?.setAttributedString(attrStr)
        textView.scrollToBeginningOfDocument(nil)
    }
    
    private func methodColor(_ method: String) -> NSColor {
        switch method.uppercased() {
        case "GET": return DSV2.secondary
        case "POST": return DSV2.tertiary
        case "PUT": return DSV2.primary
        case "DELETE": return DSV2.error
        default: return DSV2.onSurfaceVariant
        }
    }
}
