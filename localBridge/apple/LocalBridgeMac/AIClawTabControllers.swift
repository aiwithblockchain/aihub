import AppKit

final class AIClawHumanViewController: NSViewController {
    private let titleLabel = NSTextField(labelWithString: "AIClaw - For Human")
    private let statusLabel = NSTextField(labelWithString: "查询 AI 平台 Tab 状态")
    
    private let platformPopup = NSPopUpButton(frame: .zero, pullsDown: false)
    private let queryButton = NSButton(title: "查询状态", target: nil, action: #selector(queryClicked))
    
    private let messageTitleLabel = NSTextField(labelWithString: "发送消息")
    private let messagePlatformPopup = NSPopUpButton(frame: .zero, pullsDown: false)
    private let messageTextView = NSTextField()
    private let sendMessageButton = NSButton(title: "发送消息", target: nil, action: #selector(sendMessageClicked))
    private let newConversationButton = NSButton(title: "新建对话", target: nil, action: #selector(newConversationClicked))
    
    private var resultTextView: NSTextView!
    private var resultScrollView: NSScrollView!
    
    override func loadView() {
        view = NSView()
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        
        NotificationCenter.default.addObserver(self, selector: #selector(handleQueryResult(_:)), name: NSNotification.Name("QueryAITabsStatusReceived"), object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(handleSendMessageResult(_:)), name: NSNotification.Name("SendMessageReceived"), object: nil)
    }
    
    deinit {
        NotificationCenter.default.removeObserver(self)
    }
    
    private func setupUI() {
        titleLabel.font = .systemFont(ofSize: 20, weight: .bold)
        
        // Platform selector
        platformPopup.addItems(withTitles: ["All Platforms", "ChatGPT", "Gemini", "Grok"])
        platformPopup.translatesAutoresizingMaskIntoConstraints = false
        
        queryButton.bezelStyle = .rounded
        queryButton.target = self
        
        // Setup result text view
        resultScrollView = NSTextView.scrollableTextView()
        resultTextView = resultScrollView.documentView as? NSTextView
        
        resultTextView.isEditable = false
        resultTextView.isSelectable = true
        resultTextView.font = .monospacedSystemFont(ofSize: 13, weight: .regular)
        resultTextView.textContainerInset = NSSize(width: 8, height: 8)
        
        resultScrollView.borderType = .bezelBorder
        resultScrollView.translatesAutoresizingMaskIntoConstraints = false
        
        let platformLabel = NSTextField(labelWithString: "选择平台:")
        let platformRow = NSStackView(views: [platformLabel, platformPopup])
        platformRow.orientation = .horizontal
        platformRow.alignment = .centerY
        platformRow.spacing = 8
        
        // Send Message UI
        messageTitleLabel.font = .systemFont(ofSize: 14, weight: .semibold)
        messagePlatformPopup.addItems(withTitles: ["chatgpt", "gemini", "grok"])
        messagePlatformPopup.translatesAutoresizingMaskIntoConstraints = false
        
        messageTextView.placeholderString = "输入消息内容..."
        messageTextView.translatesAutoresizingMaskIntoConstraints = false
        
        sendMessageButton.bezelStyle = .rounded
        sendMessageButton.target = self
        newConversationButton.bezelStyle = .rounded
        newConversationButton.target = self
        
        let msgPlatformLabel = NSTextField(labelWithString: "平台:")
        let msgPlatformRow = NSStackView(views: [msgPlatformLabel, messagePlatformPopup])
        msgPlatformRow.orientation = .horizontal
        msgPlatformRow.spacing = 8
        
        let separator = NSBox()
        separator.boxType = .separator
        
        let leftStack = NSStackView(views: [
            titleLabel, 
            statusLabel, 
            platformRow, 
            queryButton,
            separator,
            messageTitleLabel,
            msgPlatformRow,
            messageTextView,
            sendMessageButton,
            newConversationButton
        ])
        leftStack.orientation = .vertical
        leftStack.alignment = .leading
        leftStack.spacing = 12
        leftStack.translatesAutoresizingMaskIntoConstraints = false
        leftStack.setCustomSpacing(20, after: queryButton)
        leftStack.setCustomSpacing(20, after: separator)
        
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
    
    @objc private func queryClicked() {
        let selectedPlatform = platformPopup.indexOfSelectedItem // 0=All, 1=ChatGPT, 2=Gemini, 3=Grok
        
        DispatchQueue.main.async {
            let platformNames = ["All Platforms", "ChatGPT", "Gemini", "Grok"]
            self.resultTextView.string = "Querying \(platformNames[selectedPlatform]) status...\n"
        }
        
        // Store which platform we're interested in for filtering results later
        UserDefaults.standard.set(selectedPlatform, forKey: "aiClawQueryPlatformFilter")
        
        AppDelegate.shared?.sendQueryAITabsStatus()
    }
    
    @objc private func sendMessageClicked() {
        let platform = messagePlatformPopup.titleOfSelectedItem ?? "chatgpt"
        let prompt = messageTextView.stringValue
        
        if prompt.isEmpty {
            resultTextView.string = "Error: Prompt cannot be empty"
            return
        }
        
        DispatchQueue.main.async {
            self.resultTextView.string = "Sending message to \(platform)...\n"
        }
        
        AppDelegate.shared?.sendSendMessage(platform: platform, prompt: prompt)
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

        AppDelegate.shared?.sendNewConversation(platform: platform)
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
                // Show everything
                self.resultTextView.string = jsonString
            } else {
                // Parse and filter by platform
                let platformNames = ["", "chatgpt", "gemini", "grok"]
                let targetPlatform = platformNames[filterIndex]
                
                if let data = jsonString.data(using: .utf8),
                   let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    
                    // Check if aiClaw extension is connected
                    if jsonString.starts(with: "Error:") {
                        self.resultTextView.string = jsonString
                        return
                    }
                    
                    // Filter tabs by platform
                    var filtered = json
                    if let tabs = json["tabs"] as? [[String: Any]] {
                        let filteredTabs = tabs.filter { ($0["platform"] as? String) == targetPlatform }
                        filtered["tabs"] = filteredTabs
                        filtered["count"] = filteredTabs.count
                    }
                    
                    // Check platform login status and tab presence
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
    private let apiDocLabel = NSTextField(wrappingLabelWithString: "")
    
    override func loadView() {
        view = NSView()
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
    }
    
    private func setupUI() {
        titleLabel.font = .systemFont(ofSize: 20, weight: .bold)
        
        apiDocLabel.isEditable = false
        apiDocLabel.isSelectable = true
        apiDocLabel.font = .monospacedSystemFont(ofSize: 12, weight: .regular)
        apiDocLabel.stringValue = """
        Usage:
        curl -X GET http://127.0.0.1:8769/api/v1/ai/status
        
        ---
        
        Endpoint: POST http://127.0.0.1:8769/api/v1/ai/message
        Description: Sends a message to a specific AI platform.
        
        Body (JSON):
        {
          "platform": "chatgpt",
          "prompt": "请用一句话介绍你自己",
          "timeoutMs": 210000
        }
        
        Response Example:
        {
          "taskId": "task_123456789",
          "success": true,
          "platform": "chatgpt",
          "content": "AI 回复的内容",
          "executedAt": "2024-03-21T12:00:00Z",
          "durationMs": 1500
        }
        
        Usage:
        curl -X POST http://127.0.0.1:8769/api/v1/ai/message \
             -H "Content-Type: application/json" \
             -d '{"platform":"chatgpt", "prompt":"Hello"}'
        
        ---

        Endpoint: POST http://127.0.0.1:8769/api/v1/ai/new_conversation
        Description: Creates a new AI conversation. Currently intended for ChatGPT.

        Body (JSON):
        {
          "platform": "chatgpt",
          "timeoutMs": 30000
        }

        Usage:
        curl -X POST http://127.0.0.1:8769/api/v1/ai/new_conversation \
             -H "Content-Type: application/json" \
             -d '{"platform":"chatgpt"}'

        ---
        
        Filter by platform (parse tabs[].platform):
          chatgpt | gemini | grok
        """
        
        let stack = NSStackView(views: [titleLabel, apiDocLabel])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 20
        stack.translatesAutoresizingMaskIntoConstraints = false
        
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: view.topAnchor, constant: 20),
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20)
        ])
    }
}
