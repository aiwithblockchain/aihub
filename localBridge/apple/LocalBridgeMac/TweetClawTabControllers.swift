import AppKit

// 自定义 TextFieldCell 以支持内边距
class PaddedTextFieldCell: NSTextFieldCell {
    var textInsets = NSSize(width: 8, height: 4)

    override func drawingRect(forBounds rect: NSRect) -> NSRect {
        return rect.insetBy(dx: textInsets.width, dy: textInsets.height)
    }

    override func titleRect(forBounds rect: NSRect) -> NSRect {
        return rect.insetBy(dx: textInsets.width, dy: textInsets.height)
    }

    override func edit(withFrame rect: NSRect, in controlView: NSView, editor textObj: NSText, delegate: Any?, event: NSEvent?) {
        let insetRect = rect.insetBy(dx: textInsets.width, dy: textInsets.height)
        super.edit(withFrame: insetRect, in: controlView, editor: textObj, delegate: delegate, event: event)
    }

    override func select(withFrame rect: NSRect, in controlView: NSView, editor textObj: NSText, delegate: Any?, start selStart: Int, length selLength: Int) {
        let insetRect = rect.insetBy(dx: textInsets.width, dy: textInsets.height)
        super.select(withFrame: insetRect, in: controlView, editor: textObj, delegate: delegate, start: selStart, length: selLength)
    }
}

final class TweetClawHumanViewController: NSViewController {
    private let headerImageView = NSImageView()
    private let headerTitleLabel = NSTextField(labelWithString: "TweetClaw")

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

    private let unlikeTweetIdTextField = NSTextField()
    private let unlikeButton = NSButton(title: "取消点赞", target: nil, action: #selector(unlikeTweetClicked))

    private let unretweetTweetIdTextField = NSTextField()
    private let unretweetButton = NSButton(title: "取消转推", target: nil, action: #selector(unretweetClicked))

    private let unbookmarkTweetIdTextField = NSTextField()
    private let unbookmarkButton = NSButton(title: "取消收藏", target: nil, action: #selector(unbookmarkClicked))

    private let createTweetTextView = NSTextView()
    private let createTweetScrollView = NSScrollView()
    private let createTweetButton = NSButton(title: "发布推文", target: nil, action: #selector(createTweetClicked))

    private let replyTweetIdTextField = NSTextField()
    private let replyTextView = NSTextView()
    private let replyScrollView = NSScrollView()
    private let createReplyButton = NSButton(title: "发布回复", target: nil, action: #selector(createReplyClicked))

    private let deleteTweetIdTextField = NSTextField()
    private let deleteTweetButton = NSButton(title: "删除推文", target: nil, action: #selector(deleteTweetClicked))

    private let getTimelineButton = NSButton(title: "获取主页时间线", target: nil, action: #selector(getTimelineClicked))

    private let getTweetIdTextField = NSTextField()
    private let getTweetButton = NSButton(title: "获取推文详情", target: nil, action: #selector(getTweetClicked))

    private let getUserScreenNameTextField = NSTextField()
    private let getUserButton = NSButton(title: "获取用户资料", target: nil, action: #selector(getUserClicked))

    private let searchButton = NSButton(title: "搜索推文", target: nil, action: #selector(searchClicked))

    // 实例选择器
    private let instanceLabel = NSTextField(labelWithString: "目标实例:")
    private let instancePopup = NSPopUpButton(frame: .zero, pullsDown: false)
    private let refreshInstancesButton = NSButton(title: "↻", target: nil, action: #selector(refreshInstancesClicked))
    private var instanceSnapshots: [LocalBridgeGoManager.InstanceSnapshot] = []

    private var resultTextView: NSTextView!
    private var resultScrollView: NSScrollView!

    override func loadView() {
        view = NSView()
        view.wantsLayer = true
        view.layer?.backgroundColor = DSV2.surfaceContainerLow.cgColor
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
        if #available(macOS 11.0, *) {
            headerImageView.image = NSImage(systemSymbolName: "network", accessibilityDescription: nil)
            headerImageView.symbolConfiguration = NSImage.SymbolConfiguration(pointSize: 20, weight: .semibold)
            headerImageView.contentTintColor = DSV2.primary
        }
        headerImageView.translatesAutoresizingMaskIntoConstraints = false

        headerTitleLabel.font = DSV2.fontTitleLg
        headerTitleLabel.textColor = DSV2.onSurface
        
        styleButton(queryButton)
        queryButton.target = self

        styleButton(queryBasicInfoButton)
        queryBasicInfoButton.target = self

        styleInputField(pathTextField)
        pathTextField.placeholderString = "输入路径，如 home"
        pathTextField.stringValue = "home"

        styleButton(openTabButton)
        openTabButton.target = self

        styleInputField(tabIdTextField)
        tabIdTextField.placeholderString = "输入 Tab ID"

        styleButton(closeTabButton)
        closeTabButton.target = self
        closeTabButton.attributedTitle = NSAttributedString(
            string: "关闭 Tab",
            attributes: [.foregroundColor: DSV2.error]
        )
        
        styleInputField(navTabIdTextField)
        navTabIdTextField.placeholderString = "Tab ID"
        navTabIdTextField.translatesAutoresizingMaskIntoConstraints = false
        navTabIdTextField.widthAnchor.constraint(equalToConstant: 80).isActive = true

        styleInputField(navPathTextField)
        navPathTextField.placeholderString = "路径 (如: home)"
        navPathTextField.stringValue = "home"

        styleButton(navigateButton)
        navigateButton.title = "跳转到 ->"
        navigateButton.target = self
        
        // 使用 DSV2 终端视图工厂
        let terminal = DSV2.makeTerminalTextView()
        resultScrollView = terminal.scrollView
        resultTextView = terminal.textView
        
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
        
        styleInputField(likeTweetIdTextField)
        likeTweetIdTextField.placeholderString = "Tweet ID"
        styleButton(likeButton)
        likeButton.target = self
        let likeStack = NSStackView(views: [likeTweetIdTextField, likeButton])
        likeStack.orientation = .horizontal
        likeStack.spacing = 8

        styleInputField(retweetTweetIdTextField)
        retweetTweetIdTextField.placeholderString = "Tweet ID"
        styleButton(retweetButton)
        retweetButton.target = self
        let retweetStack = NSStackView(views: [retweetTweetIdTextField, retweetButton])
        retweetStack.orientation = .horizontal
        retweetStack.spacing = 8

        styleInputField(bookmarkTweetIdTextField)
        bookmarkTweetIdTextField.placeholderString = "Tweet ID"
        styleButton(bookmarkButton)
        bookmarkButton.target = self
        let bookmarkStack = NSStackView(views: [bookmarkTweetIdTextField, bookmarkButton])
        bookmarkStack.orientation = .horizontal
        bookmarkStack.spacing = 8

        styleInputField(followUserIdTextField)
        followUserIdTextField.placeholderString = "User ID"
        styleButton(followButton)
        followButton.target = self
        let followStack = NSStackView(views: [followUserIdTextField, followButton])
        followStack.orientation = .horizontal
        followStack.spacing = 8

        styleInputField(unfollowUserIdTextField)
        unfollowUserIdTextField.placeholderString = "User ID"
        styleButton(unfollowButton)
        unfollowButton.target = self
        let unfollowStack = NSStackView(views: [unfollowUserIdTextField, unfollowButton])
        unfollowStack.orientation = .horizontal
        unfollowStack.spacing = 8

        styleInputField(unlikeTweetIdTextField)
        unlikeTweetIdTextField.placeholderString = "Tweet ID"
        styleButton(unlikeButton)
        unlikeButton.target = self
        let unlikeStack = NSStackView(views: [unlikeTweetIdTextField, unlikeButton])
        unlikeStack.orientation = .horizontal
        unlikeStack.spacing = 8

        styleInputField(unretweetTweetIdTextField)
        unretweetTweetIdTextField.placeholderString = "Tweet ID"
        styleButton(unretweetButton)
        unretweetButton.target = self
        let unretweetStack = NSStackView(views: [unretweetTweetIdTextField, unretweetButton])
        unretweetStack.orientation = .horizontal
        unretweetStack.spacing = 8

        styleInputField(unbookmarkTweetIdTextField)
        unbookmarkTweetIdTextField.placeholderString = "Tweet ID"
        styleButton(unbookmarkButton)
        unbookmarkButton.target = self
        let unbookmarkStack = NSStackView(views: [unbookmarkTweetIdTextField, unbookmarkButton])
        unbookmarkStack.orientation = .horizontal
        unbookmarkStack.spacing = 8

        // Create Tweet
        styleTextView(createTweetTextView, scrollView: createTweetScrollView)
        createTweetScrollView.heightAnchor.constraint(equalToConstant: 60).isActive = true
        styleButton(createTweetButton)
        createTweetButton.target = self

        // Create Reply
        styleInputField(replyTweetIdTextField)
        replyTweetIdTextField.placeholderString = "Tweet ID"
        styleTextView(replyTextView, scrollView: replyScrollView)
        replyScrollView.heightAnchor.constraint(equalToConstant: 60).isActive = true
        let replyTopStack = NSStackView(views: [replyTweetIdTextField, createReplyButton])
        replyTopStack.orientation = .horizontal
        replyTopStack.spacing = 8
        styleButton(createReplyButton)
        createReplyButton.target = self

        // Delete Tweet
        styleInputField(deleteTweetIdTextField)
        deleteTweetIdTextField.placeholderString = "Tweet ID"
        styleButton(deleteTweetButton)
        deleteTweetButton.target = self
        deleteTweetButton.attributedTitle = NSAttributedString(
            string: "删除推文",
            attributes: [.foregroundColor: DSV2.error]
        )
        let deleteStack = NSStackView(views: [deleteTweetIdTextField, deleteTweetButton])
        deleteStack.orientation = .horizontal
        deleteStack.spacing = 8

        // Get Timeline
        styleButton(getTimelineButton)
        getTimelineButton.target = self

        // Get Tweet Detail
        styleInputField(getTweetIdTextField)
        getTweetIdTextField.placeholderString = "Tweet ID"
        styleButton(getTweetButton)
        getTweetButton.target = self
        let getTweetStack = NSStackView(views: [getTweetIdTextField, getTweetButton])
        getTweetStack.orientation = .horizontal
        getTweetStack.spacing = 8

        // Get User Profile
        styleInputField(getUserScreenNameTextField)
        getUserScreenNameTextField.placeholderString = "Screen Name"
        styleButton(getUserButton)
        getUserButton.target = self
        let getUserStack = NSStackView(views: [getUserScreenNameTextField, getUserButton])
        getUserStack.orientation = .horizontal
        getUserStack.spacing = 8

        // Search Tweets
        styleButton(searchButton)
        searchButton.target = self

        // 实例选择器
        instanceLabel.font = DSV2.fontBodyMd
        instanceLabel.textColor = DSV2.onSurfaceVariant
        instancePopup.translatesAutoresizingMaskIntoConstraints = false
        styleButton(refreshInstancesButton)
        refreshInstancesButton.target = self
        refreshInstancesButton.translatesAutoresizingMaskIntoConstraints = false
        refreshInstancesButton.widthAnchor.constraint(equalToConstant: 28).isActive = true

        let instanceRow = NSStackView(views: [instanceLabel, instancePopup, refreshInstancesButton])
        instanceRow.orientation = .horizontal
        instanceRow.alignment = .centerY
        instanceRow.spacing = 6

        let headerLeft = NSStackView(views: [headerImageView, headerTitleLabel])
        headerLeft.orientation = .horizontal
        headerLeft.spacing = 8
        headerLeft.alignment = .centerY
        
        let pageHeader = NSStackView(views: [headerLeft, NSView(), instanceRow])
        pageHeader.orientation = .horizontal
        pageHeader.alignment = .centerY
        pageHeader.translatesAutoresizingMaskIntoConstraints = false

        let leftStack = NSStackView(views: [
            makeSectionHeader("状态查询"),
            queryButton, queryBasicInfoButton,
            makeSectionHeader("Tab 管理"),
            openTabStack, closeTabStack, navigateStack,
            makeSectionHeader("交互操作"),
            likeStack, retweetStack, bookmarkStack, followStack, unfollowStack,
            unlikeStack, unretweetStack, unbookmarkStack,
            makeSectionHeader("推文管理"),
            createTweetScrollView, createTweetButton,
            replyTopStack, replyScrollView,
            deleteStack,
            makeSectionHeader("数据读取"),
            getTimelineButton, getTweetStack, getUserStack, searchButton
        ])
        leftStack.orientation = .vertical
        leftStack.alignment = .leading
        leftStack.spacing = DSV2.spacing4
        leftStack.translatesAutoresizingMaskIntoConstraints = false

        // 将 leftStack 包装在可滚动的 ScrollView 中
        let leftScrollView = NSScrollView()
        leftScrollView.hasVerticalScroller = true
        leftScrollView.hasHorizontalScroller = false
        leftScrollView.drawsBackground = false
        leftScrollView.borderType = .noBorder
        leftScrollView.translatesAutoresizingMaskIntoConstraints = false
        leftScrollView.documentView = leftStack

        view.addSubview(pageHeader)
        view.addSubview(leftScrollView)
        view.addSubview(resultScrollView)

        NSLayoutConstraint.activate([
            pageHeader.topAnchor.constraint(equalTo: view.topAnchor, constant: DSV2.spacing6),
            pageHeader.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: DSV2.spacing6),
            pageHeader.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -DSV2.spacing6),

            leftScrollView.topAnchor.constraint(equalTo: pageHeader.bottomAnchor, constant: DSV2.spacing6),
            leftScrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: DSV2.spacing6),
            leftScrollView.widthAnchor.constraint(equalToConstant: 380),
            leftScrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -DSV2.spacing6),

            leftStack.topAnchor.constraint(equalTo: leftScrollView.topAnchor),
            leftStack.leadingAnchor.constraint(equalTo: leftScrollView.leadingAnchor),
            leftStack.widthAnchor.constraint(equalToConstant: 380),

            resultScrollView.topAnchor.constraint(equalTo: leftScrollView.topAnchor),
            resultScrollView.leadingAnchor.constraint(equalTo: leftScrollView.trailingAnchor, constant: DSV2.spacing4),
            resultScrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -DSV2.spacing6),
            resultScrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -DSV2.spacing6)
        ])
    }

    private func styleInputField(_ field: NSTextField) {
        // 使用自定义的 PaddedTextFieldCell 来支持内边距
        field.cell = PaddedTextFieldCell(textCell: "")

        field.wantsLayer = true
        field.isBordered = true
        field.bezelStyle = .squareBezel
        field.drawsBackground = true
        field.backgroundColor = DSV2.surfaceContainerHigh
        field.textColor = DSV2.onSurface
        field.font = DSV2.fontBodyMd
        field.translatesAutoresizingMaskIntoConstraints = false

        // 自定义边框样式
        field.layer?.borderWidth = 1
        field.layer?.borderColor = DSV2.outlineVariant.withAlphaComponent(0.6).cgColor
        field.layer?.cornerRadius = DSV2.radiusInput

        // 增加高度以提供更多垂直空间
        field.heightAnchor.constraint(equalToConstant: 36).isActive = true

        // 移除焦点环
        field.focusRingType = .none
    }

    private func styleButton(_ button: NSButton) {
        button.wantsLayer = true
        button.isBordered = false
        button.bezelStyle = .rounded

        // 使用更明显的按钮背景
        button.layer?.backgroundColor = DSV2.surfaceContainerHighest.cgColor
        button.layer?.cornerRadius = DSV2.radiusButton
        button.layer?.borderWidth = 1
        button.layer?.borderColor = DSV2.outlineVariant.withAlphaComponent(0.3).cgColor

        button.contentTintColor = DSV2.onSurface
        button.font = DSV2.fontLabelMd

        // 添加内边距
        button.translatesAutoresizingMaskIntoConstraints = false
        if button.constraints.isEmpty {
            button.heightAnchor.constraint(greaterThanOrEqualToConstant: 28).isActive = true
        }
    }

    private func styleTextView(_ textView: NSTextView, scrollView: NSScrollView) {
        scrollView.documentView = textView
        scrollView.hasVerticalScroller = true
        scrollView.borderType = .noBorder
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

    @objc private func unlikeTweetClicked() {
        let tweetId = unlikeTweetIdTextField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !tweetId.isEmpty else {
            resultTextView.string = "Error: Tweet ID is required"
            return
        }
        resultTextView.string = "Unliking tweet: \(tweetId)...\n"
        AppDelegate.shared?.sendExecAction(action: "unlike", tweetId: tweetId, userId: nil, tabId: nil, instanceId: selectedInstanceId())
    }

    @objc private func unretweetClicked() {
        let tweetId = unretweetTweetIdTextField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !tweetId.isEmpty else {
            resultTextView.string = "Error: Tweet ID is required"
            return
        }
        resultTextView.string = "Unretweeting: \(tweetId)...\n"
        AppDelegate.shared?.sendExecAction(action: "unretweet", tweetId: tweetId, userId: nil, tabId: nil, instanceId: selectedInstanceId())
    }

    @objc private func unbookmarkClicked() {
        let tweetId = unbookmarkTweetIdTextField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !tweetId.isEmpty else {
            resultTextView.string = "Error: Tweet ID is required"
            return
        }
        resultTextView.string = "Unbookmarking: \(tweetId)...\n"
        AppDelegate.shared?.sendExecAction(action: "unbookmark", tweetId: tweetId, userId: nil, tabId: nil, instanceId: selectedInstanceId())
    }

    @objc private func createTweetClicked() {
        let text = createTweetTextView.string.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else {
            resultTextView.string = "Error: Tweet text is required"
            return
        }
        resultTextView.string = "Creating tweet...\n"
        AppDelegate.shared?.sendExecAction(action: "createTweet", tweetId: nil, userId: nil, tabId: nil, text: text, instanceId: selectedInstanceId())
    }

    @objc private func createReplyClicked() {
        let tweetId = replyTweetIdTextField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        let text = replyTextView.string.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !tweetId.isEmpty else {
            resultTextView.string = "Error: Tweet ID is required"
            return
        }
        guard !text.isEmpty else {
            resultTextView.string = "Error: Reply text is required"
            return
        }
        resultTextView.string = "Creating reply to \(tweetId)...\n"
        AppDelegate.shared?.sendExecAction(action: "createReply", tweetId: tweetId, userId: nil, tabId: nil, text: text, instanceId: selectedInstanceId())
    }

    @objc private func deleteTweetClicked() {
        let tweetId = deleteTweetIdTextField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !tweetId.isEmpty else {
            resultTextView.string = "Error: Tweet ID is required"
            return
        }
        resultTextView.string = "Deleting tweet: \(tweetId)...\n"
        AppDelegate.shared?.sendExecAction(action: "deleteTweet", tweetId: tweetId, userId: nil, tabId: nil, instanceId: selectedInstanceId())
    }

    @objc private func getTimelineClicked() {
        resultTextView.string = "Getting home timeline...\n"
        AppDelegate.shared?.sendExecAction(action: "getTimeline", tweetId: nil, userId: nil, tabId: nil, instanceId: selectedInstanceId())
    }

    @objc private func getTweetClicked() {
        let tweetId = getTweetIdTextField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !tweetId.isEmpty else {
            resultTextView.string = "Error: Tweet ID is required"
            return
        }
        resultTextView.string = "Getting tweet detail: \(tweetId)...\n"
        AppDelegate.shared?.sendExecAction(action: "getTweet", tweetId: tweetId, userId: nil, tabId: nil, instanceId: selectedInstanceId())
    }

    @objc private func getUserClicked() {
        let screenName = getUserScreenNameTextField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !screenName.isEmpty else {
            resultTextView.string = "Error: Screen Name is required"
            return
        }
        resultTextView.string = "Getting user profile: \(screenName)...\n"
        AppDelegate.shared?.sendExecAction(action: "getUser", tweetId: nil, userId: screenName, tabId: nil, instanceId: selectedInstanceId())
    }

    @objc private func searchClicked() {
        resultTextView.string = "Searching tweets (requires navigate to search page first)...\n"
        AppDelegate.shared?.sendExecAction(action: "search", tweetId: nil, userId: nil, tabId: nil, instanceId: selectedInstanceId())
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
    private let headerImageView = NSImageView()
    private let headerTitleLabel = NSTextField(labelWithString: "TweetClaw")
    private let tableView = NSTableView()
    private var detailTextView: NSTextView!
    private var detailScrollView: NSScrollView!
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
        view.wantsLayer = true
        view.layer?.backgroundColor = DSV2.surfaceContainerLow.cgColor
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
        // Header with icon and title
        if #available(macOS 11.0, *) {
            headerImageView.image = NSImage(systemSymbolName: "network", accessibilityDescription: nil)
            headerImageView.symbolConfiguration = NSImage.SymbolConfiguration(pointSize: 20, weight: .semibold)
            headerImageView.contentTintColor = DSV2.primary
        }
        headerImageView.translatesAutoresizingMaskIntoConstraints = false

        headerTitleLabel.font = DSV2.fontTitleLg
        headerTitleLabel.textColor = DSV2.onSurface

        let headerStack = NSStackView(views: [headerImageView, headerTitleLabel])
        headerStack.orientation = NSUserInterfaceLayoutOrientation.horizontal
        headerStack.spacing = 8
        headerStack.alignment = NSLayoutConstraint.Attribute.centerY
        headerStack.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(headerStack)

        // Left Column: API Navigation List with modern styling
        let scrollView = NSScrollView()
        scrollView.hasVerticalScroller = true
        scrollView.drawsBackground = false
        scrollView.borderType = .noBorder
        scrollView.translatesAutoresizingMaskIntoConstraints = false

        tableView.delegate = self
        tableView.dataSource = self
        tableView.rowHeight = 84
        tableView.headerView = nil
        tableView.selectionHighlightStyle = .regular  // 改为 regular 以支持完整行选择
        tableView.backgroundColor = .clear
        tableView.gridStyleMask = []
        tableView.intercellSpacing = NSSize(width: 0, height: DSV2.spacing2)
        tableView.allowsEmptySelection = false  // 始终保持选中状态

        let column = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("ApiColumn"))
        column.resizingMask = .autoresizingMask
        tableView.addTableColumn(column)

        scrollView.documentView = tableView
        view.addSubview(scrollView)

        // Right Column: Detail Documentation with terminal-style display
        detailScrollView = NSTextView.scrollableTextView()
        detailScrollView.borderType = .noBorder
        detailScrollView.wantsLayer = true
        detailScrollView.layer?.cornerRadius = DSV2.radiusCard
        detailScrollView.layer?.backgroundColor = DSV2.surfaceContainerLowest.cgColor
        detailScrollView.translatesAutoresizingMaskIntoConstraints = false

        detailTextView = detailScrollView.documentView as? NSTextView
        detailTextView.isEditable = false
        detailTextView.isSelectable = true
        detailTextView.isRichText = true
        detailTextView.importsGraphics = true
        detailTextView.drawsBackground = true
        detailTextView.backgroundColor = DSV2.surfaceContainerLowest
        detailTextView.textContainerInset = NSSize(width: DSV2.spacing4, height: DSV2.spacing4)
        detailTextView.font = DSV2.fontMonoMd
        detailTextView.textColor = DSV2.tertiary

        view.addSubview(detailScrollView)

        // Copy button with modern styling
        copyButton.wantsLayer = true
        copyButton.bezelStyle = .rounded
        copyButton.isBordered = false
        copyButton.layer?.backgroundColor = DSV2.surfaceContainerHighest.cgColor
        copyButton.layer?.cornerRadius = DSV2.radiusButton
        copyButton.layer?.borderWidth = 1
        copyButton.layer?.borderColor = DSV2.outlineVariant.withAlphaComponent(0.3).cgColor
        copyButton.contentTintColor = DSV2.onSurface
        copyButton.font = DSV2.fontLabelMd
        copyButton.target = self
        copyButton.translatesAutoresizingMaskIntoConstraints = false
        copyButton.isHidden = true
        if #available(macOS 11.0, *) {
            copyButton.image = NSImage(systemSymbolName: "doc.on.doc", accessibilityDescription: nil)
            copyButton.imagePosition = .imageLeading
        }
        view.addSubview(copyButton)

        NSLayoutConstraint.activate([
            headerStack.topAnchor.constraint(equalTo: view.topAnchor, constant: DSV2.spacing6),
            headerStack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: DSV2.spacing6),

            scrollView.topAnchor.constraint(equalTo: headerStack.bottomAnchor, constant: DSV2.spacing6),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: DSV2.spacing6),
            scrollView.widthAnchor.constraint(equalToConstant: 280),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -DSV2.spacing6),

            detailScrollView.topAnchor.constraint(equalTo: scrollView.topAnchor),
            detailScrollView.leadingAnchor.constraint(equalTo: scrollView.trailingAnchor, constant: DSV2.spacing4),
            detailScrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -DSV2.spacing6),
            detailScrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -DSV2.spacing6),

            copyButton.topAnchor.constraint(equalTo: detailScrollView.topAnchor, constant: DSV2.spacing2),
            copyButton.trailingAnchor.constraint(equalTo: detailScrollView.trailingAnchor, constant: -DSV2.spacing2)
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
            cell?.wantsLayer = true

            let nameLabel = NSTextField(labelWithString: "")
            nameLabel.font = DSV2.fontTitleSm
            nameLabel.translatesAutoresizingMaskIntoConstraints = false
            nameLabel.tag = 101

            let summaryLabel = NSTextField(wrappingLabelWithString: "")
            summaryLabel.font = DSV2.fontBodySm
            summaryLabel.textColor = DSV2.onSurfaceVariant
            summaryLabel.translatesAutoresizingMaskIntoConstraints = false
            summaryLabel.tag = 102

            let methodLabel = NSTextField(labelWithString: "")
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
                methodLabel.topAnchor.constraint(equalTo: cell!.topAnchor, constant: 12),
                methodLabel.leadingAnchor.constraint(equalTo: cell!.leadingAnchor, constant: 12),
                methodLabel.widthAnchor.constraint(equalToConstant: 48),
                methodLabel.heightAnchor.constraint(equalToConstant: 18),

                nameLabel.centerYAnchor.constraint(equalTo: methodLabel.centerYAnchor),
                nameLabel.leadingAnchor.constraint(equalTo: methodLabel.trailingAnchor, constant: 10),
                nameLabel.trailingAnchor.constraint(equalTo: cell!.trailingAnchor, constant: -12),

                summaryLabel.topAnchor.constraint(equalTo: nameLabel.bottomAnchor, constant: 6),
                summaryLabel.leadingAnchor.constraint(equalTo: cell!.leadingAnchor, constant: 12),
                summaryLabel.trailingAnchor.constraint(equalTo: cell!.trailingAnchor, constant: -12),
                summaryLabel.bottomAnchor.constraint(lessThanOrEqualTo: cell!.bottomAnchor, constant: -12)
            ])
        }

        let doc = docs[row]
        let isSelected = tableView.selectedRow == row

        // Apply card-like styling with DSV2
        cell?.layer?.cornerRadius = DSV2.radiusCard
        if isSelected {
            // 选中状态：更明显的背景色变化
            cell?.layer?.backgroundColor = DSV2.surfaceContainerHighest.cgColor
            cell?.layer?.borderWidth = 2
            cell?.layer?.borderColor = DSV2.primary.withAlphaComponent(0.5).cgColor
        } else {
            cell?.layer?.backgroundColor = DSV2.surfaceContainerHigh.cgColor
            cell?.layer?.borderWidth = 1.0
            cell?.layer?.borderColor = DSV2.outlineVariant.withAlphaComponent(0.15).cgColor
        }

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

        // Title
        attrStr.append(NSAttributedString(string: "\(doc.name)\n", attributes: [
            .font: DSV2.fontDisplaySm,
            .foregroundColor: DSV2.onSurface
        ]))

        // Method and Path
        attrStr.append(NSAttributedString(string: "\(doc.method) ", attributes: [
            .font: DSV2.fontMonoMd,
            .foregroundColor: methodColor(doc.method)
        ]))
        attrStr.append(NSAttributedString(string: "\(doc.path)\n\n", attributes: [
            .font: DSV2.fontMonoMd,
            .foregroundColor: DSV2.onSurfaceVariant
        ]))

        // Description
        attrStr.append(NSAttributedString(string: "DESCRIPTION\n", attributes: [
            .font: DSV2.fontTitleMd,
            .foregroundColor: DSV2.onSurface
        ]))
        attrStr.append(NSAttributedString(string: "\(doc.description)\n\n", attributes: [
            .font: DSV2.fontBodyMd,
            .foregroundColor: DSV2.onSurface
        ]))

        // Request Body
        if let body = doc.body {
            attrStr.append(NSAttributedString(string: "REQUEST BODY (JSON)\n", attributes: [
                .font: DSV2.fontTitleMd,
                .foregroundColor: DSV2.onSurface
            ]))
            attrStr.append(NSAttributedString(string: "\(body)\n\n", attributes: [
                .font: DSV2.fontMonoSm,
                .foregroundColor: DSV2.tertiary
            ]))
        }

        // cURL
        attrStr.append(NSAttributedString(string: "cURL EXAMPLE\n", attributes: [
            .font: DSV2.fontTitleMd,
            .foregroundColor: DSV2.onSurface
        ]))
        attrStr.append(NSAttributedString(string: "\(doc.curl)\n\n", attributes: [
            .font: DSV2.fontMonoSm,
            .foregroundColor: DSV2.tertiary
        ]))

        // Response
        attrStr.append(NSAttributedString(string: "RESPONSE FORMAT\n", attributes: [
            .font: DSV2.fontTitleMd,
            .foregroundColor: DSV2.tertiary
        ]))
        attrStr.append(NSAttributedString(string: "\(doc.response)\n", attributes: [
            .font: DSV2.fontMonoSm,
            .foregroundColor: DSV2.tertiary
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
        case "GET": return DSV2.secondary
        case "POST": return DSV2.tertiary
        case "PUT": return DSV2.primary
        case "DELETE": return DSV2.error
        default: return DSV2.onSurfaceVariant
        }
    }
}
