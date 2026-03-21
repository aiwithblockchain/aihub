import AppKit

final class AIClawHumanViewController: NSViewController {
    private let headerImageView = NSImageView()
    private let headerTitleLabel = NSTextField(labelWithString: "AIClaw")

    private var platformSegmented: SegmentedControl!

    private var messagePlatformSegmented: SegmentedControl!
    private var messageInputView: NSTextView!
    private var messageInputScroll: NSScrollView!

    // 实例选择器
    private var instanceSelector: InstanceSelector!
    private let refreshInstancesButton = NSButton(title: "↻", target: nil, action: #selector(refreshInstancesClicked))
    private var instanceSnapshots: [LocalBridgeGoManager.InstanceSnapshot] = []

    private var resultTextView: NSTextView!
    private var resultScrollView: NSScrollView!
    
    override func loadView() {
        view = NSView()
        view.wantsLayer = true
        view.layer?.backgroundColor = DSV2.surface.cgColor
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        
        NotificationCenter.default.addObserver(self, selector: #selector(handleQueryResult(_:)), name: NSNotification.Name("QueryAITabsStatusReceived"), object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(handleSendMessageResult(_:)), name: NSNotification.Name("SendMessageReceived"), object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(handleNavigateResult(_:)), name: NSNotification.Name("NavigateToPlatformReceived"), object: nil)

        loadInstances()
    }
    
    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    private func loadInstances() {
        let all = AppDelegate.shared?.getConnectedInstances() ?? []
        instanceSnapshots = all.filter { $0.clientName == "aiClaw" }

        updateInstanceLabel()
    }

    private func updateInstanceLabel() {
        let instances = instanceSnapshots.map { (id: $0.instanceId, isTemporary: $0.isTemporary) }
        instanceSelector.setInstances(instances)
    }

    private func selectedInstanceId() -> String? {
        return instanceSelector.getSelectedInstanceId()
    }

    @objc private func refreshInstancesClicked() {
        loadInstances()
    }

    private func setupUI() {
        // Header Icon
        if #available(macOS 11.0, *) {
            headerImageView.image = NSImage(systemSymbolName: "cpu", accessibilityDescription: nil)
            headerImageView.symbolConfiguration = NSImage.SymbolConfiguration(pointSize: 20, weight: .semibold)
            headerImageView.contentTintColor = DSV2.primary
        }
        headerImageView.translatesAutoresizingMaskIntoConstraints = false

        // Header Title
        headerTitleLabel.font = DSV2.fontTitleLg
        headerTitleLabel.textColor = DSV2.onSurface

        // Platform segmented control
        platformSegmented = DSV2.makeSegmentedControl(items: ["All Platforms", "ChatGPT", "Gemini", "Grok"], target: self, action: #selector(platformChanged))
        platformSegmented.translatesAutoresizingMaskIntoConstraints = false

        // Query button - use gradient style
        let queryButton = DSV2.makeGradientButton(title: "查询状态", target: self, action: #selector(queryClicked))

        // Terminal view
        let terminal = DSV2.makeTerminalTextView()
        resultScrollView = terminal.scrollView
        resultTextView = terminal.textView

        // 添加初始文本以便看到终端区域
        resultTextView.string = "Terminal ready...\n"

        // Message platform segmented control
        messagePlatformSegmented = DSV2.makeSegmentedControl(items: ["chatgpt", "gemini", "grok"], target: self, action: #selector(messagePlatformChanged))
        messagePlatformSegmented.translatesAutoresizingMaskIntoConstraints = false

        // Message input with DSV2 styling
        messageInputScroll = NSTextView.scrollableTextView()
        messageInputView = messageInputScroll.documentView as? NSTextView
        messageInputView.isEditable = true
        messageInputView.font = DSV2.fontMonoMd
        messageInputView.textColor = DSV2.onSurface
        messageInputView.backgroundColor = DSV2.surfaceContainerLowest
        messageInputView.textContainerInset = NSSize(width: DSV2.spacing4, height: DSV2.spacing4)
        messageInputView.insertionPointColor = DSV2.primary

        messageInputScroll.borderType = .noBorder
        messageInputScroll.wantsLayer = true
        messageInputScroll.layer?.cornerRadius = DSV2.radiusCard
        messageInputScroll.layer?.backgroundColor = DSV2.surfaceContainerLowest.cgColor
        messageInputScroll.layer?.borderWidth = 1
        messageInputScroll.layer?.borderColor = DSV2.outlineVariant.withAlphaComponent(0.15).cgColor
        messageInputScroll.translatesAutoresizingMaskIntoConstraints = false
        messageInputScroll.heightAnchor.constraint(equalToConstant: 100).isActive = true

        // Action buttons
        let sendButton = DSV2.makeGradientButton(title: "发送消息", target: self, action: #selector(sendMessageClicked))
        let newConvButton = DSV2.makeSecondaryButton(title: "新建对话", target: self, action: #selector(newConversationClicked))

        // Navigate button - styled as tertiary button with home icon
        let navigateButton = NSButton(title: "跳转首页", target: self, action: #selector(navigateToHomeClicked))
        navigateButton.wantsLayer = true
        navigateButton.isBordered = false
        navigateButton.bezelStyle = .rounded
        navigateButton.layer?.backgroundColor = DSV2.surfaceContainerLowest.cgColor
        navigateButton.layer?.cornerRadius = DSV2.radiusButton
        navigateButton.layer?.borderWidth = 1
        navigateButton.layer?.borderColor = DSV2.outlineVariant.withAlphaComponent(0.15).cgColor

        let navAttributes: [NSAttributedString.Key: Any] = [
            .foregroundColor: DSV2.onSurfaceVariant,
            .font: DSV2.fontLabelMd
        ]
        navigateButton.attributedTitle = NSAttributedString(string: "跳转首页", attributes: navAttributes)
        navigateButton.translatesAutoresizingMaskIntoConstraints = false
        navigateButton.heightAnchor.constraint(equalToConstant: 36).isActive = true

        if #available(macOS 11.0, *) {
            navigateButton.image = NSImage(systemSymbolName: "house", accessibilityDescription: nil)
            navigateButton.imagePosition = .imageLeading
            navigateButton.contentTintColor = DSV2.onSurfaceVariant
        }

        // Instance selector - use uppercase label per design system
        instanceSelector = DSV2.makeInstanceSelector(title: "TARGET INSTANCE", target: self, action: #selector(instanceChanged))

        refreshInstancesButton.bezelStyle = .rounded
        refreshInstancesButton.target = self
        refreshInstancesButton.wantsLayer = true
        refreshInstancesButton.isBordered = false
        refreshInstancesButton.layer?.backgroundColor = DSV2.surface.cgColor
        refreshInstancesButton.layer?.cornerRadius = DSV2.radiusButton
        refreshInstancesButton.layer?.borderWidth = 1
        refreshInstancesButton.layer?.borderColor = DSV2.outlineVariant.withAlphaComponent(0.2).cgColor

        // 设置按钮文字颜色
        let refreshAttributes: [NSAttributedString.Key: Any] = [
            .foregroundColor: DSV2.onSurfaceVariant,
            .font: DSV2.fontLabelMd
        ]
        refreshInstancesButton.attributedTitle = NSAttributedString(string: "↻", attributes: refreshAttributes)

        refreshInstancesButton.translatesAutoresizingMaskIntoConstraints = false
        refreshInstancesButton.widthAnchor.constraint(equalToConstant: 28).isActive = true
        refreshInstancesButton.heightAnchor.constraint(equalToConstant: 28).isActive = true

        // Labels with DSV2 typography
        let platformLabel = NSTextField(labelWithString: "PLATFORM")
        platformLabel.font = DSV2.fontLabelSm
        platformLabel.textColor = DSV2.onSurfaceTertiary

        let msgPlatformLabel = NSTextField(labelWithString: "PLATFORM")
        msgPlatformLabel.font = DSV2.fontLabelSm
        msgPlatformLabel.textColor = DSV2.onSurfaceTertiary

        // Section headers
        let queryHeader = makeSectionHeader("状态查询")
        let messageHeader = makeSectionHeader("发送消息")

        // Layout containers
        let platformStack = NSStackView(views: [platformLabel, platformSegmented])
        platformStack.orientation = .vertical
        platformStack.alignment = .leading
        platformStack.spacing = DSV2.spacing2

        let msgPlatformStack = NSStackView(views: [msgPlatformLabel, messagePlatformSegmented])
        msgPlatformStack.orientation = .vertical
        msgPlatformStack.alignment = .leading
        msgPlatformStack.spacing = DSV2.spacing2

        let instanceRow = NSStackView(views: [instanceSelector, refreshInstancesButton])
        instanceRow.orientation = .horizontal
        instanceRow.alignment = .centerY
        instanceRow.spacing = DSV2.spacing2

        let headerLeft = NSStackView(views: [headerImageView, headerTitleLabel])
        headerLeft.orientation = .horizontal
        headerLeft.spacing = DSV2.spacing2
        headerLeft.alignment = .centerY

        let pageHeader = NSStackView(views: [headerLeft, NSView(), instanceRow])
        pageHeader.orientation = .horizontal
        pageHeader.alignment = .centerY
        pageHeader.translatesAutoresizingMaskIntoConstraints = false

        let actionButtonRow = NSStackView(views: [sendButton, newConvButton])
        actionButtonRow.orientation = .horizontal
        actionButtonRow.spacing = DSV2.spacing2
        actionButtonRow.distribution = .fillEqually

        let navigateRow = NSStackView(views: [navigateButton])
        navigateRow.orientation = .horizontal

        // Left control panel with card background - using proper DSV2 styling
        let leftCard = NSView()
        leftCard.wantsLayer = true
        leftCard.layer?.backgroundColor = DSV2.surfaceContainerLow.cgColor
        leftCard.layer?.cornerRadius = DSV2.radiusCard
        leftCard.layer?.borderWidth = 1
        leftCard.layer?.borderColor = DSV2.outlineVariant.withAlphaComponent(0.15).cgColor
        leftCard.translatesAutoresizingMaskIntoConstraints = false

        let leftStack = NSStackView(views: [
            queryHeader,
            platformStack,
            queryButton,
            messageHeader,
            msgPlatformStack,
            messageInputScroll,
            actionButtonRow,
            navigateRow
        ])
        leftStack.orientation = .vertical
        leftStack.alignment = .leading
        leftStack.spacing = DSV2.spacing4
        leftStack.translatesAutoresizingMaskIntoConstraints = false

        leftCard.addSubview(leftStack)

        view.addSubview(pageHeader)
        view.addSubview(leftCard)
        view.addSubview(resultScrollView)

        // 确保终端视图在最上层，并应用高亮滚动条
        resultScrollView.wantsLayer = true
        DSV2.applyBrightScroller(to: messageInputScroll)
        DSV2.applyBrightScroller(to: resultScrollView)

        NSLayoutConstraint.activate([
            pageHeader.topAnchor.constraint(equalTo: view.topAnchor, constant: DSV2.spacing6),
            pageHeader.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: DSV2.spacing6),
            pageHeader.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -DSV2.spacing6),

            leftCard.topAnchor.constraint(equalTo: pageHeader.bottomAnchor, constant: DSV2.spacing6),
            leftCard.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: DSV2.spacing6),
            leftCard.widthAnchor.constraint(equalToConstant: 320),
            leftCard.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -DSV2.spacing6),

            leftStack.topAnchor.constraint(equalTo: leftCard.topAnchor, constant: DSV2.spacing4),
            leftStack.leadingAnchor.constraint(equalTo: leftCard.leadingAnchor, constant: DSV2.spacing4),
            leftStack.trailingAnchor.constraint(equalTo: leftCard.trailingAnchor, constant: -DSV2.spacing4),
            leftStack.bottomAnchor.constraint(lessThanOrEqualTo: leftCard.bottomAnchor, constant: -DSV2.spacing4),

            platformStack.widthAnchor.constraint(equalTo: leftStack.widthAnchor),
            platformSegmented.widthAnchor.constraint(equalTo: platformStack.widthAnchor),
            msgPlatformStack.widthAnchor.constraint(equalTo: leftStack.widthAnchor),
            messagePlatformSegmented.widthAnchor.constraint(equalTo: msgPlatformStack.widthAnchor),
            queryButton.widthAnchor.constraint(equalTo: leftStack.widthAnchor),
            actionButtonRow.widthAnchor.constraint(equalTo: leftStack.widthAnchor),
            navigateRow.widthAnchor.constraint(equalTo: leftStack.widthAnchor),
            navigateButton.widthAnchor.constraint(equalTo: navigateRow.widthAnchor),

            resultScrollView.topAnchor.constraint(equalTo: pageHeader.bottomAnchor, constant: DSV2.spacing6),
            resultScrollView.leadingAnchor.constraint(equalTo: leftCard.trailingAnchor, constant: DSV2.spacing4),
            resultScrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -DSV2.spacing6),
            resultScrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -DSV2.spacing6)
        ])
    }

    private func makeSectionHeader(_ text: String) -> NSTextField {
        let label = NSTextField(labelWithString: text.uppercased())
        label.font = DSV2.fontLabelSm
        label.textColor = DSV2.onSurfaceTertiary
        return label
    }

    @objc private func platformChanged() {
        // 平台选择改变时的处理
    }

    @objc private func messagePlatformChanged() {
        // 消息平台选择改变时的处理
    }

    @objc private func instanceChanged() {
        // 实例选择改变时的处理
    }
    
    @objc private func queryClicked() {
        let selectedPlatform = platformSegmented.indexOfSelectedItem() // 0=All, 1=ChatGPT, 2=Gemini, 3=Grok

        DispatchQueue.main.async {
            let platformNames = ["All Platforms", "ChatGPT", "Gemini", "Grok"]
            self.resultTextView.string = "Querying \(platformNames[selectedPlatform]) status...\n"
        }


        UserDefaults.standard.set(selectedPlatform, forKey: "aiClawQueryPlatformFilter")
        AppDelegate.shared?.sendQueryAITabsStatus(instanceId: selectedInstanceId())
    }
    
    @objc private func sendMessageClicked() {
        let platform = messagePlatformSegmented.titleOfSelectedItem() ?? "chatgpt"
        let prompt = messageInputView.string.trimmingCharacters(in: .whitespacesAndNewlines)
        
        if prompt.isEmpty {
            resultTextView.string = "Error: Prompt cannot be empty"
            return
        }
        
        DispatchQueue.main.async {
            self.resultTextView.string = "Sending message to \(platform)...\n"
        }
        
        AppDelegate.shared?.sendSendMessage(platform: platform, prompt: prompt, instanceId: selectedInstanceId())
    }

    @objc private func newConversationClicked() {
        let platform = messagePlatformSegmented.titleOfSelectedItem() ?? "chatgpt"

        if platform != "chatgpt" {
            resultTextView.string = "Error: New conversation is currently supported only for chatgpt"
            return
        }

        DispatchQueue.main.async {
            self.resultTextView.string = "Creating new conversation on \(platform)...\n"
        }

        AppDelegate.shared?.sendNewConversation(platform: platform, instanceId: selectedInstanceId())
    }

    @objc private func navigateToHomeClicked() {
        let platform = messagePlatformSegmented.titleOfSelectedItem() ?? "chatgpt"

        DispatchQueue.main.async {
            self.resultTextView.string = "Navigating \(platform) tabs to home page...\n"
        }

        AppDelegate.shared?.sendNavigateToPlatform(platform: platform, instanceId: selectedInstanceId())
    }

    @objc private func handleSendMessageResult(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let jsonString = userInfo["dataString"] as? String else { return }
        let resultTitle = (userInfo["resultTitle"] as? String) ?? "Send Message Result"
        
        DispatchQueue.main.async {
            self.resultTextView.string = "--- \(resultTitle) ---\n\(jsonString)"
        }
    }
    
    @objc private func handleQueryResult(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let jsonString = userInfo["dataString"] as? String else { return }
        
        let filterIndex = UserDefaults.standard.integer(forKey: "aiClawQueryPlatformFilter")
        
        DispatchQueue.main.async {
            if filterIndex == 0 {
                self.resultTextView.string = jsonString
            } else {
                let platformNames = ["", "chatgpt", "gemini", "grok"]
                let targetPlatform = platformNames[filterIndex]
                
                if let data = jsonString.data(using: .utf8),
                   let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    
                    if jsonString.starts(with: "Error:") {
                        self.resultTextView.string = jsonString
                        return
                    }
                    
                    var filtered = json
                    if let tabs = json["tabs"] as? [[String: Any]] {
                        let filteredTabs = tabs.filter { ($0["platform"] as? String) == targetPlatform }
                        filtered["tabs"] = filteredTabs
                        filtered["count"] = filteredTabs.count
                    }
                    
                    if let platforms = json["platforms"] as? [String: [String: Any]] {
                        if let status = platforms[targetPlatform] {
                            filtered["platformQueried"] = targetPlatform
                            filtered["hasTabs"] = status["hasTab"] as? Bool ?? false
                            filtered["isLoggedIn"] = status["isLoggedIn"] as? Bool ?? false
                        }
                    }
                    
                    if let resultData = try? JSONSerialization.data(withJSONObject: filtered, options: .prettyPrinted),
                       let resultString = String(data: resultData, encoding: .utf8) {
                        self.resultTextView.string = resultString
                    } else {
                        self.resultTextView.string = jsonString
                    }
                } else {
                    self.resultTextView.string = jsonString
                }
            }
        }
    }

    @objc private func handleNavigateResult(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let jsonString = userInfo["dataString"] as? String else { return }

        DispatchQueue.main.async {
            self.resultTextView.string = "--- Navigate Result ---\n\(jsonString)"
        }
    }
}

final class AIClawBotViewController: NSViewController {
    private let headerImageView = NSImageView()
    private let titleLabel = NSTextField(labelWithString: "AIClaw")
    private let subtitleLabel = NSTextField(labelWithString: "API ENDPOINTS")
    private let scrollView = NSScrollView()
    private let stackView = NSStackView()

    override func loadView() {
        view = NSView()
        view.wantsLayer = true
        view.layer?.backgroundColor = DSV2.surface.cgColor
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
    }

    private func setupUI() {
        // Header Icon
        if #available(macOS 11.0, *) {
            headerImageView.image = NSImage(systemSymbolName: "cpu", accessibilityDescription: nil)
            headerImageView.symbolConfiguration = NSImage.SymbolConfiguration(pointSize: 20, weight: .semibold)
            headerImageView.contentTintColor = DSV2.primary
        }
        headerImageView.translatesAutoresizingMaskIntoConstraints = false

        // Title
        titleLabel.font = DSV2.fontTitleLg
        titleLabel.textColor = DSV2.onSurface
        titleLabel.translatesAutoresizingMaskIntoConstraints = false

        // Subtitle
        subtitleLabel.font = DSV2.fontLabelSm
        subtitleLabel.textColor = DSV2.onSurfaceTertiary
        subtitleLabel.translatesAutoresizingMaskIntoConstraints = false

        // Header layout
        let headerLeft = NSStackView(views: [headerImageView, titleLabel])
        headerLeft.orientation = .horizontal
        headerLeft.spacing = DSV2.spacing2
        headerLeft.alignment = .centerY

        let headerStack = NSStackView(views: [headerLeft, subtitleLabel])
        headerStack.orientation = .vertical
        headerStack.spacing = 4
        headerStack.alignment = .leading
        headerStack.translatesAutoresizingMaskIntoConstraints = false

        // Stack view for cards
        stackView.orientation = .vertical
        stackView.alignment = .leading
        stackView.spacing = DSV2.spacing4
        stackView.translatesAutoresizingMaskIntoConstraints = false

        // Scroll view
        scrollView.hasVerticalScroller = true
        scrollView.drawsBackground = false
        scrollView.documentView = stackView
        scrollView.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(headerStack)
        view.addSubview(scrollView)
        
        DSV2.applyBrightScroller(to: scrollView)

        NSLayoutConstraint.activate([
            headerStack.topAnchor.constraint(equalTo: view.topAnchor, constant: DSV2.spacing6),
            headerStack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: DSV2.spacing6),
            headerStack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -DSV2.spacing6),

            scrollView.topAnchor.constraint(equalTo: headerStack.bottomAnchor, constant: DSV2.spacing6),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: DSV2.spacing6),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -DSV2.spacing6),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -DSV2.spacing6),

            stackView.leadingAnchor.constraint(equalTo: scrollView.leadingAnchor),
            stackView.trailingAnchor.constraint(equalTo: scrollView.trailingAnchor),
            stackView.topAnchor.constraint(equalTo: scrollView.topAnchor)
        ])

        addEndpoints()
    }
    
    private func addEndpoints() {
        let statusCard = makeEndpointCard(
            method: "GET",
            path: "/api/v1/ai/status",
            description: "查询 AI 平台 Tab 状态",
            curl: "curl -X GET http://127.0.0.1:10088/api/v1/ai/status"
        )
        
        let messageCard = makeEndpointCard(
            method: "POST",
            path: "/api/v1/ai/message",
            description: "Sends a message to a specific AI platform.",
            curl: """
            curl -X POST http://127.0.0.1:10088/api/v1/ai/message \\
                 -H "Content-Type: application/json" \\
                 -d '{"platform":"chatgpt", "prompt":"Hello"}'
            """
        )
        
        let newConvCard = makeEndpointCard(
            method: "POST",
            path: "/api/v1/ai/new_conversation",
            description: "Creates a new AI conversation. Currently intended for ChatGPT.",
            curl: """
            curl -X POST http://127.0.0.1:10088/api/v1/ai/new_conversation \\
                 -H "Content-Type: application/json" \\
                 -d '{"platform":"chatgpt"}'
            """
        )

        let navigateCard = makeEndpointCard(
            method: "POST",
            path: "/api/v1/ai/navigate",
            description: "Navigate all tabs of a specific AI platform to its home page.",
            curl: """
            curl -X POST http://127.0.0.1:10088/api/v1/ai/navigate \\
                 -H "Content-Type: application/json" \\
                 -d '{"platform":"chatgpt"}'
            """
        )

        stackView.addArrangedSubview(statusCard)
        stackView.addArrangedSubview(messageCard)
        stackView.addArrangedSubview(newConvCard)
        stackView.addArrangedSubview(navigateCard)
        
        statusCard.widthAnchor.constraint(equalTo: stackView.widthAnchor).isActive = true
        messageCard.widthAnchor.constraint(equalTo: stackView.widthAnchor).isActive = true
        newConvCard.widthAnchor.constraint(equalTo: stackView.widthAnchor).isActive = true
        navigateCard.widthAnchor.constraint(equalTo: stackView.widthAnchor).isActive = true
    }
    
    private func makeEndpointCard(method: String, path: String, description: String, curl: String) -> NSView {
        let card = NSView()
        card.wantsLayer = true
        card.layer?.cornerRadius = DSV2.radiusCard
        card.layer?.backgroundColor = DSV2.surfaceContainerLow.cgColor
        card.layer?.borderColor = DSV2.outlineVariant.withAlphaComponent(0.15).cgColor
        card.layer?.borderWidth = 1.0

        // Method badge using DSV2
        let methodBadge = DSV2.makeMethodTag(method: method)

        // Path label
        let pathLabel = NSTextField(labelWithString: path)
        pathLabel.font = DSV2.fontMonoMd
        pathLabel.textColor = DSV2.onSurface
        pathLabel.translatesAutoresizingMaskIntoConstraints = false

        // Description
        let descLabel = NSTextField(wrappingLabelWithString: description)
        descLabel.font = DSV2.fontBodyMd
        descLabel.textColor = DSV2.onSurfaceVariant
        descLabel.translatesAutoresizingMaskIntoConstraints = false

        // Curl code block with terminal styling
        let curlContainer = NSView()
        curlContainer.wantsLayer = true
        curlContainer.layer?.backgroundColor = DSV2.surfaceContainerLowest.cgColor
        curlContainer.layer?.cornerRadius = DSV2.radiusInput
        curlContainer.layer?.borderWidth = 1
        curlContainer.layer?.borderColor = DSV2.outlineVariant.withAlphaComponent(0.1).cgColor
        curlContainer.translatesAutoresizingMaskIntoConstraints = false

        let curlLabel = NSTextField(wrappingLabelWithString: curl)
        curlLabel.font = DSV2.fontMonoSm
        curlLabel.textColor = DSV2.tertiary
        curlLabel.backgroundColor = .clear
        curlLabel.drawsBackground = false
        curlLabel.isSelectable = true
        curlLabel.translatesAutoresizingMaskIntoConstraints = false

        curlContainer.addSubview(curlLabel)

        // Copy button with secondary style
        let actionWrapper = TargetActionWrapper(text: curl)
        let copyBtn = DSV2.makeSecondaryButton(title: "复制", target: actionWrapper, action: #selector(actionWrapper.performCopy))
        if #available(macOS 11.0, *) {
            copyBtn.image = NSImage(systemSymbolName: "doc.on.doc", accessibilityDescription: nil)
        }

        let topRow = NSStackView(views: [methodBadge, pathLabel])
        topRow.orientation = NSUserInterfaceLayoutOrientation.horizontal
        topRow.spacing = DSV2.spacing2
        topRow.alignment = .centerY

        let bottomRow = NSStackView(views: [NSView(), copyBtn])
        bottomRow.orientation = NSUserInterfaceLayoutOrientation.horizontal

        let cardStack = NSStackView(views: [topRow, descLabel, curlContainer, bottomRow])
        cardStack.orientation = NSUserInterfaceLayoutOrientation.vertical
        cardStack.alignment = NSLayoutConstraint.Attribute.leading
        cardStack.spacing = DSV2.spacing4
        cardStack.translatesAutoresizingMaskIntoConstraints = false

        card.addSubview(cardStack)

        NSLayoutConstraint.activate([
            curlLabel.topAnchor.constraint(equalTo: curlContainer.topAnchor, constant: DSV2.spacing2),
            curlLabel.leadingAnchor.constraint(equalTo: curlContainer.leadingAnchor, constant: DSV2.spacing2),
            curlLabel.trailingAnchor.constraint(equalTo: curlContainer.trailingAnchor, constant: -DSV2.spacing2),
            curlLabel.bottomAnchor.constraint(equalTo: curlContainer.bottomAnchor, constant: -DSV2.spacing2),

            cardStack.topAnchor.constraint(equalTo: card.topAnchor, constant: DSV2.spacing4),
            cardStack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: DSV2.spacing4),
            cardStack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -DSV2.spacing4),
            cardStack.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -DSV2.spacing4),

            topRow.widthAnchor.constraint(equalTo: cardStack.widthAnchor),
            descLabel.widthAnchor.constraint(equalTo: cardStack.widthAnchor),
            curlContainer.widthAnchor.constraint(equalTo: cardStack.widthAnchor),
            bottomRow.widthAnchor.constraint(equalTo: cardStack.widthAnchor)
        ])

        return card
    }
}

// Helper to handle copy action from button
private class TargetActionWrapper: NSObject {
    let text: String
    init(text: String) { self.text = text }
    @objc func performCopy() {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
    }
}
