import AppKit

final class TweetClawHumanViewController: NSViewController {
    private let titleLabel = NSTextField(labelWithString: "TweetClaw - For Human")
    private let statusLabel = NSTextField(labelWithString: "交互式操作")
    private let queryButton = NSButton(title: "Query X Status (Immediate)", target: nil, action: #selector(queryXStatusClicked))
    
    override func loadView() {
        view = NSView()
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
    }
    
    private func setupUI() {
        titleLabel.font = .systemFont(ofSize: 20, weight: .bold)
        queryButton.bezelStyle = .rounded
        queryButton.target = self
        
        let stack = NSStackView(views: [titleLabel, statusLabel, queryButton])
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
    
    @objc private func queryXStatusClicked() {
        AppDelegate.shared?.sendQueryXTabsStatus()
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
