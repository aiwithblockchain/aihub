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
        view.layer?.backgroundColor = DSV2.surface.cgColor
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
        // Title - 更大更醒目
        titleLabel.font = NSFont.systemFont(ofSize: 28, weight: .bold)
        titleLabel.textColor = NSColor(hex: "#E5E2E1")
        titleLabel.stringValue = "App Configuration"
        titleLabel.translatesAutoresizingMaskIntoConstraints = false

        // Subtitle
        let subtitleLabel = NSTextField(labelWithString: "Manage your instance protocols and local environment behaviors.")
        subtitleLabel.font = DSV2.fontBodyMd
        subtitleLabel.textColor = DSV2.onSurfaceVariant
        subtitleLabel.translatesAutoresizingMaskIntoConstraints = false

        // 配置复选框 - 清空标题，因为我们会在旁边添加自定义标签
        stayOnTopCheckbox.title = ""
        stayOnTopCheckbox.translatesAutoresizingMaskIntoConstraints = false
        stayOnTopCheckbox.target = self
        if #available(macOS 10.14, *) {
            stayOnTopCheckbox.contentTintColor = DSV2.primary
        }

        // Port labels - 使用小号大写字体
        tweetClawPortLabel.font = NSFont.systemFont(ofSize: 11, weight: .semibold)
        tweetClawPortLabel.textColor = NSColor(hex: "#737373")
        tweetClawPortLabel.stringValue = "TWEETCLAW WEBSOCKET PORT"
        tweetClawPortLabel.translatesAutoresizingMaskIntoConstraints = false

        styleInputField(tweetClawPortField)

        aiClawPortLabel.font = NSFont.systemFont(ofSize: 11, weight: .semibold)
        aiClawPortLabel.textColor = NSColor(hex: "#737373")
        aiClawPortLabel.stringValue = "AICLAW WEBSOCKET PORT"
        aiClawPortLabel.translatesAutoresizingMaskIntoConstraints = false

        styleInputField(aiClawPortField)

        restPortLabel.font = NSFont.systemFont(ofSize: 11, weight: .semibold)
        restPortLabel.textColor = NSColor(hex: "#737373")
        restPortLabel.stringValue = "REST API PORT"
        restPortLabel.translatesAutoresizingMaskIntoConstraints = false

        styleInputField(restPortField)

        // 保存按钮
        saveButton.translatesAutoresizingMaskIntoConstraints = false
        saveButton.target = self
        saveButton.wantsLayer = true
        saveButton.isBordered = false
        saveButton.bezelStyle = .rounded

        let gradientLayer = CAGradientLayer()
        gradientLayer.colors = [
            DSV2.primary.cgColor,
            DSV2.primaryContainer.cgColor
        ]
        gradientLayer.startPoint = CGPoint(x: 0, y: 0)
        gradientLayer.endPoint = CGPoint(x: 1, y: 1)
        gradientLayer.cornerRadius = DSV2.radiusButton

        saveButton.layer?.insertSublayer(gradientLayer, at: 0)
        saveButton.layer?.cornerRadius = DSV2.radiusButton

        // 添加阴影效果
        saveButton.layer?.shadowColor = DSV2.primaryContainer.cgColor
        saveButton.layer?.shadowOpacity = 0.3
        saveButton.layer?.shadowOffset = CGSize(width: 0, height: 4)
        saveButton.layer?.shadowRadius = 8

        let attributes: [NSAttributedString.Key: Any] = [
            .foregroundColor: NSColor.white,
            .font: NSFont.systemFont(ofSize: 13, weight: .bold)
        ]
        saveButton.attributedTitle = NSAttributedString(string: "Save Configuration and Restart", attributes: attributes)

        // 设置按钮高度
        saveButton.heightAnchor.constraint(equalToConstant: 40).isActive = true

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            gradientLayer.frame = self.saveButton.bounds
        }

        // 创建卡片
        let generalCard = makeSettingsCard(
            title: "General",
            icon: "tune",
            iconColor: DSV2.primary,
            views: [makeCheckboxRow()]
        )

        let networkCard = makeSettingsCard(
            title: "Network Configuration",
            icon: "lan",
            iconColor: DSV2.secondary,
            views: [makePortsGrid(), makeInfoFooter(), saveButton]
        )

        let mainStack = NSStackView(views: [
            titleLabel,
            subtitleLabel,
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
            mainStack.topAnchor.constraint(equalTo: view.topAnchor, constant: 48),
            mainStack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: DSV2.spacing8),
            mainStack.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -DSV2.spacing8),
            mainStack.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -DSV2.spacing8),
            mainStack.widthAnchor.constraint(lessThanOrEqualToConstant: 700),

            generalCard.widthAnchor.constraint(equalTo: mainStack.widthAnchor),
            networkCard.widthAnchor.constraint(equalTo: mainStack.widthAnchor)
        ])
    }

    private func styleInputField(_ field: NSTextField) {
        field.wantsLayer = true
        field.isBordered = false
        field.bezelStyle = .roundedBezel
        field.drawsBackground = true
        field.backgroundColor = DSV2.surfaceContainerLowest
        field.textColor = NSColor(hex: "#E5E2E1")
        field.font = DSV2.fontMonoMd
        field.translatesAutoresizingMaskIntoConstraints = false

        // Ghost Border
        field.layer?.borderWidth = 1
        field.layer?.borderColor = DSV2.outlineVariant.withAlphaComponent(0.15).cgColor
        field.layer?.cornerRadius = 8  // 更大的圆角

        field.cell?.wraps = false
        field.cell?.isScrollable = true

        field.heightAnchor.constraint(equalToConstant: 40).isActive = true  // 更高的输入框
        field.widthAnchor.constraint(equalToConstant: 240).isActive = true  // 更宽的输入框
    }

    private func makeCheckboxRow() -> NSView {
        let container = NSView()
        container.translatesAutoresizingMaskIntoConstraints = false

        // 创建一个水平布局容器
        let rowContainer = NSView()
        rowContainer.translatesAutoresizingMaskIntoConstraints = false

        // 复选框在左侧
        stayOnTopCheckbox.title = ""  // 清空默认标题
        stayOnTopCheckbox.translatesAutoresizingMaskIntoConstraints = false

        // 文本容器在右侧
        let textContainer = NSView()
        textContainer.translatesAutoresizingMaskIntoConstraints = false

        let label = NSTextField(labelWithString: "Keep window on top")
        label.font = DSV2.fontBodyMd
        label.textColor = NSColor(hex: "#E5E2E1")
        label.isBordered = false
        label.isEditable = false
        label.drawsBackground = false
        label.translatesAutoresizingMaskIntoConstraints = false

        let hint = NSTextField(labelWithString: "Ensure LocalBridge remains visible above other applications.")
        hint.font = NSFont.systemFont(ofSize: 11, weight: .regular)
        hint.textColor = NSColor(hex: "#737373")
        hint.isBordered = false
        hint.isEditable = false
        hint.drawsBackground = false
        hint.translatesAutoresizingMaskIntoConstraints = false

        textContainer.addSubview(label)
        textContainer.addSubview(hint)

        rowContainer.addSubview(stayOnTopCheckbox)
        rowContainer.addSubview(textContainer)

        container.addSubview(rowContainer)

        NSLayoutConstraint.activate([
            // 复选框约束
            stayOnTopCheckbox.leadingAnchor.constraint(equalTo: rowContainer.leadingAnchor),
            stayOnTopCheckbox.topAnchor.constraint(equalTo: rowContainer.topAnchor, constant: 2),
            stayOnTopCheckbox.widthAnchor.constraint(equalToConstant: 20),
            stayOnTopCheckbox.heightAnchor.constraint(equalToConstant: 20),

            // 文本容器约束
            textContainer.leadingAnchor.constraint(equalTo: stayOnTopCheckbox.trailingAnchor, constant: 12),
            textContainer.trailingAnchor.constraint(equalTo: rowContainer.trailingAnchor),
            textContainer.topAnchor.constraint(equalTo: rowContainer.topAnchor),
            textContainer.bottomAnchor.constraint(equalTo: rowContainer.bottomAnchor),

            // 标签约束
            label.topAnchor.constraint(equalTo: textContainer.topAnchor),
            label.leadingAnchor.constraint(equalTo: textContainer.leadingAnchor),
            label.trailingAnchor.constraint(equalTo: textContainer.trailingAnchor),

            // 提示约束
            hint.topAnchor.constraint(equalTo: label.bottomAnchor, constant: 4),
            hint.leadingAnchor.constraint(equalTo: textContainer.leadingAnchor),
            hint.trailingAnchor.constraint(equalTo: textContainer.trailingAnchor),
            hint.bottomAnchor.constraint(equalTo: textContainer.bottomAnchor),

            // 行容器约束
            rowContainer.topAnchor.constraint(equalTo: container.topAnchor),
            rowContainer.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            rowContainer.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            rowContainer.bottomAnchor.constraint(equalTo: container.bottomAnchor)
        ])

        return container
    }

    private func makePortsGrid() -> NSView {
        let container = NSView()
        container.translatesAutoresizingMaskIntoConstraints = false

        // TweetClaw Port
        let tcLabel = NSTextField(labelWithString: "TWEETCLAW WEBSOCKET PORT")
        tcLabel.font = NSFont.systemFont(ofSize: 11, weight: .semibold)
        tcLabel.textColor = NSColor(hex: "#737373")
        tcLabel.isBordered = false
        tcLabel.isEditable = false
        tcLabel.drawsBackground = false
        tcLabel.translatesAutoresizingMaskIntoConstraints = false

        // AIClaw Port
        let aiLabel = NSTextField(labelWithString: "AICLAW WEBSOCKET PORT")
        aiLabel.font = NSFont.systemFont(ofSize: 11, weight: .semibold)
        aiLabel.textColor = NSColor(hex: "#737373")
        aiLabel.isBordered = false
        aiLabel.isEditable = false
        aiLabel.drawsBackground = false
        aiLabel.translatesAutoresizingMaskIntoConstraints = false

        // REST Port
        let restLabel = NSTextField(labelWithString: "REST API PORT")
        restLabel.font = NSFont.systemFont(ofSize: 11, weight: .semibold)
        restLabel.textColor = NSColor(hex: "#737373")
        restLabel.isBordered = false
        restLabel.isEditable = false
        restLabel.drawsBackground = false
        restLabel.translatesAutoresizingMaskIntoConstraints = false

        let restHint = NSTextField(labelWithString: "Required for external automation and dashboard hooks.")
        restHint.font = NSFont.systemFont(ofSize: 10, weight: .regular)
        restHint.textColor = NSColor(hex: "#737373")
        restHint.isBordered = false
        restHint.isEditable = false
        restHint.drawsBackground = false
        restHint.translatesAutoresizingMaskIntoConstraints = false

        container.addSubview(tcLabel)
        container.addSubview(tweetClawPortField)
        container.addSubview(aiLabel)
        container.addSubview(aiClawPortField)
        container.addSubview(restLabel)
        container.addSubview(restPortField)
        container.addSubview(restHint)

        NSLayoutConstraint.activate([
            tcLabel.topAnchor.constraint(equalTo: container.topAnchor),
            tcLabel.leadingAnchor.constraint(equalTo: container.leadingAnchor),

            tweetClawPortField.topAnchor.constraint(equalTo: tcLabel.bottomAnchor, constant: 8),
            tweetClawPortField.leadingAnchor.constraint(equalTo: container.leadingAnchor),

            aiLabel.topAnchor.constraint(equalTo: tweetClawPortField.bottomAnchor, constant: 24),  // 增加间距
            aiLabel.leadingAnchor.constraint(equalTo: container.leadingAnchor),

            aiClawPortField.topAnchor.constraint(equalTo: aiLabel.bottomAnchor, constant: 8),
            aiClawPortField.leadingAnchor.constraint(equalTo: container.leadingAnchor),

            restLabel.topAnchor.constraint(equalTo: aiClawPortField.bottomAnchor, constant: 24),  // 增加间距
            restLabel.leadingAnchor.constraint(equalTo: container.leadingAnchor),

            restPortField.topAnchor.constraint(equalTo: restLabel.bottomAnchor, constant: 8),
            restPortField.leadingAnchor.constraint(equalTo: container.leadingAnchor),

            restHint.topAnchor.constraint(equalTo: restPortField.bottomAnchor, constant: 8),
            restHint.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            restHint.bottomAnchor.constraint(equalTo: container.bottomAnchor)
        ])

        return container
    }

    private func makeInfoFooter() -> NSView {
        let container = NSView()
        container.translatesAutoresizingMaskIntoConstraints = false

        let icon = NSImageView()
        if #available(macOS 11.0, *) {
            icon.image = NSImage(systemSymbolName: "info.circle", accessibilityDescription: nil)
            icon.symbolConfiguration = NSImage.SymbolConfiguration(pointSize: 12, weight: .regular)
        }
        icon.contentTintColor = NSColor(hex: "#737373")
        icon.translatesAutoresizingMaskIntoConstraints = false

        let label = NSTextField(labelWithString: "Changes require a service restart to take effect.")
        label.font = NSFont.systemFont(ofSize: 11, weight: .regular)
        label.textColor = NSColor(hex: "#737373")
        label.isBordered = false
        label.isEditable = false
        label.drawsBackground = false
        label.translatesAutoresizingMaskIntoConstraints = false

        container.addSubview(icon)
        container.addSubview(label)

        NSLayoutConstraint.activate([
            icon.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            icon.centerYAnchor.constraint(equalTo: container.centerYAnchor),
            icon.widthAnchor.constraint(equalToConstant: 14),
            icon.heightAnchor.constraint(equalToConstant: 14),

            label.leadingAnchor.constraint(equalTo: icon.trailingAnchor, constant: 6),
            label.centerYAnchor.constraint(equalTo: container.centerYAnchor),
            label.trailingAnchor.constraint(equalTo: container.trailingAnchor),

            container.heightAnchor.constraint(equalToConstant: 20)
        ])

        return container
    }

    private func makeSettingsCard(title: String, icon: String, iconColor: NSColor, views: [NSView]) -> NSView {
        let container = NSView()
        container.wantsLayer = true
        container.translatesAutoresizingMaskIntoConstraints = false

        // 背景
        container.layer?.backgroundColor = DSV2.surfaceContainerLow.cgColor
        container.layer?.cornerRadius = 12  // 更大的圆角

        // 标题行
        let iconView = NSImageView()
        if #available(macOS 11.0, *) {
            iconView.image = NSImage(systemSymbolName: icon, accessibilityDescription: nil)
            iconView.symbolConfiguration = NSImage.SymbolConfiguration(pointSize: 18, weight: .medium)
        }
        iconView.contentTintColor = iconColor
        iconView.translatesAutoresizingMaskIntoConstraints = false

        let titleLabel = NSTextField(labelWithString: title.uppercased())
        titleLabel.font = NSFont.systemFont(ofSize: 12, weight: .semibold)
        titleLabel.textColor = NSColor(hex: "#737373")
        titleLabel.isBordered = false
        titleLabel.isEditable = false
        titleLabel.drawsBackground = false
        titleLabel.translatesAutoresizingMaskIntoConstraints = false

        let headerStack = NSStackView(views: [iconView, titleLabel])
        headerStack.orientation = .horizontal
        headerStack.spacing = 8
        headerStack.alignment = .centerY
        headerStack.translatesAutoresizingMaskIntoConstraints = false

        // 内容
        let contentStack = NSStackView(views: views)
        contentStack.orientation = .vertical
        contentStack.alignment = .leading
        contentStack.spacing = 20  // 增加内容间距
        contentStack.translatesAutoresizingMaskIntoConstraints = false

        container.addSubview(headerStack)
        container.addSubview(contentStack)

        NSLayoutConstraint.activate([
            iconView.widthAnchor.constraint(equalToConstant: 20),
            iconView.heightAnchor.constraint(equalToConstant: 20),

            headerStack.topAnchor.constraint(equalTo: container.topAnchor, constant: 24),
            headerStack.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 32),  // 更大的内边距

            contentStack.topAnchor.constraint(equalTo: headerStack.bottomAnchor, constant: 24),
            contentStack.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 32),  // 更大的内边距
            contentStack.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -32),  // 更大的内边距
            contentStack.bottomAnchor.constraint(equalTo: container.bottomAnchor, constant: -32)  // 更大的内边距
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
