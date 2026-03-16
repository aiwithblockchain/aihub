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
    }
    
    deinit {
        NotificationCenter.default.removeObserver(self)
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
        
        navTabIdTextField.placeholderString = "Tab ID (可选)"
        navPathTextField.placeholderString = "跳转路径 (如: elonmusk)"
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
        
        let navigateStack = NSStackView(views: [navTabIdTextField, navPathTextField, navigateButton])
        navigateStack.orientation = .horizontal
        navigateStack.spacing = 8
        
        let leftStack = NSStackView(views: [titleLabel, statusLabel, queryButton, queryBasicInfoButton, openTabStack, closeTabStack, navigateStack])
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
        AppDelegate.shared?.sendQueryXTabsStatus()
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
        AppDelegate.shared?.sendQueryXBasicInfo()
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
        AppDelegate.shared?.sendOpenTab(path: path)
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
        AppDelegate.shared?.sendCloseTab(tabId: tabId)
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
        AppDelegate.shared?.sendNavigateTab(tabId: tabId, path: path)
    }
    
    @objc private func handleNavigateTabResult(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let jsonString = userInfo["dataString"] as? String else { return }
        
        DispatchQueue.main.async {
            self.resultTextView.string = jsonString
        }
    }
}

final class TweetClawClawViewController: NSViewController, NSTableViewDelegate, NSTableViewDataSource {
    private let titleLabel = NSTextField(labelWithString: "TweetClaw - For Claw")
    private let tableView = NSTableView()
    private let exampleTextView: NSTextView = {
        let tv = NSTextView()
        tv.isEditable = false
        tv.font = .monospacedSystemFont(ofSize: 12, weight: .regular)
        tv.backgroundColor = .textBackgroundColor
        return tv
    }()
    
    private struct ApiDoc {
        let name: String
        let path: String
        let method: String
        let description: String
        let body: String?
        let example: String
    }
    
    private let docs: [ApiDoc] = [
        ApiDoc(name: "X Status", path: "/api/v1/x/status", method: "GET", description: "Query current X.com tab status", body: nil, example: "curl -X GET http://127.0.0.1:8769/api/v1/x/status"),
        ApiDoc(name: "Basic Info", path: "/api/v1/x/basic_info", method: "GET", description: "Query current logged-in user profile", body: nil, example: "curl -X GET http://127.0.0.1:8769/api/v1/x/basic_info"),
        ApiDoc(name: "Open Tab", path: "/tweetclaw/open-tab", method: "POST", description: "Open a new X.com tab", body: "{ \"path\": \"home\" }", example: "curl -X POST http://127.0.0.1:8769/tweetclaw/open-tab -H \"Content-Type: application/json\" -d '{\"path\": \"home\"}'"),
        ApiDoc(name: "Close Tab", path: "/tweetclaw/close-tab", method: "POST", description: "Close specified tabId", body: "{ \"tabId\": 1234 }", example: "curl -X POST http://127.0.0.1:8769/tweetclaw/close-tab -H \"Content-Type: application/json\" -d '{\"tabId\": 1234}'"),
        ApiDoc(name: "Navigate Tab", path: "/tweetclaw/navigate-tab", method: "POST", description: "Navigate tab to path. tabId optional.", body: "{ \"tabId\": 1234, \"path\": \"elonmusk\" }", example: "curl -X POST http://127.0.0.1:8769/tweetclaw/navigate-tab -H \"Content-Type: application/json\" -d '{\"path\": \"elonmusk\"}'")
    ]
    
    override func loadView() {
        view = NSView()
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
    }
    
    private func setupUI() {
        titleLabel.font = .systemFont(ofSize: 20, weight: .bold)
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(titleLabel)
        
        let scrollView = NSScrollView()
        scrollView.hasVerticalScroller = true
        scrollView.borderType = .bezelBorder
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        
        tableView.delegate = self
        tableView.dataSource = self
        tableView.columnAutoresizingStyle = .uniformColumnAutoresizingStyle
        
        let column = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("ApiColumn"))
        column.title = "Endpoints"
        tableView.addTableColumn(column)
        tableView.headerView = nil
        
        scrollView.documentView = tableView
        view.addSubview(scrollView)
        
        let exampleScrollView = NSScrollView()
        exampleScrollView.hasVerticalScroller = true
        exampleScrollView.hasHorizontalScroller = true
        exampleScrollView.borderType = .bezelBorder
        exampleScrollView.translatesAutoresizingMaskIntoConstraints = false
        exampleScrollView.documentView = exampleTextView
        view.addSubview(exampleScrollView)
        
        NSLayoutConstraint.activate([
            titleLabel.topAnchor.constraint(equalTo: view.topAnchor, constant: 20),
            titleLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            
            scrollView.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 15),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            scrollView.widthAnchor.constraint(equalToConstant: 250),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -20),
            
            exampleScrollView.topAnchor.constraint(equalTo: scrollView.topAnchor),
            exampleScrollView.leadingAnchor.constraint(equalTo: scrollView.trailingAnchor, constant: 15),
            exampleScrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            exampleScrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -20)
        ])
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
            let textField = NSTextField(labelWithString: "")
            textField.translatesAutoresizingMaskIntoConstraints = false
            cell?.addSubview(textField)
            cell?.textField = textField
            NSLayoutConstraint.activate([
                textField.leadingAnchor.constraint(equalTo: cell!.leadingAnchor, constant: 2),
                textField.trailingAnchor.constraint(equalTo: cell!.trailingAnchor, constant: -2),
                textField.centerYAnchor.constraint(equalTo: cell!.centerYAnchor)
            ])
        }
        let doc = docs[row]
        cell?.textField?.stringValue = "\(doc.method) \(doc.name)"
        return cell
    }
    
    func tableViewSelectionDidChange(_ notification: Notification) {
        let row = tableView.selectedRow
        guard row >= 0 && row < docs.count else {
            exampleTextView.string = ""
            return
        }
        let doc = docs[row]
        var content = "## \(doc.name)\n\n"
        content += "Description: \(doc.description)\n"
        content += "Endpoint: \(doc.method) \(doc.path)\n"
        if let body = doc.body {
            content += "Request Body:\n\(body)\n"
        }
        content += "\nUsage Example:\n\(doc.example)\n"
        exampleTextView.string = content
    }
}
