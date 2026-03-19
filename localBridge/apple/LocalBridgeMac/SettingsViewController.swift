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
        view.layer?.backgroundColor = DSV2.surfaceContainerLow.cgColor
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
        titleLabel.font = DSV2.fontDisplaySm
        titleLabel.textColor = DSV2.onSurface
        titleLabel.translatesAutoresizingMaskIntoConstraints = false

        stayOnTopCheckbox.translatesAutoresizingMaskIntoConstraints = false
        stayOnTopCheckbox.target = self
        stayOnTopCheckbox.font = DSV2.fontBodyMd
        stayOnTopCheckbox.contentTintColor = DSV2.onSurface

        tweetClawPortLabel.font = DSV2.fontBodyMd
        tweetClawPortLabel.textColor = DSV2.onSurfaceVariant
        tweetClawPortLabel.alignment = .right
        tweetClawPortLabel.translatesAutoresizingMaskIntoConstraints = false

        styleInputField(tweetClawPortField)
        tweetClawPortField.widthAnchor.constraint(equalToConstant: 80).isActive = true

        aiClawPortLabel.font = DSV2.fontBodyMd
        aiClawPortLabel.textColor = DSV2.onSurfaceVariant
        aiClawPortLabel.alignment = .right
        aiClawPortLabel.translatesAutoresizingMaskIntoConstraints = false

        styleInputField(aiClawPortField)
        aiClawPortField.widthAnchor.constraint(equalToConstant: 80).isActive = true

        restPortLabel.font = DSV2.fontBodyMd
        restPortLabel.textColor = DSV2.onSurfaceVariant
        restPortLabel.alignment = .right
        restPortLabel.translatesAutoresizingMaskIntoConstraints = false

        styleInputField(restPortField)
        restPortField.widthAnchor.constraint(equalToConstant: 80).isActive = true

        saveButton.translatesAutoresizingMaskIntoConstraints = false
        saveButton.target = self
        saveButton.wantsLayer = true
        saveButton.isBordered = false
        saveButton.bezelStyle = .rounded

        // 使用渐变主按钮样式
        let gradientLayer = CAGradientLayer()
        gradientLayer.colors = [
            DSV2.primary.cgColor,
            DSV2.primaryContainer.cgColor
        ]
        gradientLayer.startPoint = CGPoint(x: 0, y: 0)
        gradientLayer.endPoint = CGPoint(x: 1, y: 1)
        gradientLayer.cornerRadius = DSV2.radiusButton

        saveButton.layer?.insertSublayer(gradientLayer, at: 0)

        let attributes: [NSAttributedString.Key: Any] = [
            .foregroundColor: DSV2.onPrimaryContainer,
            .font: DSV2.fontLabelMd
        ]
        saveButton.attributedTitle = NSAttributedString(string: "保存配置并重启服务", attributes: attributes)

        // 更新渐变层大小
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            gradientLayer.frame = self.saveButton.bounds
        }

        let generalCard = makeSettingsCard(title: "通用", views: [stayOnTopCheckbox])

        let portGrid = NSGridView(views: [
            [tweetClawPortLabel, tweetClawPortField],
            [aiClawPortLabel,    aiClawPortField   ],
            [restPortLabel,      restPortField     ],
        ])
        portGrid.column(at: 0).xPlacement = .trailing
        portGrid.column(at: 1).xPlacement = .leading
        portGrid.rowSpacing    = DSV2.spacing4
        portGrid.columnSpacing = DSV2.spacing2

        let networkCard = makeSettingsCard(title: "网络端口配置", views: [portGrid, saveButton])

        let mainStack = NSStackView(views: [
            titleLabel,
            generalCard,
            networkCard,
            NSView() // Flexible spacer
        ])
        mainStack.orientation = .vertical
        mainStack.alignment = .leading
        mainStack.spacing = DSV2.spacing6
        mainStack.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(mainStack)

        NSLayoutConstraint.activate([
            mainStack.topAnchor.constraint(equalTo: view.topAnchor, constant: DSV2.spacing8),
            mainStack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: DSV2.spacing8),
            mainStack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -DSV2.spacing8),
            mainStack.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -DSV2.spacing8),

            generalCard.widthAnchor.constraint(equalTo: mainStack.widthAnchor),
            networkCard.widthAnchor.constraint(equalTo: mainStack.widthAnchor)
        ])
    }

    private func styleInputField(_ field: NSTextField) {
        field.wantsLayer = true
        field.isBordered = false
        field.bezelStyle = .roundedBezel
        field.drawsBackground = true
        field.backgroundColor = DSV2.surface
        field.textColor = DSV2.onSurface
        field.font = DSV2.fontBodyMd
        field.translatesAutoresizingMaskIntoConstraints = false

        // Ghost Border (15% opacity)
        field.layer?.borderWidth = 1
        field.layer?.borderColor = DSV2.outlineVariant.withAlphaComponent(0.15).cgColor
        field.layer?.cornerRadius = DSV2.radiusInput

        // Add padding
        field.cell?.wraps = false
        field.cell?.isScrollable = true
    }

    private func makeSettingsCard(title: String, views: [NSView]) -> NSView {
        // 使用 DSV2 玻璃卡片（无边框）
        let container = DSV2.makeGlassCard()

        let sectionTitle = NSTextField(labelWithString: title)
        sectionTitle.font = DSV2.fontTitleSm
        sectionTitle.textColor = DSV2.onSurfaceVariant

        // 使用间距替代分割线（遵循"无边框"原则）
        let contentStack = NSStackView(views: [sectionTitle] + views)
        contentStack.orientation = .vertical
        contentStack.alignment   = .leading
        contentStack.spacing     = DSV2.spacing6
        contentStack.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(contentStack)

        NSLayoutConstraint.activate([
            contentStack.topAnchor.constraint(equalTo: container.topAnchor, constant: DSV2.spacing4),
            contentStack.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: DSV2.spacing4),
            contentStack.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -DSV2.spacing4),
            contentStack.bottomAnchor.constraint(equalTo: container.bottomAnchor, constant: -DSV2.spacing4)
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
