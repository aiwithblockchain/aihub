import AppKit

final class SettingsViewController: NSViewController {
    private let titleLabel = NSTextField(labelWithString: "设置")
    private let stayOnTopCheckbox = NSButton(checkboxWithTitle: "窗口保持在最前面", target: nil, action: #selector(toggleStayOnTop))
    
    // WebSockets Ports Configuration
    private let tweetClawPortLabel = NSTextField(labelWithString: "tweetClaw WebSocket 端口:")
    private let tweetClawPortField = NSTextField()
    private let aiClawPortLabel = NSTextField(labelWithString: "aiClaw WebSocket 端口:")
    private let aiClawPortField = NSTextField()
    private let restPortLabel = NSTextField(labelWithString: "REST API 端口:")
    private let restPortField = NSTextField()
    
    // Actions
    private let saveButton = NSButton(title: "保存配置并重启服务", target: nil, action: #selector(saveClicked))
    private let quitButton = NSButton(title: "退出 LocalBridge 进程", target: nil, action: #selector(quitClicked))

    override func loadView() {
        let view = NSView()
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor.windowBackgroundColor.cgColor
        self.view = view
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        loadCurrentSettings()
    }
    
    override func viewWillAppear() {
        super.viewWillAppear()
        updateCheckboxState()
    }

    private func setupUI() {
        titleLabel.font = .systemFont(ofSize: 24, weight: .bold)
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        
        stayOnTopCheckbox.translatesAutoresizingMaskIntoConstraints = false
        stayOnTopCheckbox.target = self
        
        tweetClawPortLabel.translatesAutoresizingMaskIntoConstraints = false
        tweetClawPortField.translatesAutoresizingMaskIntoConstraints = false
        tweetClawPortField.widthAnchor.constraint(equalToConstant: 80).isActive = true
        
        aiClawPortLabel.translatesAutoresizingMaskIntoConstraints = false
        aiClawPortField.translatesAutoresizingMaskIntoConstraints = false
        aiClawPortField.widthAnchor.constraint(equalToConstant: 80).isActive = true
        
        restPortLabel.translatesAutoresizingMaskIntoConstraints = false
        restPortField.translatesAutoresizingMaskIntoConstraints = false
        restPortField.widthAnchor.constraint(equalToConstant: 80).isActive = true
        
        saveButton.translatesAutoresizingMaskIntoConstraints = false
        saveButton.target = self
        saveButton.bezelStyle = .rounded
        
        quitButton.translatesAutoresizingMaskIntoConstraints = false
        quitButton.target = self
        quitButton.bezelStyle = .rounded
        
        let tweetClawStack = NSStackView(views: [tweetClawPortLabel, tweetClawPortField])
        tweetClawStack.orientation = .horizontal
        tweetClawStack.alignment = .centerY
        
        let aiClawStack = NSStackView(views: [aiClawPortLabel, aiClawPortField])
        aiClawStack.orientation = .horizontal
        aiClawStack.alignment = .centerY
        
        let restStack = NSStackView(views: [restPortLabel, restPortField])
        restStack.orientation = .horizontal
        restStack.alignment = .centerY
        
        let spacerRow = NSView()
        spacerRow.heightAnchor.constraint(equalToConstant: 10).isActive = true
        
        let bottomSpacerRow = NSView()
        bottomSpacerRow.heightAnchor.constraint(equalToConstant: 20).isActive = true
        
        let stackView = NSStackView(views: [
            titleLabel,
            stayOnTopCheckbox,
            spacerRow,
            tweetClawStack,
            aiClawStack,
            restStack,
            saveButton,
            bottomSpacerRow,
            quitButton
        ])
        stackView.orientation = .vertical
        stackView.alignment = .leading
        stackView.spacing = 15
        stackView.translatesAutoresizingMaskIntoConstraints = false
        
        view.addSubview(stackView)
        
        NSLayoutConstraint.activate([
            stackView.topAnchor.constraint(equalTo: view.topAnchor, constant: 40),
            stackView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 40),
            stackView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -40),
            stackView.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -40)
        ])
    }
    
    private func loadCurrentSettings() {
        let defaults = UserDefaults.standard
        let ttPort = defaults.integer(forKey: "tweetClawPort")
        let aiPort = defaults.integer(forKey: "aiClawPort")
        let restPort = defaults.integer(forKey: "restApiPort")
        
        tweetClawPortField.stringValue = ttPort != 0 ? "\(ttPort)" : "10086"
        aiClawPortField.stringValue = aiPort != 0 ? "\(aiPort)" : "10087"
        restPortField.stringValue = restPort != 0 ? "\(restPort)" : "10088"
    }

    private func updateCheckboxState() {
        guard let window = view.window else { return }
        stayOnTopCheckbox.state = window.level == .floating ? .on : .off
    }

    @objc private func toggleStayOnTop() {
        guard let window = view.window else { return }
        window.level = stayOnTopCheckbox.state == .on ? .floating : .normal
    }
    
    @objc private func saveClicked() {
        let defaults = UserDefaults.standard
        if let ttPortStr = Int(tweetClawPortField.stringValue), ttPortStr > 0 {
            defaults.set(ttPortStr, forKey: "tweetClawPort")
        }
        if let aiPortStr = Int(aiClawPortField.stringValue), aiPortStr > 0 {
            defaults.set(aiPortStr, forKey: "aiClawPort")
        }
        if let restPortStr = Int(restPortField.stringValue), restPortStr > 0 {
            defaults.set(restPortStr, forKey: "restApiPort")
        }
        defaults.synchronize()
        
        // Notify app delegate to restart the websocket server
        NotificationCenter.default.post(name: NSNotification.Name("RestartWebSocketServer"), object: nil)
        
        let alert = NSAlert()
        alert.messageText = "保存成功"
        alert.informativeText = "服务器端口设置已保存，服务已在后台重启。"
        alert.alertStyle = .informational
        alert.addButton(withTitle: "确定")
        alert.runModal()
    }
    
    @objc private func quitClicked() {
        NSApplication.shared.terminate(nil)
    }
}
