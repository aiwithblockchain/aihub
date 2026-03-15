import AppKit

final class AIClawHumanViewController: NSViewController {
    private let titleLabel = NSTextField(labelWithString: "AIClaw - For Human")
    private let statusLabel = NSTextField(labelWithString: "查询 AI 平台 Tab 状态")
    
    private let platformPopup = NSPopUpButton(frame: .zero, pullsDown: false)
    private let queryButton = NSButton(title: "查询状态", target: nil, action: #selector(queryClicked))
    private var resultTextView: NSTextView!
    private var resultScrollView: NSScrollView!
    
    override func loadView() {
        view = NSView()
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        
        NotificationCenter.default.addObserver(self, selector: #selector(handleQueryResult(_:)), name: NSNotification.Name("QueryAITabsStatusReceived"), object: nil)
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
        
        let leftStack = NSStackView(views: [titleLabel, statusLabel, platformRow, queryButton])
        leftStack.orientation = .vertical
        leftStack.alignment = .leading
        leftStack.spacing = 16
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
                        filtered["hasAITabs"] = !filteredTabs.isEmpty
                    }
                    
                    // Check platform login status
                    if let platforms = json["platforms"] as? [String: Bool] {
                        let isActive = platforms[targetPlatform] ?? false
                        filtered["platformQueried"] = targetPlatform
                        filtered["hasTabs"] = isActive
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
        ### REST API Documentation
        
        Endpoint: GET http://127.0.0.1:8769/api/v1/ai/status
        Description: Queries AI platform tabs (ChatGPT, Gemini, Grok)
                     from aiClaw browser extension.
        
        Prerequisites:
        - aiClaw extension must be installed and active
        - WebSocket connection must be established
        
        Response Example:
        {
          "hasAITabs": true,
          "platforms": {
            "chatgpt": true,
            "gemini": false,
            "grok": true
          },
          "activeAITabId": 123,
          "activeAIUrl": "https://chatgpt.com/",
          "tabs": [
            {
              "tabId": 123,
              "url": "https://chatgpt.com/",
              "platform": "chatgpt",
              "active": true
            }
          ]
        }
        
        Error Responses:
        - 503: {"error":"aiclaw_offline"}
             aiClaw extension is not connected.
        - 504: {"error":"timeout"}
             Request timed out after 5 seconds.
        
        Usage:
        curl -X GET http://127.0.0.1:8769/api/v1/ai/status
        
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
