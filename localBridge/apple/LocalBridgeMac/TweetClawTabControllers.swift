import AppKit

final class TweetClawHumanViewController: NSViewController {
    private let titleLabel = NSTextField(labelWithString: "TweetClaw - For Human")
    private let statusLabel = NSTextField(labelWithString: "交互式操作")
    private let queryButton = NSButton(title: "Query X Status (Immediate)", target: nil, action: #selector(queryXStatusClicked))
    
    private let resultTextView = NSTextView()
    private let resultScrollView = NSScrollView()
    
    override func loadView() {
        view = NSView()
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        
        NotificationCenter.default.addObserver(self, selector: #selector(handleQueryResult(_:)), name: NSNotification.Name("QueryXTabsStatusReceived"), object: nil)
    }
    
    deinit {
        NotificationCenter.default.removeObserver(self)
    }
    
    private func setupUI() {
        titleLabel.font = .systemFont(ofSize: 20, weight: .bold)
        queryButton.bezelStyle = .rounded
        queryButton.target = self
        
        // Setup result text view
        resultTextView.isEditable = false
        resultTextView.isSelectable = true
        resultTextView.font = .monospacedSystemFont(ofSize: 13, weight: .regular)
        resultTextView.textContainerInset = NSSize(width: 8, height: 8)
        
        resultScrollView.documentView = resultTextView
        resultScrollView.hasVerticalScroller = true
        resultScrollView.autoresizesSubviews = true
        resultScrollView.borderType = .bezelBorder
        resultScrollView.translatesAutoresizingMaskIntoConstraints = false
        
        let leftStack = NSStackView(views: [titleLabel, statusLabel, queryButton])
        leftStack.orientation = .vertical
        leftStack.alignment = .leading
        leftStack.spacing = 20
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
        AppDelegate.shared?.sendQueryXTabsStatus()
    }
    
    @objc private func handleQueryResult(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let jsonString = userInfo["dataString"] as? String else { return }
        
        DispatchQueue.main.async {
            self.resultTextView.string = jsonString
        }
    }
}

final class TweetClawBotViewController: NSViewController {
    private let titleLabel = NSTextField(labelWithString: "TweetClaw - For ClawBot")
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
        
        The LocalBridge provides a REST interface for bot integration.
        
        Endpoint: GET http://127.0.0.1:8769/api/v1/x/status
        Description: Queries current X.com tab status from the browser extension.
        
        Response Example:
        {
          "hasXTabs": true,
          "isLoggedIn": true,
          "activeXTabId": 1234,
          "tabs": [...]
        }
        
        Usage:
        curl -X GET http://127.0.0.1:8769/api/v1/x/status
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
