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
        titleLabel.font = DS.fontTitle
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        
        stayOnTopCheckbox.translatesAutoresizingMaskIntoConstraints = false
        stayOnTopCheckbox.target = self
        
        tweetClawPortLabel.font = DS.fontBody
        tweetClawPortLabel.alignment = .right
        tweetClawPortLabel.translatesAutoresizingMaskIntoConstraints = false
        tweetClawPortField.bezelStyle = .roundedBezel
        tweetClawPortField.translatesAutoresizingMaskIntoConstraints = false
        tweetClawPortField.widthAnchor.constraint(equalToConstant: 80).isActive = true
        
        aiClawPortLabel.font = DS.fontBody
        aiClawPortLabel.alignment = .right
        aiClawPortLabel.translatesAutoresizingMaskIntoConstraints = false
        aiClawPortField.bezelStyle = .roundedBezel
        aiClawPortField.translatesAutoresizingMaskIntoConstraints = false
        aiClawPortField.widthAnchor.constraint(equalToConstant: 80).isActive = true
        
        restPortLabel.font = DS.fontBody
        restPortLabel.alignment = .right
        restPortLabel.translatesAutoresizingMaskIntoConstraints = false
        restPortField.bezelStyle = .roundedBezel
        restPortField.translatesAutoresizingMaskIntoConstraints = false
        restPortField.widthAnchor.constraint(equalToConstant: 80).isActive = true
        
        saveButton.translatesAutoresizingMaskIntoConstraints = false
        saveButton.target = self
        saveButton.bezelStyle = .rounded

        let generalCard = makeSettingsCard(title: "通用", views: [stayOnTopCheckbox])

        let portGrid = NSGridView(views: [
            [tweetClawPortLabel, tweetClawPortField],
            [aiClawPortLabel,    aiClawPortField   ],
            [restPortLabel,      restPortField     ],
        ])
        portGrid.column(at: 0).xPlacement = .trailing
        portGrid.column(at: 1).xPlacement = .leading
        portGrid.rowSpacing    = DS.spacingM
        portGrid.columnSpacing = DS.spacingS

        let networkCard = makeSettingsCard(title: "网络端口配置", views: [portGrid, saveButton])

        let mainStack = NSStackView(views: [
            titleLabel,
            generalCard,
            networkCard,
            NSView() // Flexible spacer
        ])
        mainStack.orientation = .vertical
        mainStack.alignment = .leading
        mainStack.spacing = DS.spacingL
        mainStack.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(mainStack)

        NSLayoutConstraint.activate([
            mainStack.topAnchor.constraint(equalTo: view.topAnchor, constant: DS.spacingXL),
            mainStack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: DS.spacingXL),
            mainStack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -DS.spacingXL),
            mainStack.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -DS.spacingXL),

            generalCard.widthAnchor.constraint(equalTo: mainStack.widthAnchor),
            networkCard.widthAnchor.constraint(equalTo: mainStack.widthAnchor)
        ])
    }
    
    private func makeSettingsCard(title: String, views: [NSView]) -> NSView {
        let container = NSView()
        container.wantsLayer = true
        container.layer?.cornerRadius = DS.radiusM
        container.layer?.backgroundColor = DS.colorSurface.cgColor
        container.layer?.borderColor     = DS.colorBorder.cgColor
        container.layer?.borderWidth     = 1.0

        let sectionTitle = NSTextField(labelWithString: title)
        sectionTitle.font      = DS.fontSection
        sectionTitle.textColor = DS.colorTextTertiary

        let separator = NSBox()
        separator.boxType = .separator

        let contentStack = NSStackView(views: [sectionTitle, separator] + views)
        contentStack.orientation = .vertical
        contentStack.alignment   = .leading
        contentStack.spacing     = DS.spacingM
        contentStack.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(contentStack)

        NSLayoutConstraint.activate([
            contentStack.topAnchor.constraint(equalTo: container.topAnchor, constant: DS.spacingM),
            contentStack.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: DS.spacingM),
            contentStack.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -DS.spacingM),
            contentStack.bottomAnchor.constraint(equalTo: container.bottomAnchor, constant: -DS.spacingM),
            
            separator.widthAnchor.constraint(equalTo: contentStack.widthAnchor)
        ])
        return container
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
}
