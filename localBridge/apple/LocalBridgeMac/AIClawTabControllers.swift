import AppKit

final class AIClawHumanViewController: NSViewController {
    private let headerImageView = NSImageView()
    private let headerTitleLabel = NSTextField(labelWithString: "AIClaw")
    
    private let platformPopup = NSPopUpButton(frame: .zero, pullsDown: false)
    private let queryButton = NSButton(title: "查询状态", target: nil, action: #selector(queryClicked))
    
    private let messagePlatformPopup = NSPopUpButton(frame: .zero, pullsDown: false)
    private var messageInputView: NSTextView!
    private var messageInputScroll: NSScrollView!
    private let sendMessageButton = NSButton(title: "发送消息", target: nil, action: #selector(sendMessageClicked))
    private let newConversationButton = NSButton(title: "新建对话", target: nil, action: #selector(newConversationClicked))

    // 实例选择器
    private let instanceLabel = NSTextField(labelWithString: "目标实例:")
    private let instancePopupLabel = NSPopUpButton(frame: .zero, pullsDown: false) // Rename to avoid conflict with existing platformPopup
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

        loadInstances()
    }
    
    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    private func loadInstances() {
        let all = AppDelegate.shared?.getConnectedInstances() ?? []
        instanceSnapshots = all.filter { $0.clientName == "aiClaw" }

        instancePopupLabel.removeAllItems()
        if instanceSnapshots.isEmpty {
            instancePopupLabel.addItem(withTitle: "无可用实例（自动选择）")
        } else {
            for snap in instanceSnapshots {
                let idShort = String(snap.instanceId.prefix(8))
                let label = snap.isTemporary
                    ? "[\(idShort)...] (旧版)"
                    : "[\(idShort)...]"
                instancePopupLabel.addItem(withTitle: label)
            }
        }
    }

    private func selectedInstanceId() -> String? {
        guard !instanceSnapshots.isEmpty else { return nil }
        let idx = instancePopupLabel.indexOfSelectedItem
        guard instanceSnapshots.indices.contains(idx) else { return nil }
        return instanceSnapshots[idx].instanceId
    }

    @objc private func refreshInstancesClicked() {
        loadInstances()
    }

    private func setupUI() {
        if #available(macOS 11.0, *) {
            headerImageView.image = NSImage(systemSymbolName: "cpu", accessibilityDescription: nil)
            headerImageView.symbolConfiguration = NSImage.SymbolConfiguration(pointSize: 20, weight: .semibold)
            headerImageView.contentTintColor = DS.colorPrimary
        }
        headerImageView.translatesAutoresizingMaskIntoConstraints = false
        
        headerTitleLabel.font = NSFont.systemFont(ofSize: 18, weight: .semibold)
        headerTitleLabel.textColor = DS.colorTextPrimary
        
        // Platform selector
        platformPopup.addItems(withTitles: ["All Platforms", "ChatGPT", "Gemini", "Grok"])
        platformPopup.translatesAutoresizingMaskIntoConstraints = false
        
        queryButton.bezelStyle = .rounded
        queryButton.target = self
        
        // 使用 DSV2 终端视图工厂
        let terminal = DSV2.makeTerminalTextView()
        resultScrollView = terminal.scrollView
        resultTextView = terminal.textView
        
        resultScrollView.borderType = .noBorder
        resultScrollView.wantsLayer = true
        resultScrollView.layer?.cornerRadius = DS.radiusM
        resultScrollView.layer?.backgroundColor = NSColor(white: 0.08, alpha: 1.0).cgColor
        resultScrollView.translatesAutoresizingMaskIntoConstraints = false
        
        let platformLabel = NSTextField(labelWithString: "选择平台:")
        let platformRow = NSStackView(views: [platformLabel, platformPopup])
        platformRow.orientation = .horizontal
        platformRow.alignment = .centerY
        platformRow.spacing = 8
        
        // Send Message UI
        messagePlatformPopup.addItems(withTitles: ["chatgpt", "gemini", "grok"])
        messagePlatformPopup.translatesAutoresizingMaskIntoConstraints = false
        
        messageInputScroll = NSTextView.scrollableTextView()
        messageInputView = messageInputScroll.documentView as? NSTextView
        messageInputView.isEditable = true
        messageInputView.font = DS.fontBody
        messageInputView.textContainerInset = NSSize(width: DS.spacingS, height: DS.spacingS)
        messageInputScroll.borderType = .bezelBorder
        messageInputScroll.translatesAutoresizingMaskIntoConstraints = false
        messageInputScroll.heightAnchor.constraint(equalToConstant: 80).isActive = true
        
        sendMessageButton.bezelStyle = .rounded
        sendMessageButton.target = self
        newConversationButton.bezelStyle = .rounded
        newConversationButton.target = self
        
        let msgPlatformLabel = NSTextField(labelWithString: "平台:")
        let msgPlatformRow = NSStackView(views: [msgPlatformLabel, messagePlatformPopup])
        msgPlatformRow.orientation = .horizontal
        msgPlatformRow.spacing = 8
        
        // 实例选择器 UI
        instancePopupLabel.translatesAutoresizingMaskIntoConstraints = false
        refreshInstancesButton.bezelStyle = .rounded
        refreshInstancesButton.target = self
        refreshInstancesButton.translatesAutoresizingMaskIntoConstraints = false
        refreshInstancesButton.widthAnchor.constraint(equalToConstant: 28).isActive = true

        let instanceRow = NSStackView(views: [instanceLabel, instancePopupLabel, refreshInstancesButton])
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

        let actionButtonRow = NSStackView(views: [sendMessageButton, newConversationButton])
        actionButtonRow.orientation = .horizontal
        actionButtonRow.spacing = 8

        let leftStack = NSStackView(views: [
            DS.makeSectionHeader("状态查询"),
            platformRow,
            queryButton,
            DS.makeSectionHeader("发送消息"),
            msgPlatformRow,
            messageInputScroll,
            actionButtonRow
        ])
        leftStack.orientation = .vertical
        leftStack.alignment = .leading
        leftStack.spacing = 15
        leftStack.translatesAutoresizingMaskIntoConstraints = false
        
        view.addSubview(pageHeader)
        view.addSubview(leftStack)
        view.addSubview(resultScrollView)
        
        NSLayoutConstraint.activate([
            pageHeader.topAnchor.constraint(equalTo: view.topAnchor, constant: 20),
            pageHeader.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            pageHeader.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            
            leftStack.topAnchor.constraint(equalTo: pageHeader.bottomAnchor, constant: 24),
            leftStack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            leftStack.widthAnchor.constraint(equalToConstant: 260),
            
            resultScrollView.topAnchor.constraint(equalTo: leftStack.topAnchor),
            resultScrollView.leadingAnchor.constraint(equalTo: leftStack.trailingAnchor, constant: 20),
            resultScrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            resultScrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -20)
        ])
    }
    
    @objc private func queryClicked() {
        let selectedPlatform = platformPopup.indexOfSelectedItem // 0=All, 1=ChatGPT, 2=Gemini, 3=Grok
        
        DispatchQueue.main.async {
            let platformNames = ["All Platforms", "ChatGPT", "Gemini", "Grok"]
            self.resultTextView.string = "Querying \(platformNames[selectedPlatform]) status...\n"
        }
        
        
        UserDefaults.standard.set(selectedPlatform, forKey: "aiClawQueryPlatformFilter")
        AppDelegate.shared?.sendQueryAITabsStatus(instanceId: selectedInstanceId())
    }
    
    @objc private func sendMessageClicked() {
        let platform = messagePlatformPopup.titleOfSelectedItem ?? "chatgpt"
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
        let platform = messagePlatformPopup.titleOfSelectedItem ?? "chatgpt"

        if platform != "chatgpt" {
            resultTextView.string = "Error: New conversation is currently supported only for chatgpt"
            return
        }

        DispatchQueue.main.async {
            self.resultTextView.string = "Creating new conversation on \(platform)...\n"
        }

        AppDelegate.shared?.sendNewConversation(platform: platform, instanceId: selectedInstanceId())
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
}

final class AIClawBotViewController: NSViewController {
    private let titleLabel = NSTextField(labelWithString: "AIClaw - For Claw")
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
        titleLabel.font = DS.fontTitle
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        
        stackView.orientation = .vertical
        stackView.alignment = .leading
        stackView.spacing = DS.spacingM
        stackView.translatesAutoresizingMaskIntoConstraints = false
        
        scrollView.hasVerticalScroller = true
        scrollView.drawsBackground = false
        scrollView.documentView = stackView
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        
        view.addSubview(titleLabel)
        view.addSubview(scrollView)
        
        NSLayoutConstraint.activate([
            titleLabel.topAnchor.constraint(equalTo: view.topAnchor, constant: 20),
            titleLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            
            scrollView.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 20),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -20),
            
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
        
        stackView.addArrangedSubview(statusCard)
        stackView.addArrangedSubview(messageCard)
        stackView.addArrangedSubview(newConvCard)
        
        statusCard.widthAnchor.constraint(equalTo: stackView.widthAnchor).isActive = true
        messageCard.widthAnchor.constraint(equalTo: stackView.widthAnchor).isActive = true
        newConvCard.widthAnchor.constraint(equalTo: stackView.widthAnchor).isActive = true
    }
    
    private func makeEndpointCard(method: String, path: String, description: String, curl: String) -> NSView {
        let card = NSView()
        card.wantsLayer = true
        card.layer?.cornerRadius = DS.radiusM
        card.layer?.backgroundColor = DS.colorSurface.cgColor
        card.layer?.borderColor     = DS.colorBorder.cgColor
        card.layer?.borderWidth     = 1.0

        // method badge
        let methodLabel = NSTextField(labelWithString: method)
        methodLabel.font            = DS.fontSection
        methodLabel.textColor       = .white
        methodLabel.backgroundColor = method == "GET" ? NSColor.systemBlue : NSColor.systemGreen
        methodLabel.drawsBackground = true
        methodLabel.wantsLayer      = true
        methodLabel.layer?.cornerRadius = DS.radiusS
        methodLabel.alignment       = .center
        methodLabel.translatesAutoresizingMaskIntoConstraints = false

        // path
        let pathLabel = NSTextField(labelWithString: path)
        pathLabel.font      = DS.fontMono
        pathLabel.textColor = DS.colorTextPrimary
        pathLabel.translatesAutoresizingMaskIntoConstraints = false

        // description
        let descLabel = NSTextField(wrappingLabelWithString: description)
        descLabel.font      = DS.fontBody
        descLabel.textColor = DS.colorTextSecond
        descLabel.translatesAutoresizingMaskIntoConstraints = false

        // curl block
        let curlLabel = NSTextField(wrappingLabelWithString: curl)
        curlLabel.font           = DS.fontMono
        curlLabel.textColor      = DS.colorTextPrimary
        curlLabel.backgroundColor = DS.colorBackground
        curlLabel.drawsBackground = true
        curlLabel.isSelectable    = true
        curlLabel.translatesAutoresizingMaskIntoConstraints = false

        // copy button
        let copyBtn = NSButton(title: "复制", target: nil, action: nil)
        if #available(macOS 11.0, *) {
            copyBtn.image = NSImage(systemSymbolName: "doc.on.doc", accessibilityDescription: nil)
        }
        copyBtn.bezelStyle = NSButton.BezelStyle.rounded
        copyBtn.translatesAutoresizingMaskIntoConstraints = false

        // Associated data
        let actionWrapper = TargetActionWrapper(text: curl)
        copyBtn.target = actionWrapper
        copyBtn.action = #selector(actionWrapper.performCopy)

        let topRow = NSStackView(views: [methodLabel, pathLabel])
        topRow.orientation = NSUserInterfaceLayoutOrientation.horizontal
        topRow.spacing = 8

        let bottomRow = NSStackView(views: [NSView(), copyBtn])
        bottomRow.orientation = NSUserInterfaceLayoutOrientation.horizontal

        let cardStack = NSStackView(views: [topRow, descLabel, curlLabel, bottomRow])
        cardStack.orientation = NSUserInterfaceLayoutOrientation.vertical
        cardStack.alignment = NSLayoutConstraint.Attribute.leading
        cardStack.spacing = DS.spacingS
        cardStack.translatesAutoresizingMaskIntoConstraints = false
        
        card.addSubview(cardStack)
        
        NSLayoutConstraint.activate([
            methodLabel.widthAnchor.constraint(equalToConstant: 48),
            methodLabel.heightAnchor.constraint(equalToConstant: 20),
            
            cardStack.topAnchor.constraint(equalTo: card.topAnchor, constant: DS.spacingM),
            cardStack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: DS.spacingM),
            cardStack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -DS.spacingM),
            cardStack.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -DS.spacingM),
            
            topRow.widthAnchor.constraint(equalTo: cardStack.widthAnchor),
            descLabel.widthAnchor.constraint(equalTo: cardStack.widthAnchor),
            curlLabel.widthAnchor.constraint(equalTo: cardStack.widthAnchor),
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
