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
    private var resultTextView: NSTextView!
    private let interactiveAreaContainer = NSStackView()
    private let tableView = NSTableView()
    private let headerImageView = NSImageView()
    private let headerTitleLabel = NSTextField(labelWithString: "TweetClaw")
    private var detailTextView: NSTextView!
    private var mainRightScrollView: NSScrollView!
    
    // 高度约束，用于让文本视图在 StackView 中“撑开”
    private var detailHeightConstraint: NSLayoutConstraint?
    private var resultHeightConstraint: NSLayoutConstraint?

    // Shared Interactive Components
    private let commonIdField = InsetTextField()
    private let commonPathField = InsetTextField()
    private let commonCursorField = InsetTextField()
    private let contentEditor = NSTextView()
    private let contentScrollView = NSScrollView()
    private let actionButton = NSButton(title: "Run API", target: nil, action: #selector(actionButtonClicked))
    private let previousPageButton = NSButton(title: "Previous Page", target: nil, action: #selector(previousPageClicked))
    private let nextPageButton = NSButton(title: "Next Page", target: nil, action: #selector(nextPageClicked))
    private let cursorStatusLabel = NSTextField(labelWithString: "")
    private var latestRepliesNextCursor: String?
    private var latestRepliesPreviousCursor: String?
    private var lastRepliesPaginationDirection: String = "none"


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

    private struct RepliesCursorEnvelope: Decodable {
        struct CursorPayload: Decodable {
            let next: String?
            let previous: String?
        }

        struct DataPayload: Decodable {
            let cursor: CursorPayload?
        }

        let cursor: CursorPayload?
        let data: DataPayload?
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
        
        NotificationCenter.default.addObserver(self, selector: #selector(displayResult(_:)), name: NSNotification.Name("QueryXTabsStatusReceived"), object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(displayResult(_:)), name: NSNotification.Name("QueryXBasicInfoReceived"), object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(displayResult(_:)), name: NSNotification.Name("OpenTabReceived"), object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(displayResult(_:)), name: NSNotification.Name("CloseTabReceived"), object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(displayResult(_:)), name: NSNotification.Name("NavigateTabReceived"), object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(displayResult(_:)), name: NSNotification.Name("ExecActionReceived"), object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(displayResult(_:)), name: NSNotification.Name("GetAPIDocsReceived"), object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(displayResult(_:)), name: NSNotification.Name("GetInstancesReceived"), object: nil)

        loadInstances()
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
        actionButton.target = self
        previousPageButton.target = self
        nextPageButton.target = self

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

        // --- Right Column: Interactive & Documentation ---
        
        // 1. Instance Row (Move to Top as requested)
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

        // 2. Documentation Container
        let detailContainer = DSV2.makeGhostBorderView()
        detailContainer.layer?.backgroundColor = DSV2.surfaceContainerLowest.cgColor
        
        detailTextView = NSTextView()
        detailTextView.isEditable = false
        detailTextView.isSelectable = true
        detailTextView.drawsBackground = false // 背景由容器提供
        detailTextView.font = DSV2.fontMonoMd
        detailTextView.textColor = DSV2.tertiary
        detailTextView.textContainerInset = NSSize(width: DSV2.spacing4, height: DSV2.spacing4)
        detailTextView.isVerticallyResizable = true
        detailTextView.autoresizingMask = [.width]
        
        detailContainer.addSubview(detailTextView)
        detailTextView.translatesAutoresizingMaskIntoConstraints = false
        
        NSLayoutConstraint.activate([
            detailTextView.topAnchor.constraint(equalTo: detailContainer.topAnchor),
            detailTextView.leadingAnchor.constraint(equalTo: detailContainer.leadingAnchor),
            detailTextView.trailingAnchor.constraint(equalTo: detailContainer.trailingAnchor),
            detailTextView.bottomAnchor.constraint(equalTo: detailContainer.bottomAnchor),
            detailContainer.heightAnchor.constraint(greaterThanOrEqualToConstant: 100)
        ])
        
        detailHeightConstraint = detailTextView.heightAnchor.constraint(equalToConstant: 100)
        detailHeightConstraint?.isActive = true

        // 3. Interactive Area Container
        interactiveAreaContainer.orientation = .vertical
        interactiveAreaContainer.alignment = .centerX
        interactiveAreaContainer.spacing = DSV2.spacing4
        interactiveAreaContainer.translatesAutoresizingMaskIntoConstraints = false

        // 4. Result View (Terminal) Container
        let resultContainer = DSV2.makeGhostBorderView()
        resultContainer.layer?.backgroundColor = DSV2.surfaceContainerLowest.cgColor
        
        resultTextView = NSTextView()
        resultTextView.isEditable = false
        resultTextView.isSelectable = true
        resultTextView.drawsBackground = false
        resultTextView.font = DSV2.fontMonoMd
        resultTextView.textColor = DSV2.tertiary
        resultTextView.textContainerInset = NSSize(width: DSV2.spacing4, height: DSV2.spacing4)
        resultTextView.isVerticallyResizable = true
        resultTextView.autoresizingMask = [.width]
        
        resultContainer.addSubview(resultTextView)
        resultTextView.translatesAutoresizingMaskIntoConstraints = false
        
        NSLayoutConstraint.activate([
            resultTextView.topAnchor.constraint(equalTo: resultContainer.topAnchor),
            resultTextView.leadingAnchor.constraint(equalTo: resultContainer.leadingAnchor),
            resultTextView.trailingAnchor.constraint(equalTo: resultContainer.trailingAnchor),
            resultTextView.bottomAnchor.constraint(equalTo: resultContainer.bottomAnchor),
            resultContainer.heightAnchor.constraint(greaterThanOrEqualToConstant: 100)
        ])

        resultHeightConstraint = resultTextView.heightAnchor.constraint(equalToConstant: 100)
        resultHeightConstraint?.isActive = true

        // 5. Main Right Column ScrollView (The Master Container)
        mainRightScrollView = NSScrollView()
        mainRightScrollView.drawsBackground = false
        mainRightScrollView.hasVerticalScroller = true
        mainRightScrollView.hasHorizontalScroller = false
        mainRightScrollView.translatesAutoresizingMaskIntoConstraints = false
        DSV2.applyBrightScroller(to: mainRightScrollView)

        let rightContentContainer = NSView()
        rightContentContainer.translatesAutoresizingMaskIntoConstraints = false
        mainRightScrollView.documentView = rightContentContainer

        // 6. Right Stack Assembly (Scrollable area)
        // 添加弹性空间实现垂直居中
        let topSpacer = NSView()
        topSpacer.translatesAutoresizingMaskIntoConstraints = false
        let bottomSpacer = NSView()
        bottomSpacer.translatesAutoresizingMaskIntoConstraints = false

        let centeredInteractiveStack = NSStackView(views: [
            topSpacer,
            interactiveAreaContainer,
            bottomSpacer
        ])
        centeredInteractiveStack.orientation = .vertical
        centeredInteractiveStack.distribution = .equalSpacing
        centeredInteractiveStack.translatesAutoresizingMaskIntoConstraints = false

        let rightStack = NSStackView(views: [
            detailContainer,
            centeredInteractiveStack,
            resultContainer
        ])
        rightStack.orientation = .vertical
        rightStack.alignment = .leading
        rightStack.spacing = DSV2.spacing6
        rightStack.edgeInsets = NSEdgeInsets(top: 0, left: 0, bottom: DSV2.spacing8, right: 0) // 给底部留出呼吸空间
        rightStack.translatesAutoresizingMaskIntoConstraints = false
        
        rightContentContainer.addSubview(rightStack)
        
        // 7. Outer Container for Fixed Header + Scrollable Area
        let rightColumnOuterStack = NSStackView(views: [
            instanceRow,
            mainRightScrollView
        ])
        rightColumnOuterStack.orientation = .vertical
        rightColumnOuterStack.alignment = .leading
        rightColumnOuterStack.spacing = DSV2.spacing4
        rightColumnOuterStack.translatesAutoresizingMaskIntoConstraints = false
        
        view.addSubview(rightColumnOuterStack)

        // Styling Shared Components
        styleInputField(commonIdField)
        styleInputField(commonPathField)
        styleInputField(commonCursorField)
        styleTextView(contentEditor, scrollView: contentScrollView)
        contentScrollView.heightAnchor.constraint(equalToConstant: 200).isActive = true
        styleButton(actionButton)
        styleButton(previousPageButton)
        styleButton(nextPageButton)
        actionButton.widthAnchor.constraint(equalToConstant: 120).isActive = true
        actionButton.heightAnchor.constraint(equalToConstant: 36).isActive = true
        actionButton.contentTintColor = .white
        actionButton.layer?.backgroundColor = DSV2.primary.cgColor
        actionButton.target = self
        previousPageButton.widthAnchor.constraint(equalToConstant: 140).isActive = true
        previousPageButton.heightAnchor.constraint(equalToConstant: 36).isActive = true
        previousPageButton.contentTintColor = .white
        previousPageButton.layer?.backgroundColor = DSV2.secondary.cgColor
        previousPageButton.target = self
        nextPageButton.widthAnchor.constraint(equalToConstant: 140).isActive = true
        nextPageButton.heightAnchor.constraint(equalToConstant: 36).isActive = true
        nextPageButton.contentTintColor = .white
        nextPageButton.layer?.backgroundColor = DSV2.secondary.cgColor
        nextPageButton.target = self
        cursorStatusLabel.font = DSV2.fontMonoSm
        cursorStatusLabel.textColor = DSV2.onSurfaceVariant
        cursorStatusLabel.alignment = .center
        cursorStatusLabel.maximumNumberOfLines = 2
        cursorStatusLabel.lineBreakMode = .byTruncatingMiddle

        headerImageView.contentTintColor = DSV2.primary

        NSLayoutConstraint.activate([
            headerStack.topAnchor.constraint(equalTo: view.topAnchor, constant: DSV2.spacing6),
            headerStack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: DSV2.spacing6),

            listScrollView.topAnchor.constraint(equalTo: headerStack.bottomAnchor, constant: DSV2.spacing6),
            listScrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: DSV2.spacing6),
            listScrollView.widthAnchor.constraint(equalToConstant: 220),
            listScrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -DSV2.spacing6),

            rightStack.topAnchor.constraint(equalTo: rightContentContainer.topAnchor),
            rightStack.leadingAnchor.constraint(equalTo: rightContentContainer.leadingAnchor),
            rightStack.trailingAnchor.constraint(equalTo: rightContentContainer.trailingAnchor),
            rightStack.bottomAnchor.constraint(equalTo: rightContentContainer.bottomAnchor),
            rightStack.widthAnchor.constraint(equalTo: mainRightScrollView.contentView.widthAnchor),

            // Outer Stack Constraints
            rightColumnOuterStack.topAnchor.constraint(equalTo: listScrollView.topAnchor),
            rightColumnOuterStack.leadingAnchor.constraint(equalTo: listScrollView.trailingAnchor, constant: DSV2.spacing4),
            rightColumnOuterStack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -DSV2.spacing6),
            rightColumnOuterStack.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -DSV2.spacing6),
            
            instanceRow.widthAnchor.constraint(equalTo: rightColumnOuterStack.widthAnchor),
            mainRightScrollView.widthAnchor.constraint(equalTo: rightColumnOuterStack.widthAnchor)
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

    private func styleInputField(_ field: NSTextField) {
        field.wantsLayer = true
        field.isBezeled = false
        field.isBordered = false
        field.drawsBackground = true
        field.backgroundColor = DSV2.surfaceContainerHighest
        field.textColor = DSV2.onSurface
        field.font = DSV2.fontMonoMd
        field.alignment = .left
        field.translatesAutoresizingMaskIntoConstraints = false
        field.layer?.borderWidth = 1
        field.layer?.borderColor = DSV2.outlineVariant.withAlphaComponent(0.28).cgColor
        field.layer?.cornerRadius = DSV2.radiusInput
        field.heightAnchor.constraint(equalToConstant: 36).isActive = true
        field.focusRingType = .none
        field.isEditable = true
        field.isSelectable = true
        field.maximumNumberOfLines = 1
        field.lineBreakMode = .byClipping
    }

    private func styleButton(_ button: NSButton) {
        button.wantsLayer = true
        button.isBordered = false
        button.layer?.backgroundColor = DSV2.surfaceContainerHighest.cgColor
        button.layer?.cornerRadius = DSV2.radiusButton
        button.layer?.borderWidth = 1
        button.layer?.borderColor = DSV2.outlineVariant.withAlphaComponent(0.3).cgColor
        button.contentTintColor = DSV2.onSurface
        button.font = DSV2.fontLabelMd
        button.translatesAutoresizingMaskIntoConstraints = false
    }

    private func styleTextView(_ textView: NSTextView, scrollView: NSScrollView) {
        scrollView.documentView = textView
        scrollView.hasVerticalScroller = true
        scrollView.wantsLayer = true
        scrollView.layer?.cornerRadius = DSV2.radiusInput
        scrollView.layer?.borderWidth = 1
        scrollView.layer?.borderColor = DSV2.outlineVariant.withAlphaComponent(0.15).cgColor
        scrollView.layer?.backgroundColor = DSV2.surface.cgColor
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        textView.font = DSV2.fontBodyMd
        textView.textColor = DSV2.onSurface
        textView.backgroundColor = DSV2.surface
        textView.isRichText = false
        textView.textContainerInset = NSSize(width: DSV2.spacing2, height: DSV2.spacing2)
    }

    private func makeSectionHeader(_ title: String) -> NSTextField {
        let label = NSTextField(labelWithString: title)
        label.font = DSV2.fontTitleSm
        label.textColor = DSV2.onSurfaceVariant
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }

    /// 根据内容自动更新文本视图的高度约束，实现“撑开”效果
    private func updateTextViewHeight(_ textView: NSTextView?, constraint: NSLayoutConstraint?) {
        guard let textView = textView, let constraint = constraint else { return }
        
        // 强制 LayoutManager 计算布局
        if let layoutManager = textView.layoutManager, let textContainer = textView.textContainer {
            layoutManager.ensureLayout(for: textContainer)
            let usedRect = layoutManager.usedRect(for: textContainer)
            let newHeight = max(100, usedRect.height + textView.textContainerInset.height * 2)
            
            // 更新约束
            constraint.constant = newHeight
        }
    }

    @objc private func displayResult(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let jsonString = userInfo["dataString"] as? String else { return }
        DispatchQueue.main.async {
            let title = userInfo["resultTitle"] as? String ?? notification.name.rawValue
            print("[LocalBridgeMac] displayResult source=\(title) selectedApi=\(self.selectedApiID() ?? "<nil>") payloadChars=\(jsonString.count)")
            self.resultTextView?.string = jsonString
            self.cacheRepliesCursorsIfNeeded(from: jsonString)
            
            // 立即计算并撑开高度
            self.updateTextViewHeight(self.resultTextView, constraint: self.resultHeightConstraint)
            
            self.resultTextView?.scrollToEndOfDocument(nil)
            
            // 同时滚动主视图到底部，以便看到最新日志
            if let documentView = self.mainRightScrollView.documentView {
                let bottomRect = NSRect(x: 0, y: documentView.frame.height - 1, width: 1, height: 1)
                documentView.scrollToVisible(bottomRect)
            }
        }
    }

    /// 公开方法：强制选中第一行并显示详情，由 DetailViewController 触发
    func selectDefaultRow() {
        guard !docs.isEmpty else { return }
        
        DispatchQueue.main.async {
            self.tableView.selectRowIndexes(IndexSet(integer: 0), byExtendingSelection: false)
            self.refreshCardStyles() // 立即应用样式
            self.updateSelectedDetail()
        }
    }

    /// 强制刷新所有可见 API 卡片的选中/未选中样式，防止样色“粘滞”
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
        resultTextView?.string = "" // 安全检查：切换 API 时清空之前的执行结果
        updateTextViewHeight(resultTextView, constraint: resultHeightConstraint) // 立即重置高度
        
        guard row >= 0 && row < docs.count else {
            updateDetailView(with: nil)
            return
        }
        updateDetailView(with: docs[row])
        
        // 选中新 API 时，将整个区域滚动到最顶部
        mainRightScrollView?.contentView.scrollToVisible(NSRect.zero)
    }
    
    private func updateDetailView(with doc: ApiDoc?) {
        guard let textView = detailTextView else { return }
        
        guard let doc = doc else {
            textView.string = "Select an API from the left sidebar to view details."
            updateTextViewHeight(textView, constraint: detailHeightConstraint) // 重置文档区高度
            interactiveAreaContainer.arrangedSubviews.forEach { $0.removeFromSuperview() }
            return
        }
        
        let attrStr = NSMutableAttributedString()
        // Documentation Rendering (Title, Method, Description, etc.)
        attrStr.append(NSAttributedString(string: "\(doc.name)\n", attributes: [.font: DSV2.fontDisplaySm, .foregroundColor: DSV2.onSurface]))
        attrStr.append(NSAttributedString(string: "\(doc.method) ", attributes: [.font: DSV2.fontMonoMd, .foregroundColor: methodColor(doc.method)]))
        attrStr.append(NSAttributedString(string: "\(doc.path)\n\n", attributes: [.font: DSV2.fontMonoMd, .foregroundColor: DSV2.onSurfaceVariant]))
        attrStr.append(NSAttributedString(string: "DESCRIPTION\n", attributes: [.font: DSV2.fontTitleMd, .foregroundColor: DSV2.onSurface]))
        attrStr.append(NSAttributedString(string: "\(doc.description)\n\n", attributes: [.font: DSV2.fontBodyMd, .foregroundColor: DSV2.onSurface]))

        if let body = doc.body {
            attrStr.append(NSAttributedString(string: "REQUEST BODY (JSON)\n", attributes: [.font: DSV2.fontTitleMd, .foregroundColor: DSV2.onSurface]))
            attrStr.append(NSAttributedString(string: "\(body)\n\n", attributes: [.font: DSV2.fontMonoSm, .foregroundColor: DSV2.tertiary]))
        }
        attrStr.append(NSAttributedString(string: "cURL EXAMPLE\n", attributes: [.font: DSV2.fontTitleMd, .foregroundColor: DSV2.onSurface]))
        attrStr.append(NSAttributedString(string: "\(doc.curl)\n\n", attributes: [.font: DSV2.fontMonoSm, .foregroundColor: DSV2.tertiary]))
        attrStr.append(NSAttributedString(string: "RESPONSE FORMAT\n", attributes: [.font: DSV2.fontTitleMd, .foregroundColor: DSV2.tertiary]))
        attrStr.append(NSAttributedString(string: "\(doc.response)\n", attributes: [.font: DSV2.fontMonoSm, .foregroundColor: DSV2.tertiary]))
        
        let style = NSMutableParagraphStyle()
        style.lineSpacing = 4; style.paragraphSpacing = 8
        attrStr.addAttribute(.paragraphStyle, value: style, range: NSRange(location: 0, length: attrStr.length))
        textView.textStorage?.setAttributedString(attrStr)
        
        // 立即计算并撑开文档区域高度
        updateTextViewHeight(detailTextView, constraint: detailHeightConstraint)
        
        textView.scrollToBeginningOfDocument(nil)

        // Update Interactive Area
        updateInteractiveArea(for: doc)
    }
    
    private func updateInteractiveArea(for doc: ApiDoc) {
        interactiveAreaContainer.arrangedSubviews.forEach { $0.removeFromSuperview() }
        resetInteractiveInputs()
        
        var inputs: [NSView] = []
        
        switch doc.id {
        case "get_api_docs":
            actionButton.title = "Get API Docs"
        case "query_x_status":
            actionButton.title = "Refresh Status"
        case "get_instances":
            actionButton.title = "Get Instances"
        case "query_x_basic_info":
            actionButton.title = "Get Basic Info"
        case "query_home_timeline":
            actionButton.title = "Get Home Timeline"
        case "query_search_results":
            actionButton.title = "Get Search Results"
        case "open_tab":
            commonPathField.placeholderString = "Enter path (e.g. home) or URL"
            inputs.append(makeInputRow("Path:", commonPathField))
            actionButton.title = "Open Tab"
        case "close_tab":
            commonIdField.placeholderString = "Enter Tab ID"
            inputs.append(makeInputRow("Tab ID:", commonIdField))
            actionButton.title = "Close Tab"
        case "navigate_tab":
            commonIdField.placeholderString = "Tab ID (Optional)"
            commonPathField.placeholderString = "Enter path (e.g. elonmusk)"
            inputs.append(makeInputRow("Tab ID:", commonIdField))
            inputs.append(makeInputRow("Path:", commonPathField))
            actionButton.title = "Navigate"
        case "like_tweet", "unlike_tweet", "retweet_tweet", "unretweet_tweet", "bookmark_tweet", "unbookmark_tweet", "delete_tweet":
            commonIdField.placeholderString = "Enter Tweet ID"
            inputs.append(makeInputRow("Tweet ID:", commonIdField))
            actionButton.title = doc.name
        case "follow_user", "unfollow_user":
            commonIdField.placeholderString = "Enter User ID"
            inputs.append(makeInputRow("User ID:", commonIdField))
            actionButton.title = doc.name
        case "create_tweet":
            inputs.append(makeSectionHeader("Tweet Content:"))
            contentScrollView.widthAnchor.constraint(equalToConstant: 450).isActive = true
            inputs.append(contentScrollView)
            actionButton.title = "Post Tweet"
        case "create_reply":
            commonIdField.placeholderString = "Enter Tweet ID to reply to"
            inputs.append(makeInputRow("Tweet ID:", commonIdField))
            inputs.append(makeSectionHeader("Reply Content:"))
            contentScrollView.widthAnchor.constraint(equalToConstant: 450).isActive = true
            inputs.append(contentScrollView)
            actionButton.title = "Post Reply"
        case "get_tweet", "query_tweet_detail_deprecated":
            commonIdField.placeholderString = "Enter Tweet ID"
            inputs.append(makeInputRow("Tweet ID:", commonIdField))
            actionButton.title = doc.id == "get_tweet" ? "Get Tweet" : "Get Detail"
        case "get_tweet_replies":
            commonIdField.placeholderString = "Enter Tweet ID"
            inputs.append(makeInputRow("Tweet ID:", commonIdField))
            inputs.append(makeRepliesPaginationControls())
            actionButton.title = "Get Replies"
        case "query_user_profile":
            commonIdField.placeholderString = "Enter @handle (e.g. elonmusk)"
            inputs.append(makeInputRow("Handle:", commonIdField))
            actionButton.title = "Get Profile"
        default:
            actionButton.title = "Run Request"
        }
        
        inputs.forEach { interactiveAreaContainer.addArrangedSubview($0) }
        interactiveAreaContainer.addArrangedSubview(actionButton)
        
        // Final styling for action button based on method
        if doc.method == "DELETE" {
            actionButton.contentTintColor = .white
            actionButton.layer?.backgroundColor = DSV2.error.cgColor
        } else {
            actionButton.contentTintColor = .white
            actionButton.layer?.backgroundColor = DSV2.primary.cgColor
        }
    }

    private func resetInteractiveInputs() {
        commonIdField.stringValue = ""
        commonIdField.placeholderString = nil
        commonPathField.stringValue = ""
        commonPathField.placeholderString = nil
        commonCursorField.stringValue = ""
        commonCursorField.placeholderString = nil
        contentEditor.string = ""
        updateRepliesPaginationControls()
    }
    
    private func makeInputRow(_ label: String, _ field: NSView) -> NSView {
        let labelField = NSTextField(labelWithString: label)
        labelField.font = DSV2.fontLabelSm
        labelField.textColor = DSV2.onSurfaceVariant
        labelField.widthAnchor.constraint(equalToConstant: 80).isActive = true

        let stack = NSStackView(views: [labelField, field])
        stack.orientation = .horizontal
        stack.spacing = 8
        stack.alignment = .centerY
        stack.distribution = .fill
        field.widthAnchor.constraint(equalToConstant: 450).isActive = true

        // 确保输入框在垂直方向上居中
        if let textField = field as? NSTextField {
            textField.setContentHuggingPriority(.defaultHigh, for: .vertical)
            textField.setContentCompressionResistancePriority(.defaultHigh, for: .vertical)
        }

        return stack
    }

    @objc private func actionButtonClicked() {
        let row = tableView.selectedRow
        guard row >= 0 && row < docs.count else { return }
        let doc = docs[row]
        let instanceId = selectedInstanceId()
        
        switch doc.id {
        case "get_api_docs":
            AppDelegate.shared?.fetchAPIDocs()
        case "query_x_status":
            AppDelegate.shared?.sendQueryXTabsStatus(instanceId: instanceId)
        case "get_instances":
            AppDelegate.shared?.fetchInstances()
        case "query_x_basic_info":
            AppDelegate.shared?.sendQueryXBasicInfo(instanceId: instanceId)
        case "open_tab":
            let path = commonPathField.stringValue.trimmingCharacters(in: .whitespaces)
            AppDelegate.shared?.sendOpenTab(path: path, instanceId: instanceId)
        case "close_tab":
            if let tabId = Int(commonIdField.stringValue.trimmingCharacters(in: .whitespaces)) {
                AppDelegate.shared?.sendCloseTab(tabId: tabId, instanceId: instanceId)
            }
        case "navigate_tab":
            let path = commonPathField.stringValue.trimmingCharacters(in: .whitespaces)
            let tabId = Int(commonIdField.stringValue.trimmingCharacters(in: .whitespaces))
            AppDelegate.shared?.sendNavigateTab(tabId: tabId, path: path, instanceId: instanceId)
        case "like_tweet":
            let tid = commonIdField.stringValue.trimmingCharacters(in: .whitespaces)
            AppDelegate.shared?.sendExecAction(action: "like", tweetId: tid, userId: nil, tabId: nil, instanceId: instanceId)
        case "unlike_tweet":
            let tid = commonIdField.stringValue.trimmingCharacters(in: .whitespaces)
            AppDelegate.shared?.sendExecAction(action: "unlike", tweetId: tid, userId: nil, tabId: nil, instanceId: instanceId)
        case "retweet_tweet":
            let tid = commonIdField.stringValue.trimmingCharacters(in: .whitespaces)
            AppDelegate.shared?.sendExecAction(action: "retweet", tweetId: tid, userId: nil, tabId: nil, instanceId: instanceId)
        case "unretweet_tweet":
            let tid = commonIdField.stringValue.trimmingCharacters(in: .whitespaces)
            AppDelegate.shared?.sendExecAction(action: "unretweet", tweetId: tid, userId: nil, tabId: nil, instanceId: instanceId)
        case "bookmark_tweet":
            let tid = commonIdField.stringValue.trimmingCharacters(in: .whitespaces)
            AppDelegate.shared?.sendExecAction(action: "bookmark", tweetId: tid, userId: nil, tabId: nil, instanceId: instanceId)
        case "unbookmark_tweet":
            let tid = commonIdField.stringValue.trimmingCharacters(in: .whitespaces)
            AppDelegate.shared?.sendExecAction(action: "unbookmark", tweetId: tid, userId: nil, tabId: nil, instanceId: instanceId)
        case "follow_user":
            let uid = commonIdField.stringValue.trimmingCharacters(in: .whitespaces)
            AppDelegate.shared?.sendExecAction(action: "follow", tweetId: nil, userId: uid, tabId: nil, instanceId: instanceId)
        case "unfollow_user":
            let uid = commonIdField.stringValue.trimmingCharacters(in: .whitespaces)
            AppDelegate.shared?.sendExecAction(action: "unfollow", tweetId: nil, userId: uid, tabId: nil, instanceId: instanceId)
        case "create_tweet":
            let txt = contentEditor.string.trimmingCharacters(in: .whitespacesAndNewlines)
            AppDelegate.shared?.sendExecAction(action: "createTweet", tweetId: nil, userId: nil, tabId: nil, text: txt, instanceId: instanceId)
        case "create_reply":
            let tid = commonIdField.stringValue.trimmingCharacters(in: .whitespaces)
            let txt = contentEditor.string.trimmingCharacters(in: .whitespacesAndNewlines)
            AppDelegate.shared?.sendExecAction(action: "createReply", tweetId: tid, userId: nil, tabId: nil, text: txt, instanceId: instanceId)
        case "delete_tweet":
            let tid = commonIdField.stringValue.trimmingCharacters(in: .whitespaces)
            AppDelegate.shared?.sendExecAction(action: "deleteTweet", tweetId: tid, userId: nil, tabId: nil, instanceId: instanceId)
        case "query_home_timeline":
            AppDelegate.shared?.sendQueryHomeTimeline(tabId: nil, instanceId: instanceId)
        case "get_tweet":
            let tid = commonIdField.stringValue.trimmingCharacters(in: .whitespaces)
            AppDelegate.shared?.sendQueryTweet(tweetId: tid, tabId: nil, instanceId: instanceId)
        case "get_tweet_replies":
            let tid = commonIdField.stringValue.trimmingCharacters(in: .whitespaces)
            lastRepliesPaginationDirection = "none" // 初始加载时重置方向
            AppDelegate.shared?.sendQueryTweetReplies(
                tweetId: tid,
                cursor: nil, // 初次获取禁止带有游标，完全依靠 API 生成第一页及后续双游标
                tabId: nil,
                instanceId: instanceId
            )
        case "query_tweet_detail", "query_tweet_detail_deprecated":
            let tid = commonIdField.stringValue.trimmingCharacters(in: .whitespaces)
            AppDelegate.shared?.sendQueryTweetDetail(tweetId: tid, tabId: nil, instanceId: instanceId)
        case "query_user_profile":
            let handle = commonIdField.stringValue.trimmingCharacters(in: .whitespaces)
            AppDelegate.shared?.sendQueryUserProfile(screenName: handle, tabId: nil, instanceId: instanceId)
        case "query_search_results":
            AppDelegate.shared?.sendQuerySearchTimeline(tabId: nil, instanceId: instanceId)
        default:
            print("Action not implemented for \(doc.id)")
        }
    }

    @objc private func previousPageClicked() {
        guard let cursor = latestRepliesPreviousCursor, !cursor.isEmpty else {
            print("[LocalBridgeMac] Previous Page ignored: previous cursor unavailable selectedApi=\(selectedApiID() ?? "<nil>")")
            return
        }
        print("[LocalBridgeMac] Previous Page clicked cursor=\(cursor)")
        lastRepliesPaginationDirection = "previous"
        triggerRepliesRequest(withCursor: cursor)
    }

    @objc private func nextPageClicked() {
        guard let cursor = latestRepliesNextCursor, !cursor.isEmpty else {
            print("[LocalBridgeMac] Next Page ignored: next cursor unavailable selectedApi=\(selectedApiID() ?? "<nil>")")
            return
        }
        print("[LocalBridgeMac] Next Page clicked cursor=\(cursor)")
        lastRepliesPaginationDirection = "next"
        triggerRepliesRequest(withCursor: cursor)
    }

    private func triggerRepliesRequest(withCursor cursor: String) {
        let instanceId = selectedInstanceId()
        let tid = commonIdField.stringValue.trimmingCharacters(in: .whitespaces)
        let selectedApi = selectedApiID() ?? "<nil>"
        guard !tid.isEmpty else {
            print("[LocalBridgeMac] triggerRepliesRequest aborted: tweetId empty selectedApi=\(selectedApi)")
            return
        }
        print("[LocalBridgeMac] triggerRepliesRequest tweetId=\(tid) cursor=\(cursor) instanceId=\(instanceId ?? "<nil>")")
        AppDelegate.shared?.sendQueryTweetReplies(
            tweetId: tid,
            cursor: cursor,
            tabId: nil,
            instanceId: instanceId
        )
    }

    private func makeRepliesPaginationControls() -> NSView {
        updateRepliesPaginationControls()
        let buttonsRow = NSStackView(views: [previousPageButton, nextPageButton])
        buttonsRow.orientation = .horizontal
        buttonsRow.spacing = 12
        buttonsRow.alignment = .centerY

        let container = NSStackView(views: [cursorStatusLabel, buttonsRow])
        container.orientation = .vertical
        container.spacing = 8
        container.alignment = .centerX
        return container
    }

    private func cacheRepliesCursorsIfNeeded(from jsonString: String) {
        let row = tableView.selectedRow
        guard row >= 0, row < docs.count else {
            print("[LocalBridgeMac] cacheRepliesCursors skipped: no selected row")
            return
        }
        let doc = docs[row]
        guard doc.id == "get_tweet_replies" else {
            print("[LocalBridgeMac] cacheRepliesCursors skipped: selectedApi=\(doc.id)")
            return
        }
        guard let data = jsonString.data(using: .utf8),
              let parsed = try? JSONDecoder().decode(RepliesCursorEnvelope.self, from: data) else {
            print("[LocalBridgeMac] cacheRepliesCursors decode failed selectedApi=\(doc.id) payloadPrefix=\(String(jsonString.prefix(240)))")
            return
        }

        let nextCursor = parsed.cursor?.next ?? parsed.data?.cursor?.next
        let previousCursor = parsed.cursor?.previous ?? parsed.data?.cursor?.previous
        
        if lastRepliesPaginationDirection == "none" {
            latestRepliesNextCursor = nextCursor
            latestRepliesPreviousCursor = previousCursor
        } else if lastRepliesPaginationDirection == "next" {
            latestRepliesNextCursor = nextCursor   // Only update next cursor
        } else if lastRepliesPaginationDirection == "previous" {
            latestRepliesPreviousCursor = previousCursor // Only update previous cursor
        }
        
        print("[LocalBridgeMac] cacheRepliesCursors updated next=\(latestRepliesNextCursor == nil ? "<nil>" : "yes") previous=\(latestRepliesPreviousCursor == nil ? "<nil>" : "yes") direction=\(lastRepliesPaginationDirection)")
        updateRepliesPaginationControls()
    }

    private func updateRepliesPaginationControls() {
        let hasPrevious = !(latestRepliesPreviousCursor ?? "").isEmpty
        let hasNext = !(latestRepliesNextCursor ?? "").isEmpty
        previousPageButton.isEnabled = hasPrevious
        nextPageButton.isEnabled = hasNext
        previousPageButton.alphaValue = hasPrevious ? 1.0 : 0.45
        nextPageButton.alphaValue = hasNext ? 1.0 : 0.45

        let previousText = hasPrevious ? "previous ready" : "previous empty"
        let nextText = hasNext ? "next ready" : "next empty"
        cursorStatusLabel.stringValue = "Cursor state: \(previousText) | \(nextText)"
        print("[LocalBridgeMac] updateRepliesPaginationControls previousEnabled=\(hasPrevious) nextEnabled=\(hasNext)")
    }

    private func selectedApiID() -> String? {
        let row = tableView.selectedRow
        guard row >= 0, row < docs.count else { return nil }
        return docs[row].id
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
