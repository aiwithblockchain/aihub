import AppKit

final class TweetClawHumanViewController: NSViewController {
    private let titleLabel = NSTextField(labelWithString: "TweetClaw - For Human")
    private let statusLabel = NSTextField(labelWithString: "交互式操作")
    private let queryButton = NSButton(title: "Query X Status (Immediate)", target: nil, action: #selector(queryXStatusClicked))
    private let queryBasicInfoButton = NSButton(title: "Query X Basic Info", target: nil, action: #selector(queryBasicInfoClicked))
    
    private let pathTextField = NSTextField()
    private let openTabButton = NSButton(title: "打开 x.com Tab", target: nil, action: #selector(openTabClicked))
    
    private let tabIdTextField = NSTextField()
    private let closeTabButton = NSButton(title: "关闭 Tab", target: nil, action: #selector(closeTabClicked))
    
    private let navTabIdTextField = NSTextField()
    private let navPathTextField = NSTextField()
    private let navigateButton = NSButton(title: "跳转到 URL", target: nil, action: #selector(navigateClicked))
    
    private let likeTweetIdTextField = NSTextField()
    private let likeButton = NSButton(title: "点赞 Tweet", target: nil, action: #selector(likeTweetClicked))
    
    private let retweetTweetIdTextField = NSTextField()
    private let retweetButton = NSButton(title: "转推 Tweet", target: nil, action: #selector(retweetClicked))
    
    private let bookmarkTweetIdTextField = NSTextField()
    private let bookmarkButton = NSButton(title: "收藏 Tweet", target: nil, action: #selector(bookmarkClicked))
    
    private let followUserIdTextField = NSTextField()
    private let followButton = NSButton(title: "关注用户", target: nil, action: #selector(followClicked))
    
    private let unfollowUserIdTextField = NSTextField()
    private let unfollowButton = NSButton(title: "取消关注", target: nil, action: #selector(unfollowClicked))

    // 实例选择器
    private let instanceLabel = NSTextField(labelWithString: "目标实例:")
    private let instancePopup = NSPopUpButton(frame: .zero, pullsDown: false)
    private let refreshInstancesButton = NSButton(title: "↻", target: nil, action: #selector(refreshInstancesClicked))
    private var instanceSnapshots: [LocalBridgeGoManager.InstanceSnapshot] = []
    
    private var resultTextView: NSTextView!
    private var resultScrollView: NSScrollView!
    
    override func loadView() {
        view = NSView()
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        
        NotificationCenter.default.addObserver(self, selector: #selector(handleQueryResult(_:)), name: NSNotification.Name("QueryXTabsStatusReceived"), object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(handleBasicInfoResult(_:)), name: NSNotification.Name("QueryXBasicInfoReceived"), object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(handleOpenTabResult(_:)), name: NSNotification.Name("OpenTabReceived"), object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(handleCloseTabResult(_:)), name: NSNotification.Name("CloseTabReceived"), object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(handleNavigateTabResult(_:)), name: NSNotification.Name("NavigateTabReceived"), object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(handleExecActionResult(_:)), name: NSNotification.Name("ExecActionReceived"), object: nil)

        loadInstances()
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    /// 从 AppDelegate 加载 tweetClaw 实例列表，更新下拉框
    private func loadInstances() {
        let all = AppDelegate.shared?.getConnectedInstances() ?? []
        instanceSnapshots = all.filter { $0.clientName == "tweetClaw" }

        instancePopup.removeAllItems()
        if instanceSnapshots.isEmpty {
            instancePopup.addItem(withTitle: "无可用实例（自动选择）")
        } else {
            for snap in instanceSnapshots {
                let idShort = String(snap.instanceId.prefix(8))
                let label = snap.isTemporary
                    ? "[\(idShort)...] (旧版)"
                    : "[\(idShort)...]"
                instancePopup.addItem(withTitle: label)
            }
        }
    }

    /// 获取当前选中的 instanceId（nil 表示不指定，由 resolveConnection 自动处理）
    private func selectedInstanceId() -> String? {
        guard !instanceSnapshots.isEmpty else { return nil }
        let idx = instancePopup.indexOfSelectedItem
        guard instanceSnapshots.indices.contains(idx) else { return nil }
        return instanceSnapshots[idx].instanceId
    }

    @objc private func refreshInstancesClicked() {
        loadInstances()
    }
    
    private func setupUI() {
        titleLabel.font = .systemFont(ofSize: 20, weight: .bold)
        queryButton.bezelStyle = .rounded
        queryButton.target = self
        
        queryBasicInfoButton.bezelStyle = .rounded
        queryBasicInfoButton.target = self
        
        pathTextField.placeholderString = "输入路径，如 home"
        pathTextField.stringValue = "home"
        openTabButton.bezelStyle = .rounded
        openTabButton.target = self
        
        tabIdTextField.placeholderString = "输入 Tab ID"
        closeTabButton.bezelStyle = .rounded
        closeTabButton.target = self
        
        navTabIdTextField.placeholderString = "Tab ID"
        navTabIdTextField.translatesAutoresizingMaskIntoConstraints = false
        navTabIdTextField.widthAnchor.constraint(equalToConstant: 80).isActive = true
        
        navPathTextField.placeholderString = "路径 (如: home)"
        navPathTextField.stringValue = "home"
        
        navigateButton.title = "跳转到 ->"
        navigateButton.bezelStyle = .rounded
        navigateButton.target = self
        
        // Setup result text view
        resultScrollView = NSTextView.scrollableTextView()
        resultTextView = resultScrollView.documentView as? NSTextView
        
        resultTextView.isEditable = false
        resultTextView.isSelectable = true
        resultTextView.font = .monospacedSystemFont(ofSize: 13, weight: .regular)
        resultTextView.textContainerInset = NSSize(width: 8, height: 8)
        
        resultScrollView.borderType = .bezelBorder
        resultScrollView.translatesAutoresizingMaskIntoConstraints = false
        
        let openTabStack = NSStackView(views: [pathTextField, openTabButton])
        openTabStack.orientation = .horizontal
        openTabStack.spacing = 8
        
        let closeTabStack = NSStackView(views: [tabIdTextField, closeTabButton])
        closeTabStack.orientation = .horizontal
        closeTabStack.spacing = 8
        
        let navigateStack = NSStackView(views: [
            NSTextField(labelWithString: "Tab:"),
            navTabIdTextField,
            navigateButton,
            navPathTextField
        ])
        navigateStack.orientation = .horizontal
        navigateStack.spacing = 8
        navigateStack.alignment = .centerY
        
        likeTweetIdTextField.placeholderString = "Tweet ID"
        likeButton.bezelStyle = .rounded
        likeButton.target = self
        let likeStack = NSStackView(views: [likeTweetIdTextField, likeButton])
        likeStack.orientation = .horizontal
        likeStack.spacing = 8
        
        retweetTweetIdTextField.placeholderString = "Tweet ID"
        retweetButton.bezelStyle = .rounded
        retweetButton.target = self
        let retweetStack = NSStackView(views: [retweetTweetIdTextField, retweetButton])
        retweetStack.orientation = .horizontal
        retweetStack.spacing = 8
        
        bookmarkTweetIdTextField.placeholderString = "Tweet ID"
        bookmarkButton.bezelStyle = .rounded
        bookmarkButton.target = self
        let bookmarkStack = NSStackView(views: [bookmarkTweetIdTextField, bookmarkButton])
        bookmarkStack.orientation = .horizontal
        bookmarkStack.spacing = 8
        
        followUserIdTextField.placeholderString = "User ID"
        followButton.bezelStyle = .rounded
        followButton.target = self
        let followStack = NSStackView(views: [followUserIdTextField, followButton])
        followStack.orientation = .horizontal
        followStack.spacing = 8
        
        unfollowUserIdTextField.placeholderString = "User ID"
        unfollowButton.bezelStyle = .rounded
        unfollowButton.target = self
        let unfollowStack = NSStackView(views: [unfollowUserIdTextField, unfollowButton])
        unfollowStack.orientation = .horizontal
        unfollowStack.spacing = 8
        
        // 实例选择器
        instancePopup.translatesAutoresizingMaskIntoConstraints = false
        refreshInstancesButton.bezelStyle = .rounded
        refreshInstancesButton.target = self
        refreshInstancesButton.translatesAutoresizingMaskIntoConstraints = false
        refreshInstancesButton.widthAnchor.constraint(equalToConstant: 28).isActive = true

        let instanceRow = NSStackView(views: [instanceLabel, instancePopup, refreshInstancesButton])
        instanceRow.orientation = .horizontal
        instanceRow.alignment = .centerY
        instanceRow.spacing = 6

        let leftStack = NSStackView(views: [
            titleLabel,
            instanceRow,
            statusLabel, queryButton, queryBasicInfoButton,
            openTabStack, closeTabStack, navigateStack,
            likeStack, retweetStack, bookmarkStack, followStack, unfollowStack
        ])
        leftStack.orientation = .vertical
        leftStack.alignment = .leading
        leftStack.spacing = 15
        leftStack.translatesAutoresizingMaskIntoConstraints = false
        
        view.addSubview(leftStack)
        view.addSubview(resultScrollView)
        
        NSLayoutConstraint.activate([
            leftStack.topAnchor.constraint(equalTo: view.topAnchor, constant: 20),
            leftStack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            leftStack.widthAnchor.constraint(equalToConstant: 250),
            
            resultScrollView.topAnchor.constraint(equalTo: view.topAnchor, constant: 20),
            resultScrollView.leadingAnchor.constraint(equalTo: leftStack.trailingAnchor, constant: 20),
            resultScrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            resultScrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -20)
        ])
    }
    
    @objc private func queryXStatusClicked() {
        // Clear previous output
        DispatchQueue.main.async {
            self.resultTextView.string = "Querying...\n"
        }
        AppDelegate.shared?.sendQueryXTabsStatus(instanceId: selectedInstanceId())
    }
    
    @objc private func handleQueryResult(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let jsonString = userInfo["dataString"] as? String else { return }
        
        DispatchQueue.main.async {
            self.resultTextView.string = jsonString
        }
    }
    
    @objc private func queryBasicInfoClicked() {
        DispatchQueue.main.async {
            self.resultTextView.string = "Querying Basic Info...\n"
        }
        AppDelegate.shared?.sendQueryXBasicInfo(instanceId: selectedInstanceId())
    }
    
    @objc private func handleBasicInfoResult(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let jsonString = userInfo["dataString"] as? String else { return }
        
        DispatchQueue.main.async {
            self.resultTextView.string = jsonString
        }
    }
    
    @objc private func openTabClicked() {
        let path = pathTextField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        DispatchQueue.main.async {
            self.resultTextView.string = "Opening Tab: \(path)...\n"
        }
        AppDelegate.shared?.sendOpenTab(path: path, instanceId: selectedInstanceId())
    }
    
    @objc private func handleOpenTabResult(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let jsonString = userInfo["dataString"] as? String else { return }
        
        DispatchQueue.main.async {
            self.resultTextView.string = jsonString
        }
    }
    
    @objc private func closeTabClicked() {
        let input = tabIdTextField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let tabId = Int(input) else {
            DispatchQueue.main.async {
                self.resultTextView.string = "Error: Invalid Tab ID"
            }
            return
        }
        DispatchQueue.main.async {
            self.resultTextView.string = "Closing Tab: \(tabId)...\n"
        }
        AppDelegate.shared?.sendCloseTab(tabId: tabId, instanceId: selectedInstanceId())
    }
    
    @objc private func handleCloseTabResult(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let jsonString = userInfo["dataString"] as? String else { return }
        
        DispatchQueue.main.async {
            self.resultTextView.string = jsonString
        }
    }
    
    @objc private func navigateClicked() {
        let path = navPathTextField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        let idString = navTabIdTextField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        let tabId = Int(idString)
        
        DispatchQueue.main.async {
            self.resultTextView.string = "Navigating...\n"
        }
        AppDelegate.shared?.sendNavigateTab(tabId: tabId, path: path, instanceId: selectedInstanceId())
    }
    
    @objc private func handleNavigateTabResult(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let jsonString = userInfo["dataString"] as? String else { return }
        
        DispatchQueue.main.async {
            self.resultTextView.string = jsonString
        }
    }
    
    // ── Write Actions ──────────────────────────────────
    
    @objc private func likeTweetClicked() {
        let tweetId = likeTweetIdTextField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !tweetId.isEmpty else {
            resultTextView.string = "Error: Tweet ID is required"
            return
        }
        resultTextView.string = "Liking tweet: \(tweetId)...\n"
        AppDelegate.shared?.sendExecAction(action: "like", tweetId: tweetId, userId: nil, tabId: nil, instanceId: selectedInstanceId())
    }
    
    @objc private func retweetClicked() {
        let tweetId = retweetTweetIdTextField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !tweetId.isEmpty else {
            resultTextView.string = "Error: Tweet ID is required"
            return
        }
        resultTextView.string = "Retweeting: \(tweetId)...\n"
        AppDelegate.shared?.sendExecAction(action: "retweet", tweetId: tweetId, userId: nil, tabId: nil, instanceId: selectedInstanceId())
    }
    
    @objc private func bookmarkClicked() {
        let tweetId = bookmarkTweetIdTextField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !tweetId.isEmpty else {
            resultTextView.string = "Error: Tweet ID is required"
            return
        }
        resultTextView.string = "Bookmarking: \(tweetId)...\n"
        AppDelegate.shared?.sendExecAction(action: "bookmark", tweetId: tweetId, userId: nil, tabId: nil, instanceId: selectedInstanceId())
    }
    
    @objc private func followClicked() {
        let userId = followUserIdTextField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !userId.isEmpty else {
            resultTextView.string = "Error: User ID is required"
            return
        }
        resultTextView.string = "Following user: \(userId)...\n"
        AppDelegate.shared?.sendExecAction(action: "follow", tweetId: nil, userId: userId, tabId: nil, instanceId: selectedInstanceId())
    }
    
    @objc private func unfollowClicked() {
        let userId = unfollowUserIdTextField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !userId.isEmpty else {
            resultTextView.string = "Error: User ID is required"
            return
        }
        resultTextView.string = "Unfollowing user: \(userId)...\n"
        AppDelegate.shared?.sendExecAction(action: "unfollow", tweetId: nil, userId: userId, tabId: nil, instanceId: selectedInstanceId())
    }
    
    @objc private func handleExecActionResult(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let jsonString = userInfo["dataString"] as? String else { return }
        DispatchQueue.main.async {
            self.resultTextView.string = jsonString
        }
    }
}

final class TweetClawClawViewController: NSViewController, NSTableViewDelegate, NSTableViewDataSource {
    private let titleLabel = NSTextField(labelWithString: "TweetClaw - API for Bots")
    private let tableView = NSTableView()
    private var detailTextView: NSTextView!
    private let copyButton = NSButton(title: "复制 curl", target: nil, action: #selector(copyCurlClicked))
    private var currentCurlCommand: String = ""
    
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
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        loadDocs()
        setupUI()
    }
    
    private func loadDocs() {
        guard let url = Bundle.main.url(forResource: "api_docs", withExtension: "json") else {
            // Fallback for development (Absolute path)
            let path = "/Users/hyperorchid/aiwithblockchain/aihub/localBridge/apple/LocalBridgeMac/api_docs.json"
            if let data = try? Data(contentsOf: URL(fileURLWithPath: path)) {
                do {
                    self.docs = try JSONDecoder().decode([ApiDoc].self, from: data)
                } catch {
                    print("[LocalBridgeMac] JSON Decode Error: \(error)")
                }
            }
            return
        }
        if let data = try? Data(contentsOf: url) {
            do {
                self.docs = try JSONDecoder().decode([ApiDoc].self, from: data)
            } catch {
                print("[LocalBridgeMac] JSON Decode Error from Bundle: \(error)")
            }
        }
    }
    
    private func setupUI() {
        titleLabel.font = .systemFont(ofSize: 22, weight: .bold)
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(titleLabel)
        
        // Left Column: Navigation List
        let scrollView = NSScrollView()
        scrollView.hasVerticalScroller = true
        scrollView.drawsBackground = false
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        
        tableView.delegate = self
        tableView.dataSource = self
        tableView.rowHeight = 84 // Increased for multi-line summary
        tableView.headerView = nil
        tableView.selectionHighlightStyle = .regular
        
        let column = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("ApiColumn"))
        column.width = 280
        tableView.addTableColumn(column)
        
        scrollView.documentView = tableView
        view.addSubview(scrollView)
        
        // Right Column: Detail Documentation Canvas
        let detailScroll = NSTextView.scrollableTextView()
        detailScroll.borderType = .bezelBorder
        detailScroll.translatesAutoresizingMaskIntoConstraints = false
        
        detailTextView = detailScroll.documentView as? NSTextView
        detailTextView.isEditable = false
        detailTextView.isSelectable = true
        detailTextView.isRichText = true  // Enable rich text support
        detailTextView.importsGraphics = true
        detailTextView.drawsBackground = true
        detailTextView.backgroundColor = .textBackgroundColor
        detailTextView.textContainerInset = NSSize(width: 24, height: 24)
        detailTextView.font = .systemFont(ofSize: 13)
        detailTextView.textColor = .labelColor
        
        view.addSubview(detailScroll)
        
        NSLayoutConstraint.activate([
            titleLabel.topAnchor.constraint(equalTo: view.topAnchor, constant: 20),
            titleLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            
            scrollView.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 20),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            scrollView.widthAnchor.constraint(equalToConstant: 300),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -20),
            
            detailScroll.topAnchor.constraint(equalTo: scrollView.topAnchor),
            detailScroll.leadingAnchor.constraint(equalTo: scrollView.trailingAnchor, constant: 20),
            detailScroll.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            detailScroll.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -20)
        ])
        
        // Copy curl button — floats over the top-right of the detail panel
        copyButton.bezelStyle = .rounded
        copyButton.target = self
        copyButton.translatesAutoresizingMaskIntoConstraints = false
        copyButton.isHidden = true
        view.addSubview(copyButton)
        NSLayoutConstraint.activate([
            copyButton.topAnchor.constraint(equalTo: detailScroll.topAnchor, constant: 8),
            copyButton.trailingAnchor.constraint(equalTo: detailScroll.trailingAnchor, constant: -8)
        ])

        // Default selection
        if !docs.isEmpty {
            DispatchQueue.main.async {
                self.tableView.selectRowIndexes(IndexSet(integer: 0), byExtendingSelection: false)
            }
        }
    }

    @objc private func copyCurlClicked() {
        guard !currentCurlCommand.isEmpty else { return }
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(currentCurlCommand, forType: .string)
        copyButton.title = "已复制 ✓"
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            self.copyButton.title = "复制 curl"
        }
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
            
            let nameLabel = NSTextField(labelWithString: "")
            nameLabel.font = .systemFont(ofSize: 14, weight: .bold)
            nameLabel.translatesAutoresizingMaskIntoConstraints = false
            nameLabel.tag = 101
            
            let summaryLabel = NSTextField(wrappingLabelWithString: "")
            summaryLabel.font = .systemFont(ofSize: 12)
            summaryLabel.textColor = .secondaryLabelColor
            summaryLabel.translatesAutoresizingMaskIntoConstraints = false
            summaryLabel.tag = 102
            
            let methodLabel = NSTextField(labelWithString: "")
            methodLabel.font = .monospacedSystemFont(ofSize: 9, weight: .bold)
            methodLabel.alignment = .center
            methodLabel.wantsLayer = true
            methodLabel.layer?.cornerRadius = 4
            methodLabel.translatesAutoresizingMaskIntoConstraints = false
            methodLabel.tag = 103
            
            cell?.addSubview(nameLabel)
            cell?.addSubview(summaryLabel)
            cell?.addSubview(methodLabel)
            
            NSLayoutConstraint.activate([
                methodLabel.topAnchor.constraint(equalTo: cell!.topAnchor, constant: 10),
                methodLabel.leadingAnchor.constraint(equalTo: cell!.leadingAnchor, constant: 10),
                methodLabel.widthAnchor.constraint(equalToConstant: 42),
                methodLabel.heightAnchor.constraint(equalToConstant: 16),
                
                nameLabel.centerYAnchor.constraint(equalTo: methodLabel.centerYAnchor),
                nameLabel.leadingAnchor.constraint(equalTo: methodLabel.trailingAnchor, constant: 8),
                nameLabel.trailingAnchor.constraint(equalTo: cell!.trailingAnchor, constant: -10),
                
                summaryLabel.topAnchor.constraint(equalTo: nameLabel.bottomAnchor, constant: 4),
                summaryLabel.leadingAnchor.constraint(equalTo: cell!.leadingAnchor, constant: 10),
                summaryLabel.trailingAnchor.constraint(equalTo: cell!.trailingAnchor, constant: -10),
                summaryLabel.bottomAnchor.constraint(lessThanOrEqualTo: cell!.bottomAnchor, constant: -8)
            ])
        }
        
        let doc = docs[row]
        
        if let methodLabel = cell?.viewWithTag(103) as? NSTextField {
            methodLabel.stringValue = doc.method.uppercased()
            let color = methodColor(doc.method)
            methodLabel.textColor = .white
            methodLabel.backgroundColor = color
            methodLabel.drawsBackground = true
        }
        
        if let nameLabel = cell?.viewWithTag(101) as? NSTextField {
            nameLabel.stringValue = doc.name
        }
        
        if let summaryLabel = cell?.viewWithTag(102) as? NSTextField {
            summaryLabel.stringValue = doc.summary
        }
        
        return cell
    }
    
    func tableViewSelectionDidChange(_ notification: Notification) {
        let row = tableView.selectedRow
        print("[LocalBridgeMac] API Table Selection Changed: \(row)")
        guard row >= 0 && row < docs.count else {
            updateDetailView(with: nil)
            return
        }
        updateDetailView(with: docs[row])
    }
    
    private func updateDetailView(with doc: ApiDoc?) {
        guard let textView = detailTextView else {
            print("[LocalBridgeMac] Error: detailTextView is NIL")
            return
        }
        
        print("[LocalBridgeMac] Updating Detail View for: \(doc?.name ?? "None")")
        guard let doc = doc else {
            textView.string = "Select an API from the left sidebar to view details."
            return
        }
        
        let attrStr = NSMutableAttributedString()
        
        let titleFont = NSFont.systemFont(ofSize: 22, weight: .bold)
        let methodFont = NSFont.monospacedSystemFont(ofSize: 14, weight: .bold)
        let normalFont = NSFont.systemFont(ofSize: 13)
        let sectionFont = NSFont.systemFont(ofSize: 15, weight: .bold)
        let codeFont = NSFont.monospacedSystemFont(ofSize: 12, weight: .regular)
        
        // Title
        attrStr.append(NSAttributedString(string: "\(doc.name)\n", attributes: [
            .font: titleFont,
            .foregroundColor: NSColor.labelColor
        ]))
        
        // Method and Path
        attrStr.append(NSAttributedString(string: "\(doc.method) ", attributes: [
            .font: methodFont,
            .foregroundColor: methodColor(doc.method)
        ]))
        attrStr.append(NSAttributedString(string: "\(doc.path)\n\n", attributes: [
            .font: codeFont,
            .foregroundColor: NSColor.secondaryLabelColor
        ]))
        
        // Description
        attrStr.append(NSAttributedString(string: "DESCRIPTION\n", attributes: [
            .font: sectionFont,
            .foregroundColor: NSColor.labelColor
        ]))
        attrStr.append(NSAttributedString(string: "\(doc.description)\n\n", attributes: [
            .font: normalFont,
            .foregroundColor: NSColor.labelColor
        ]))
        
        // Request Body
        if let body = doc.body {
            attrStr.append(NSAttributedString(string: "REQUEST BODY (JSON)\n", attributes: [
                .font: sectionFont,
                .foregroundColor: NSColor.labelColor
            ]))
            attrStr.append(NSAttributedString(string: "\(body)\n\n", attributes: [
                .font: codeFont,
                .foregroundColor: NSColor.labelColor,
                .backgroundColor: NSColor.windowBackgroundColor
            ]))
        }
        
        // cURL
        attrStr.append(NSAttributedString(string: "cURL EXAMPLE\n", attributes: [
            .font: sectionFont,
            .foregroundColor: NSColor.labelColor
        ]))
        attrStr.append(NSAttributedString(string: "\(doc.curl)\n\n", attributes: [
            .font: codeFont,
            .foregroundColor: NSColor.labelColor,
            .backgroundColor: NSColor.windowBackgroundColor
        ]))
        
        // Response
        attrStr.append(NSAttributedString(string: "RESPONSE FORMAT\n", attributes: [
            .font: sectionFont,
            .foregroundColor: NSColor.systemGreen
        ]))
        attrStr.append(NSAttributedString(string: "\(doc.response)\n", attributes: [
            .font: codeFont,
            .foregroundColor: NSColor.labelColor,
            .backgroundColor: NSColor.windowBackgroundColor
        ]))
        
        let style = NSMutableParagraphStyle()
        style.lineSpacing = 4
        style.paragraphSpacing = 8
        attrStr.addAttribute(.paragraphStyle, value: style, range: NSRange(location: 0, length: attrStr.length))
        
        // Explicitly set the attributed string to the text storage
        textView.textStorage?.setAttributedString(attrStr)
        
        // Avoid forcing layout during AppKit's own layout pass.
        textView.needsDisplay = true
        
        // Scroll to top
        textView.scrollToBeginningOfDocument(nil)

        // Show copy button and bind current curl command
        currentCurlCommand = doc.curl
        copyButton.title = "复制 curl"
        copyButton.isHidden = false

        print("[LocalBridgeMac] Successfully rendered \(attrStr.length) chars for \(doc.name)")
    }
    
    private func methodColor(_ method: String) -> NSColor {
        switch method.uppercased() {
        case "GET": return NSColor.systemBlue
        case "POST": return NSColor.systemGreen
        case "PUT": return NSColor.systemOrange
        case "DELETE": return NSColor.systemRed
        default: return NSColor.labelColor
        }
    }
}
