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
    private let aiConsoleButton = NSButton(title: "AI 控制台", target: nil, action: #selector(aiConsoleClicked))
    
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
        aiConsoleButton.bezelStyle = .rounded
        aiConsoleButton.target = self
        
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
            newConversationButton,
            aiConsoleButton
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
    
    @objc private func aiConsoleClicked() {
        let controller = AIConsoleWindowController.shared
        controller.showWindow(self)
        controller.window?.makeKeyAndOrderFront(self)
        NSApp.activate(ignoringOtherApps: true)
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

// MARK: - AI Configuration
struct AIConfig {
    let icon: String
    let name: String
    let model: String
}

// MARK: - AI Picker Popover
class AIPickerPopover: NSViewController, NSTableViewDataSource, NSTableViewDelegate {
    
    private let tableView = NSTableView()
    private let scrollView = NSScrollView()
    private var onSelect: ((AIConfig) -> Void)?
    weak var popover: NSPopover?
    
    private let configs: [AIConfig] = [
        AIConfig(icon: "🟢", name: "GPT-4", model: "OpenAI"),
        AIConfig(icon: "🔵", name: "Claude 3.5", model: "Anthropic"),
        AIConfig(icon: "🟡", name: "Gemini Pro", model: "Google"),
        AIConfig(icon: "🟠", name: "Grok-2", model: "xAI"),
        AIConfig(icon: "🟣", name: "Llama 3", model: "Meta")
    ]
    
    static func show(relativeTo rect: NSRect, of view: NSView, preferredEdge: NSRectEdge, onSelect: @escaping (AIConfig) -> Void) {
        let picker = AIPickerPopover()
        picker.onSelect = onSelect
        
        let popover = NSPopover()
        popover.contentViewController = picker
        popover.behavior = .transient
        picker.popover = popover
        popover.show(relativeTo: rect, of: view, preferredEdge: preferredEdge)
    }
    
    override func loadView() {
        let view = NSView(frame: NSRect(x: 0, y: 0, width: 250, height: 300))
        self.view = view
        
        scrollView.hasVerticalScroller = true
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scrollView)
        
        tableView.dataSource = self
        tableView.delegate = self
        tableView.headerView = nil
        tableView.backgroundColor = .clear
        
        let column = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("AIColumn"))
        column.width = 240
        tableView.addTableColumn(column)
        
        scrollView.documentView = tableView
        
        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }
    
    func numberOfRows(in tableView: NSTableView) -> Int {
        return configs.count
    }
    
    func tableView(_ tableView: NSTableView, viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
        let config = configs[row]
        let identifier = NSUserInterfaceItemIdentifier("AIConfigCell")
        var cell = tableView.makeView(withIdentifier: identifier, owner: self) as? NSTableCellView
        
        if cell == nil {
            cell = NSTableCellView()
            cell?.identifier = identifier
            
            let stack = NSStackView()
            stack.orientation = .horizontal
            stack.spacing = 8
            stack.alignment = .centerY
            stack.translatesAutoresizingMaskIntoConstraints = false
            cell?.addSubview(stack)
            
            let iconLabel = NSTextField(labelWithString: "")
            let nameLabel = NSTextField(labelWithString: "")
            nameLabel.font = .systemFont(ofSize: 13, weight: .medium)
            let modelLabel = NSTextField(labelWithString: "")
            modelLabel.font = .systemFont(ofSize: 11)
            modelLabel.textColor = .secondaryLabelColor
            
            stack.addArrangedSubview(iconLabel)
            stack.addArrangedSubview(nameLabel)
            stack.addArrangedSubview(NSView()) // Spacer
            stack.addArrangedSubview(modelLabel)
            
            NSLayoutConstraint.activate([
                stack.leadingAnchor.constraint(equalTo: cell!.leadingAnchor, constant: 8),
                stack.trailingAnchor.constraint(equalTo: cell!.trailingAnchor, constant: -8),
                stack.centerYAnchor.constraint(equalTo: cell!.centerYAnchor)
            ])
        }
        
        if let stack = cell?.subviews.first as? NSStackView {
            (stack.arrangedSubviews[0] as? NSTextField)?.stringValue = config.icon
            (stack.arrangedSubviews[1] as? NSTextField)?.stringValue = config.name
            (stack.arrangedSubviews[3] as? NSTextField)?.stringValue = config.model
        }
        
        return cell
    }
    
    func tableView(_ tableView: NSTableView, heightOfRow row: Int) -> CGFloat {
        return 40
    }
    
    func tableViewSelectionDidChange(_ notification: Notification) {
        let row = tableView.selectedRow
        if row >= 0 {
            onSelect?(configs[row])
            popover?.performClose(nil)
        }
    }
}

// MARK: - Manager Panel
class AIConsoleManagerPanel: NSView {
    private let titleLabel = NSTextField(labelWithString: "👔 项目经理")
    private let addButton = NSButton()
    private let addPromptLabel = NSTextField(labelWithString: "添加项目经理 AI")
    private let chatContainer = NSStackView()
    private let aiNameLabel = NSTextField(labelWithString: "")
    private let resetButton = NSButton(title: "重置", target: nil, action: #selector(resetClicked))
    private var chatTextView: NSTextView!
    private var chatScrollView: NSScrollView!
    private let inputField = NSTextField()
    private let sendButton = NSButton(title: "发送", target: nil, action: #selector(sendClicked))
    private var selectedConfig: AIConfig?
    
    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setupUI()
    }
    
    required init?(coder: NSCoder) { fatalError() }
    
    private func setupUI() {
        titleLabel.font = .systemFont(ofSize: 14, weight: .bold)
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        addSubview(titleLabel)
        
        addButton.bezelStyle = .circular
        addButton.title = "＋"
        addButton.font = .systemFont(ofSize: 24)
        addButton.target = self
        addButton.action = #selector(addClicked)
        addButton.translatesAutoresizingMaskIntoConstraints = false
        addSubview(addButton)
        
        addPromptLabel.textColor = .secondaryLabelColor
        addPromptLabel.font = .systemFont(ofSize: 12)
        addPromptLabel.translatesAutoresizingMaskIntoConstraints = false
        addSubview(addPromptLabel)
        
        chatContainer.orientation = .vertical
        chatContainer.spacing = 8
        chatContainer.alignment = .leading
        chatContainer.translatesAutoresizingMaskIntoConstraints = false
        chatContainer.isHidden = true
        addSubview(chatContainer)
        
        let topRow = NSStackView(views: [aiNameLabel, resetButton])
        topRow.orientation = .horizontal
        topRow.spacing = 8
        aiNameLabel.font = .systemFont(ofSize: 12, weight: .medium)
        resetButton.bezelStyle = .inline
        resetButton.controlSize = .small
        resetButton.target = self
        
        chatScrollView = NSTextView.scrollableTextView()
        chatTextView = chatScrollView.documentView as? NSTextView
        chatTextView.isEditable = false
        chatTextView.font = .systemFont(ofSize: 13)
        chatScrollView.borderType = .bezelBorder
        
        inputField.placeholderString = "输入消息..."
        sendButton.bezelStyle = .rounded
        sendButton.target = self
        
        let bottomRow = NSStackView(views: [inputField, sendButton])
        bottomRow.orientation = .horizontal
        bottomRow.spacing = 8
        
        chatContainer.addArrangedSubview(topRow)
        chatContainer.addArrangedSubview(chatScrollView)
        chatContainer.addArrangedSubview(bottomRow)
        
        NSLayoutConstraint.activate([
            titleLabel.topAnchor.constraint(equalTo: topAnchor, constant: 12),
            titleLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),
            addButton.centerXAnchor.constraint(equalTo: centerXAnchor),
            addButton.centerYAnchor.constraint(equalTo: centerYAnchor, constant: -10),
            addButton.widthAnchor.constraint(equalToConstant: 60),
            addButton.heightAnchor.constraint(equalToConstant: 60),
            addPromptLabel.topAnchor.constraint(equalTo: addButton.bottomAnchor, constant: 8),
            addPromptLabel.centerXAnchor.constraint(equalTo: centerXAnchor),
            chatContainer.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 12),
            chatContainer.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),
            chatContainer.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
            chatContainer.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -12),
            bottomRow.widthAnchor.constraint(equalTo: chatContainer.widthAnchor)
        ])
    }
    
    @objc private func addClicked() {
        AIPickerPopover.show(relativeTo: addButton.bounds, of: addButton, preferredEdge: .maxY) { [weak self] config in
            self?.selectedConfig = config
            self?.updateState()
        }
    }
    
    @objc private func resetClicked() {
        selectedConfig = nil
        chatTextView.string = ""
        updateState()
    }
    
    @objc private func sendClicked() {
        let text = inputField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, let config = selectedConfig else { return }
        appendMessage("我: \(text)")
        inputField.stringValue = ""
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { [weak self] in
            self?.appendMessage("[\(config.name)]: 好的，我已收到您的需求，正在为您分析...")
        }
    }
    
    private func appendMessage(_ message: String) {
        let currentText = chatTextView.string
        chatTextView.string = currentText.isEmpty ? message : currentText + "\n" + message
        chatTextView.scrollToEndOfDocument(nil)
    }
    
    private func updateState() {
        let hasConfig = selectedConfig != nil
        addButton.isHidden = hasConfig
        addPromptLabel.isHidden = hasConfig
        chatContainer.isHidden = !hasConfig
        if let config = selectedConfig {
            aiNameLabel.stringValue = "\(config.icon) \(config.name) (\(config.model))"
        }
    }
}

// MARK: - Programmer Panel
class ProgrammerCardView: NSBox {
    private let nameLabel = NSTextField(labelWithString: "")
    private let lastMessageLabel = NSTextField(labelWithString: "")
    private let chatScrollView = NSScrollView()
    private var chatTextView: NSTextView!
    private let inputField = NSTextField()
    private let sendButton = NSButton(title: "发送", target: nil, action: #selector(sendClicked))
    private var programmerName: String = ""
    
    init(name: String, icon: String, model: String) {
        super.init(frame: .zero)
        self.programmerName = name
        self.title = ""
        self.boxType = .custom
        self.borderWidth = 1.0
        self.borderColor = .separatorColor
        self.cornerRadius = 8
        self.fillColor = NSColor.controlBackgroundColor
        setupUI(name: name, icon: icon)
    }
    
    required init?(coder: NSCoder) { fatalError() }
    
    private func setupUI(name: String, icon: String) {
        nameLabel.stringValue = "\(icon) \(name)"
        nameLabel.font = .systemFont(ofSize: 13, weight: .semibold)
        lastMessageLabel.font = .systemFont(ofSize: 11)
        lastMessageLabel.textColor = .secondaryLabelColor
        lastMessageLabel.maximumNumberOfLines = 2
        
        chatScrollView.hasVerticalScroller = true
        chatScrollView.drawsBackground = false
        chatTextView = NSTextView()
        chatTextView.isEditable = false
        chatTextView.font = .systemFont(ofSize: 12)
        chatTextView.backgroundColor = .clear
        chatScrollView.documentView = chatTextView
        
        inputField.placeholderString = "回复..."
        inputField.controlSize = .small
        sendButton.bezelStyle = .rounded
        sendButton.controlSize = .small
        sendButton.target = self
        
        let stack = NSStackView(views: [nameLabel, lastMessageLabel, chatScrollView, inputField, sendButton])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 8
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)
        
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: topAnchor, constant: 12),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -12),
            widthAnchor.constraint(equalToConstant: 220),
            heightAnchor.constraint(equalToConstant: 300),
            chatScrollView.heightAnchor.constraint(equalToConstant: 120),
            inputField.widthAnchor.constraint(equalTo: stack.widthAnchor)
        ])
    }
    
    func setLastMessage(_ message: String) {
        lastMessageLabel.stringValue = message
        appendMessage("[\(programmerName)]: \(message)")
    }
    
    @objc private func sendClicked() {
        let text = inputField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        appendMessage("我: \(text)")
        inputField.stringValue = ""
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { [weak self] in
            guard let self = self else { return }
            let reply = "好的，我知道了，正在处理中..."
            self.appendMessage("[\(self.programmerName)]: \(reply)")
            self.lastMessageLabel.stringValue = reply
        }
    }
    
    private func appendMessage(_ message: String) {
        let currentText = chatTextView.string
        chatTextView.string = currentText.isEmpty ? message : currentText + "\n" + message
        chatTextView.scrollToEndOfDocument(nil)
    }
}

class AIConsoleProgrammerPanel: NSView {
    private let titleLabel = NSTextField(labelWithString: "👨‍💻 程序员")
    private let scrollView = NSScrollView()
    private let cardsStack = NSStackView()
    private let addCardButton = NSButton(title: "➕ 添加程序员 AI", target: nil, action: #selector(addClicked))
    
    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setupUI()
        let card = ProgrammerCardView(name: "Claude 3.5", icon: "🔵", model: "Anthropic")
        card.setLastMessage("已理解需求，开始编写代码...")
        cardsStack.addArrangedSubview(card)
    }
    
    required init?(coder: NSCoder) { fatalError() }
    
    private func setupUI() {
        titleLabel.font = .systemFont(ofSize: 14, weight: .bold)
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        addSubview(titleLabel)
        
        scrollView.hasHorizontalScroller = true
        scrollView.drawsBackground = false
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(scrollView)
        
        cardsStack.orientation = .horizontal
        cardsStack.spacing = 16
        cardsStack.alignment = .top
        cardsStack.translatesAutoresizingMaskIntoConstraints = false
        scrollView.documentView = cardsStack
        
        addCardButton.bezelStyle = .regularSquare
        addCardButton.target = self
        addCardButton.translatesAutoresizingMaskIntoConstraints = false
        addSubview(addCardButton)
        
        NSLayoutConstraint.activate([
            titleLabel.topAnchor.constraint(equalTo: topAnchor, constant: 12),
            titleLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),
            scrollView.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 12),
            scrollView.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),
            scrollView.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
            scrollView.bottomAnchor.constraint(equalTo: addCardButton.topAnchor, constant: -12),
            addCardButton.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),
            addCardButton.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -12),
            addCardButton.heightAnchor.constraint(equalToConstant: 32)
        ])
    }
    
    @objc private func addClicked() {
        AIPickerPopover.show(relativeTo: addCardButton.bounds, of: addCardButton, preferredEdge: .maxY) { [weak self] config in
            let card = ProgrammerCardView(name: config.name, icon: config.icon, model: config.model)
            self?.cardsStack.addArrangedSubview(card)
        }
    }
}

// MARK: - Review Panel
class AIConsoleReviewPanel: NSView {
    private let titleLabel = NSTextField(labelWithString: "✅ 验收")
    private let manualTitleLabel = NSTextField(labelWithString: "人工验收")
    private var manualTextView: NSTextView!
    private var manualScrollView: NSScrollView!
    private let submitButton = NSButton(title: "提交验收", target: nil, action: #selector(submitManualReview))
    private let aiTitleLabel = NSTextField(labelWithString: "AI 验收")
    private let addAIButton = NSButton(title: "＋ 配置 AI 验收", target: nil, action: #selector(addAIReview))
    private let aiStatusLabel = NSTextField(labelWithString: "")
    private let startAIButton = NSButton(title: "开始 AI 验收", target: nil, action: #selector(startAIReview))
    private var aiResultTextView: NSTextView!
    private var aiResultScrollView: NSScrollView!
    private var selectedAI: AIConfig?
    
    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setupUI()
    }
    
    required init?(coder: NSCoder) { fatalError() }
    
    private func setupUI() {
        titleLabel.font = .systemFont(ofSize: 14, weight: .bold)
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        addSubview(titleLabel)
        
        let mainStack = NSStackView()
        mainStack.orientation = .horizontal
        mainStack.distribution = .fillEqually
        mainStack.spacing = 20
        mainStack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(mainStack)
        
        let leftStack = NSStackView()
        leftStack.orientation = .vertical
        leftStack.alignment = .leading
        leftStack.spacing = 10
        manualTitleLabel.font = .systemFont(ofSize: 13, weight: .semibold)
        manualScrollView = NSTextView.scrollableTextView()
        manualTextView = manualScrollView.documentView as? NSTextView
        manualTextView.font = .systemFont(ofSize: 12)
        manualTextView.isEditable = true
        // NSTextView does not have placeholderString
        manualScrollView.borderType = .bezelBorder
        submitButton.bezelStyle = .rounded
        submitButton.target = self
        leftStack.addArrangedSubview(manualTitleLabel)
        leftStack.addArrangedSubview(manualScrollView)
        leftStack.addArrangedSubview(submitButton)
        
        let rightStack = NSStackView()
        rightStack.orientation = .vertical
        rightStack.alignment = .leading
        rightStack.spacing = 10
        aiTitleLabel.font = .systemFont(ofSize: 13, weight: .semibold)
        addAIButton.bezelStyle = .rounded
        addAIButton.target = self
        aiStatusLabel.font = .systemFont(ofSize: 12)
        aiStatusLabel.isHidden = true
        startAIButton.bezelStyle = .rounded
        startAIButton.target = self
        startAIButton.isHidden = true
        aiResultScrollView = NSTextView.scrollableTextView()
        aiResultTextView = aiResultScrollView.documentView as? NSTextView
        aiResultTextView.font = .systemFont(ofSize: 11)
        aiResultTextView.isEditable = false
        aiResultScrollView.borderType = .bezelBorder
        aiResultScrollView.isHidden = true
        rightStack.addArrangedSubview(aiTitleLabel)
        rightStack.addArrangedSubview(addAIButton)
        rightStack.addArrangedSubview(aiStatusLabel)
        rightStack.addArrangedSubview(startAIButton)
        rightStack.addArrangedSubview(aiResultScrollView)
        
        mainStack.addArrangedSubview(leftStack)
        mainStack.addArrangedSubview(rightStack)
        
        NSLayoutConstraint.activate([
            titleLabel.topAnchor.constraint(equalTo: topAnchor, constant: 12),
            titleLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),
            mainStack.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 12),
            mainStack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),
            mainStack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
            mainStack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -12),
            manualScrollView.heightAnchor.constraint(greaterThanOrEqualToConstant: 100),
            aiResultScrollView.heightAnchor.constraint(greaterThanOrEqualToConstant: 100)
        ])
    }
    
    @objc private func submitManualReview() {
        let alert = NSAlert()
        alert.messageText = "提示"
        alert.informativeText = "验收意见已提交"
        alert.addButton(withTitle: "确定")
        alert.runModal()
    }
    
    @objc private func addAIReview() {
        AIPickerPopover.show(relativeTo: addAIButton.bounds, of: addAIButton, preferredEdge: .maxY) { [weak self] config in
            self?.selectedAI = config
            self?.updateAIState()
        }
    }
    
    @objc private func startAIReview() {
        guard let config = selectedAI else { return }
        aiResultScrollView.isHidden = false
        aiResultTextView.string = "正在进行 AI 验收..."
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { [weak self] in
            let result = "[\(config.name)]: 代码审查完成，发现 2 处潜在问题：1. 变量命名不规范 2. 缺少错误处理。建议修改后重新提交。"
            self?.aiResultTextView.string = result
        }
    }
    
    private func updateAIState() {
        let hasAI = selectedAI != nil
        addAIButton.isHidden = hasAI
        aiStatusLabel.isHidden = !hasAI
        startAIButton.isHidden = !hasAI
        if let config = selectedAI {
            aiStatusLabel.stringValue = "已选 AI: \(config.icon) \(config.name)"
        }
    }
}

// MARK: - Window Controller
class AIConsoleWindowController: NSWindowController {
    static let shared: AIConsoleWindowController = {
        let window = NSPanel(
            contentRect: NSRect(x: 0, y: 0, width: 1000, height: 750),
            styleMask: [.titled, .closable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        window.title = "AI 控制台"
        window.minSize = NSSize(width: 1000, height: 700)
        window.center()
        
        let controller = AIConsoleWindowController(window: window)
        controller.setupUI()
        return controller
    }()
    
    private func setupUI() {
        guard let window = window, let contentView = window.contentView else { return }
        let splitView = NSSplitView(frame: contentView.bounds)
        splitView.isVertical = false
        splitView.dividerStyle = .thin
        splitView.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(splitView)
        
        let manager = AIConsoleManagerPanel()
        let programmer = AIConsoleProgrammerPanel()
        let review = AIConsoleReviewPanel()
        
        splitView.addArrangedSubview(manager)
        splitView.addArrangedSubview(programmer)
        splitView.addArrangedSubview(review)
        
        NSLayoutConstraint.activate([
            splitView.topAnchor.constraint(equalTo: contentView.topAnchor),
            splitView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor),
            splitView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor),
            splitView.bottomAnchor.constraint(equalTo: contentView.bottomAnchor)
        ])
    }
}
