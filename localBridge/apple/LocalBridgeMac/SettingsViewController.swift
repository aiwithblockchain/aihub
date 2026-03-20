import AppKit

// MARK: - Centered Text Field

class CenteredTextField: NSTextField {
    override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
    }

    override var intrinsicContentSize: NSSize {
        var size = super.intrinsicContentSize
        size.height = 40
        return size
    }

    override func textDidBeginEditing(_ notification: Notification) {
        super.textDidBeginEditing(notification)
        if let fieldEditor = window?.fieldEditor(true, for: self) as? NSTextView {
            fieldEditor.drawsBackground = false
        }
    }
}

class CenteredTextFieldCell: NSTextFieldCell {
    override func drawingRect(forBounds rect: NSRect) -> NSRect {
        var newRect = super.drawingRect(forBounds: rect)
        let textSize = self.cellSize(forBounds: rect)
        let delta = (rect.size.height - textSize.height) / 2
        newRect.origin.y = delta
        return newRect
    }
}

// MARK: - Collapsible Card Container

class CollapsibleCardContainer: NSView {
    private let headerView: NSView
    private let contentView: NSView
    private let chevronView: NSImageView
    private var isExpanded = false

    init(headerView: NSView, contentView: NSView, chevronView: NSImageView) {
        self.headerView = headerView
        self.contentView = contentView
        self.chevronView = chevronView
        super.init(frame: .zero)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    @objc func toggleCollapse() {
        isExpanded.toggle()

        NSAnimationContext.runAnimationGroup({ context in
            context.duration = 0.25
            context.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
            context.allowsImplicitAnimation = true

            contentView.isHidden = !isExpanded

            if #available(macOS 11.0, *) {
                chevronView.image = NSImage(systemSymbolName: isExpanded ? "chevron.down" : "chevron.right", accessibilityDescription: nil)
            }

            self.superview?.layoutSubtreeIfNeeded()
        })
    }
}

final class SettingsViewController: NSViewController {
    private let titleLabel = NSTextField(labelWithString: "设置")
    private let stayOnTopCheckbox = NSButton(checkboxWithTitle: "窗口保持在最前面", target: nil, action: #selector(toggleStayOnTop))

    // 配置数据
    private var currentConfig: BridgeConfig = BridgeConfig.load()
    private var originalConfig: BridgeConfig = BridgeConfig.load()

    // 局域网 IP 列表
    private var lanIPs: [String] = []

    // UI 组件字典 - 用于动态更新
    private var serviceViews: [String: ServiceConfigView] = [:]

    override func loadView() {
        let view = NSView()
        view.wantsLayer = true
        view.layer?.backgroundColor = DSV2.surface.cgColor
        self.view = view
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        lanIPs = NetworkUtils.getLocalIPAddresses()
        setupUI()
    }

    override func viewWillAppear() {
        super.viewWillAppear()
        updateCheckboxState()
    }

    private func setupUI() {
        // Title
        titleLabel.font = NSFont.systemFont(ofSize: 28, weight: .bold)
        titleLabel.textColor = NSColor(hex: "#E5E2E1")
        titleLabel.stringValue = "App Configuration"
        titleLabel.translatesAutoresizingMaskIntoConstraints = false

        // Subtitle
        let subtitleLabel = NSTextField(labelWithString: "Manage your instance protocols and local environment behaviors.")
        subtitleLabel.font = DSV2.fontBodyMd
        subtitleLabel.textColor = DSV2.onSurfaceVariant
        subtitleLabel.translatesAutoresizingMaskIntoConstraints = false

        // 配置复选框
        stayOnTopCheckbox.title = ""
        stayOnTopCheckbox.translatesAutoresizingMaskIntoConstraints = false
        stayOnTopCheckbox.target = self
        if #available(macOS 10.14, *) {
            stayOnTopCheckbox.contentTintColor = NSColor(hex: "#4A9EFF")
        }

        // 创建卡片
        let generalCard = makeSettingsCard(
            title: "General",
            icon: "tune",
            iconColor: DSV2.primary,
            views: [makeCheckboxRow()]
        )

        // 创建服务配置卡片
        let aiClawCard = makeServiceCard(serviceName: "aiClaw", title: "AIClaw WebSocket", icon: "network", defaultPort: 10087)
        let tweetClawCard = makeServiceCard(serviceName: "tweetClaw", title: "TweetClaw WebSocket", icon: "network", defaultPort: 10086)
        let restAPICard = makeServiceCard(serviceName: "restAPI", title: "REST API", icon: "server.rack", defaultPort: 10088)

        let contentStack = NSStackView(views: [
            titleLabel,
            subtitleLabel,
            generalCard,
            aiClawCard,
            tweetClawCard,
            restAPICard
        ])
        contentStack.orientation = .vertical
        contentStack.alignment = .leading
        contentStack.spacing = DSV2.spacing6
        contentStack.translatesAutoresizingMaskIntoConstraints = false

        // 创建滚动视图
        let scrollView = NSScrollView()
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.hasVerticalScroller = true
        scrollView.hasHorizontalScroller = false
        scrollView.autohidesScrollers = true
        scrollView.drawsBackground = false
        scrollView.contentInsets = NSEdgeInsets(top: 0, left: 0, bottom: 0, right: 0)
        scrollView.automaticallyAdjustsContentInsets = false

        // 将 contentStack 包装在一个容器中
        let containerView = NSView()
        containerView.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(contentStack)

        scrollView.documentView = containerView

        view.addSubview(scrollView)

        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: DSV2.spacing8),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -DSV2.spacing8),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -DSV2.spacing8),

            contentStack.topAnchor.constraint(equalTo: containerView.topAnchor, constant: 16),
            contentStack.leadingAnchor.constraint(equalTo: containerView.leadingAnchor),
            contentStack.trailingAnchor.constraint(equalTo: containerView.trailingAnchor),
            contentStack.bottomAnchor.constraint(equalTo: containerView.bottomAnchor, constant: -16),
            contentStack.widthAnchor.constraint(equalTo: scrollView.widthAnchor),

            generalCard.widthAnchor.constraint(equalTo: contentStack.widthAnchor),
            aiClawCard.widthAnchor.constraint(equalTo: contentStack.widthAnchor),
            tweetClawCard.widthAnchor.constraint(equalTo: contentStack.widthAnchor),
            restAPICard.widthAnchor.constraint(equalTo: contentStack.widthAnchor)
        ])
    }

    private func makeServiceCard(serviceName: String, title: String, icon: String, defaultPort: Int) -> NSView {
        let configView = ServiceConfigView(
            serviceName: serviceName,
            title: title,
            config: getServiceConfig(serviceName),
            lanIPs: lanIPs,
            defaultPort: defaultPort,
            onConfigChanged: { [weak self] newConfig in
                self?.updateServiceConfig(serviceName, config: newConfig)
            },
            onSaveAndRestart: { [weak self] in
                self?.saveAndRestartService(serviceName)
            }
        )

        serviceViews[serviceName] = configView

        return makeCollapsibleCard(
            title: title.uppercased(),
            icon: icon,
            iconColor: DSV2.secondary,
            contentView: configView
        )
    }

    private func getServiceConfig(_ serviceName: String) -> ServiceConfig {
        switch serviceName {
        case "aiClaw":
            return currentConfig.aiClawWS
        case "tweetClaw":
            return currentConfig.tweetClawWS
        case "restAPI":
            return currentConfig.restAPI
        default:
            return ServiceConfig(addresses: [])
        }
    }

    private func updateServiceConfig(_ serviceName: String, config: ServiceConfig) {
        switch serviceName {
        case "aiClaw":
            currentConfig.aiClawWS = config
        case "tweetClaw":
            currentConfig.tweetClawWS = config
        case "restAPI":
            currentConfig.restAPI = config
        default:
            break
        }
    }

    private func saveAndRestartService(_ serviceName: String) {
        // 保存配置
        currentConfig.save()
        originalConfig = currentConfig

        // 通知重启服务
        NotificationCenter.default.post(name: NSNotification.Name("RestartWebSocketServer"), object: nil)

        // 显示成功提示
        let alert = NSAlert()
        alert.messageText = "保存成功"
        alert.informativeText = "\(serviceName) 配置已保存，服务已在后台重启。"
        alert.alertStyle = .informational
        alert.addButton(withTitle: "确定")
        alert.runModal()

        // 更新按钮状态
        serviceViews[serviceName]?.resetButtonState()
    }

    private func makeCheckboxRow() -> NSView {
        let container = NSView()
        container.translatesAutoresizingMaskIntoConstraints = false

        let rowContainer = NSView()
        rowContainer.translatesAutoresizingMaskIntoConstraints = false

        stayOnTopCheckbox.title = ""
        stayOnTopCheckbox.translatesAutoresizingMaskIntoConstraints = false

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
            stayOnTopCheckbox.leadingAnchor.constraint(equalTo: rowContainer.leadingAnchor),
            stayOnTopCheckbox.topAnchor.constraint(equalTo: rowContainer.topAnchor, constant: 2),
            stayOnTopCheckbox.widthAnchor.constraint(equalToConstant: 20),
            stayOnTopCheckbox.heightAnchor.constraint(equalToConstant: 20),

            textContainer.leadingAnchor.constraint(equalTo: stayOnTopCheckbox.trailingAnchor, constant: 12),
            textContainer.trailingAnchor.constraint(equalTo: rowContainer.trailingAnchor),
            textContainer.topAnchor.constraint(equalTo: rowContainer.topAnchor),
            textContainer.bottomAnchor.constraint(equalTo: rowContainer.bottomAnchor),

            label.topAnchor.constraint(equalTo: textContainer.topAnchor),
            label.leadingAnchor.constraint(equalTo: textContainer.leadingAnchor),
            label.trailingAnchor.constraint(equalTo: textContainer.trailingAnchor),

            hint.topAnchor.constraint(equalTo: label.bottomAnchor, constant: 4),
            hint.leadingAnchor.constraint(equalTo: textContainer.leadingAnchor),
            hint.trailingAnchor.constraint(equalTo: textContainer.trailingAnchor),
            hint.bottomAnchor.constraint(equalTo: textContainer.bottomAnchor),

            rowContainer.topAnchor.constraint(equalTo: container.topAnchor),
            rowContainer.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            rowContainer.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            rowContainer.bottomAnchor.constraint(equalTo: container.bottomAnchor)
        ])

        return container
    }

    private func makeSettingsCard(title: String, icon: String, iconColor: NSColor, views: [NSView]) -> NSView {
        let container = NSView()
        container.wantsLayer = true
        container.translatesAutoresizingMaskIntoConstraints = false

        container.layer?.backgroundColor = DSV2.surfaceContainerLow.cgColor
        container.layer?.cornerRadius = 12

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

        let contentStack = NSStackView(views: views)
        contentStack.orientation = .vertical
        contentStack.alignment = .leading
        contentStack.spacing = 20
        contentStack.translatesAutoresizingMaskIntoConstraints = false

        container.addSubview(headerStack)
        container.addSubview(contentStack)

        NSLayoutConstraint.activate([
            iconView.widthAnchor.constraint(equalToConstant: 20),
            iconView.heightAnchor.constraint(equalToConstant: 20),

            headerStack.topAnchor.constraint(equalTo: container.topAnchor, constant: 24),
            headerStack.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 32),

            contentStack.topAnchor.constraint(equalTo: headerStack.bottomAnchor, constant: 24),
            contentStack.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 32),
            contentStack.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -32),
            contentStack.bottomAnchor.constraint(equalTo: container.bottomAnchor, constant: -32)
        ])

        return container
    }

    private func makeCollapsibleCard(title: String, icon: String, iconColor: NSColor, contentView: NSView) -> NSView {
        let chevronView = NSImageView()
        if #available(macOS 11.0, *) {
            chevronView.image = NSImage(systemSymbolName: "chevron.right", accessibilityDescription: nil)
            chevronView.symbolConfiguration = NSImage.SymbolConfiguration(pointSize: 14, weight: .medium)
        }
        chevronView.contentTintColor = NSColor(hex: "#737373")
        chevronView.translatesAutoresizingMaskIntoConstraints = false

        // Header
        let headerContainer = NSView()
        headerContainer.translatesAutoresizingMaskIntoConstraints = false

        let iconView = NSImageView()
        if #available(macOS 11.0, *) {
            iconView.image = NSImage(systemSymbolName: icon, accessibilityDescription: nil)
            iconView.symbolConfiguration = NSImage.SymbolConfiguration(pointSize: 18, weight: .medium)
        }
        iconView.contentTintColor = iconColor
        iconView.translatesAutoresizingMaskIntoConstraints = false

        let titleLabel = NSTextField(labelWithString: title)
        titleLabel.font = NSFont.systemFont(ofSize: 12, weight: .semibold)
        titleLabel.textColor = NSColor(hex: "#737373")
        titleLabel.isBordered = false
        titleLabel.isEditable = false
        titleLabel.drawsBackground = false
        titleLabel.translatesAutoresizingMaskIntoConstraints = false

        headerContainer.addSubview(iconView)
        headerContainer.addSubview(titleLabel)
        headerContainer.addSubview(chevronView)

        NSLayoutConstraint.activate([
            iconView.leadingAnchor.constraint(equalTo: headerContainer.leadingAnchor),
            iconView.centerYAnchor.constraint(equalTo: headerContainer.centerYAnchor),
            iconView.widthAnchor.constraint(equalToConstant: 20),
            iconView.heightAnchor.constraint(equalToConstant: 20),

            titleLabel.leadingAnchor.constraint(equalTo: iconView.trailingAnchor, constant: 8),
            titleLabel.centerYAnchor.constraint(equalTo: headerContainer.centerYAnchor),

            chevronView.trailingAnchor.constraint(equalTo: headerContainer.trailingAnchor),
            chevronView.centerYAnchor.constraint(equalTo: headerContainer.centerYAnchor),
            chevronView.widthAnchor.constraint(equalToConstant: 20),
            chevronView.heightAnchor.constraint(equalToConstant: 20),

            headerContainer.heightAnchor.constraint(equalToConstant: 24)
        ])

        // Content - 默认隐藏
        contentView.translatesAutoresizingMaskIntoConstraints = false
        contentView.isHidden = true

        // 使用 StackView 来自动处理布局
        let stackView = NSStackView(views: [headerContainer, contentView])
        stackView.orientation = .vertical
        stackView.alignment = .leading
        stackView.spacing = 24
        stackView.translatesAutoresizingMaskIntoConstraints = false
        stackView.setHuggingPriority(.required, for: .vertical)
        stackView.setContentCompressionResistancePriority(.required, for: .vertical)

        // Container
        let container = CollapsibleCardContainer(headerView: headerContainer, contentView: contentView, chevronView: chevronView)
        container.wantsLayer = true
        container.translatesAutoresizingMaskIntoConstraints = false
        container.layer?.backgroundColor = DSV2.surfaceContainerLow.cgColor
        container.layer?.cornerRadius = 12

        container.addSubview(stackView)

        // 点击区域
        let clickArea = NSButton()
        clickArea.title = ""
        clickArea.isBordered = false
        clickArea.bezelStyle = .regularSquare
        clickArea.translatesAutoresizingMaskIntoConstraints = false
        clickArea.target = container
        clickArea.action = #selector(CollapsibleCardContainer.toggleCollapse)
        container.addSubview(clickArea)

        NSLayoutConstraint.activate([
            stackView.topAnchor.constraint(equalTo: container.topAnchor, constant: 24),
            stackView.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 32),
            stackView.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -32),
            stackView.bottomAnchor.constraint(equalTo: container.bottomAnchor, constant: -24),

            clickArea.topAnchor.constraint(equalTo: headerContainer.topAnchor, constant: -8),
            clickArea.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            clickArea.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            clickArea.heightAnchor.constraint(equalToConstant: 40)
        ])

        return container
    }

    private func updateCheckboxState() {
        guard let window = view.window else { return }
        stayOnTopCheckbox.state = window.level == .floating ? .on : .off
    }

    @objc private func toggleStayOnTop() {
        guard let window = view.window else { return }
        window.level = stayOnTopCheckbox.state == .on ? .floating : .normal
    }
}

// MARK: - Service Config View

class ServiceConfigView: NSView {
    private let serviceName: String
    private var config: ServiceConfig
    private let lanIPs: [String]
    private let defaultPort: Int
    private let onConfigChanged: (ServiceConfig) -> Void
    private let onSaveAndRestart: () -> Void

    private var localhostPortField: NSTextField!
    private var lanIPCheckboxes: [String: NSButton] = [:]
    private var lanIPPortFields: [String: NSTextField] = [:]
    private var saveButton: NSButton!
    private var hasChanges = false

    init(serviceName: String, title: String, config: ServiceConfig, lanIPs: [String], defaultPort: Int,
         onConfigChanged: @escaping (ServiceConfig) -> Void,
         onSaveAndRestart: @escaping () -> Void) {
        self.serviceName = serviceName
        self.config = config
        self.lanIPs = lanIPs
        self.defaultPort = defaultPort
        self.onConfigChanged = onConfigChanged
        self.onSaveAndRestart = onSaveAndRestart

        super.init(frame: .zero)
        setupUI()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func setupUI() {
        translatesAutoresizingMaskIntoConstraints = false

        let contentStack = NSStackView()
        contentStack.orientation = .vertical
        contentStack.alignment = .leading
        contentStack.spacing = 16
        contentStack.translatesAutoresizingMaskIntoConstraints = false

        // 127.0.0.1 配置行
        let localhostRow = makeLocalhostRow()
        contentStack.addArrangedSubview(localhostRow)

        // 局域网 IP 配置行
        if !lanIPs.isEmpty {
            let separator = NSBox()
            separator.boxType = .separator
            separator.translatesAutoresizingMaskIntoConstraints = false
            contentStack.addArrangedSubview(separator)
            separator.widthAnchor.constraint(equalToConstant: 600).isActive = true

            let lanLabel = NSTextField(labelWithString: "LAN IP ADDRESSES (OPTIONAL)")
            lanLabel.font = NSFont.systemFont(ofSize: 11, weight: .semibold)
            lanLabel.textColor = NSColor(hex: "#737373")
            lanLabel.isBordered = false
            lanLabel.isEditable = false
            lanLabel.drawsBackground = false
            contentStack.addArrangedSubview(lanLabel)

            for ip in lanIPs {
                let lanRow = makeLANIPRow(ip: ip)
                contentStack.addArrangedSubview(lanRow)
            }
        }

        // 保存按钮
        saveButton = makeSaveButton()
        contentStack.addArrangedSubview(saveButton)

        addSubview(contentStack)

        NSLayoutConstraint.activate([
            contentStack.topAnchor.constraint(equalTo: topAnchor),
            contentStack.leadingAnchor.constraint(equalTo: leadingAnchor),
            contentStack.trailingAnchor.constraint(equalTo: trailingAnchor),
            contentStack.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
    }

    private func makeLocalhostRow() -> NSView {
        let container = NSView()
        container.translatesAutoresizingMaskIntoConstraints = false

        let label = NSTextField(labelWithString: "127.0.0.1")
        label.font = DSV2.fontMonoMd
        label.textColor = NSColor(hex: "#E5E2E1")
        label.isBordered = false
        label.isEditable = false
        label.drawsBackground = false
        label.translatesAutoresizingMaskIntoConstraints = false

        localhostPortField = CenteredTextField()
        localhostPortField.cell = CenteredTextFieldCell()
        styleInputField(localhostPortField)
        localhostPortField.stringValue = "\(getLocalhostPort())"
        localhostPortField.target = self
        localhostPortField.action = #selector(configChanged)

        container.addSubview(label)
        container.addSubview(localhostPortField)

        NSLayoutConstraint.activate([
            label.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            label.centerYAnchor.constraint(equalTo: container.centerYAnchor),
            label.widthAnchor.constraint(equalToConstant: 120),

            localhostPortField.leadingAnchor.constraint(equalTo: label.trailingAnchor, constant: 16),
            localhostPortField.centerYAnchor.constraint(equalTo: container.centerYAnchor),
            localhostPortField.trailingAnchor.constraint(equalTo: container.trailingAnchor),

            container.heightAnchor.constraint(equalToConstant: 40)
        ])

        return container
    }

    private func makeLANIPRow(ip: String) -> NSView {
        let container = NSView()
        container.translatesAutoresizingMaskIntoConstraints = false

        let checkbox = NSButton(checkboxWithTitle: "", target: self, action: #selector(configChanged))
        checkbox.translatesAutoresizingMaskIntoConstraints = false
        checkbox.state = isLANIPEnabled(ip) ? .on : .off
        lanIPCheckboxes[ip] = checkbox

        let label = NSTextField(labelWithString: ip)
        label.font = DSV2.fontMonoMd
        label.textColor = NSColor(hex: "#E5E2E1")
        label.isBordered = false
        label.isEditable = false
        label.drawsBackground = false
        label.translatesAutoresizingMaskIntoConstraints = false

        let portField = CenteredTextField()
        portField.cell = CenteredTextFieldCell()
        styleInputField(portField)
        portField.stringValue = "\(getLANIPPort(ip))"
        portField.target = self
        portField.action = #selector(configChanged)
        portField.isEnabled = checkbox.state == .on
        lanIPPortFields[ip] = portField

        container.addSubview(checkbox)
        container.addSubview(label)
        container.addSubview(portField)

        NSLayoutConstraint.activate([
            checkbox.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            checkbox.centerYAnchor.constraint(equalTo: container.centerYAnchor),
            checkbox.widthAnchor.constraint(equalToConstant: 20),

            label.leadingAnchor.constraint(equalTo: checkbox.trailingAnchor, constant: 8),
            label.centerYAnchor.constraint(equalTo: container.centerYAnchor),
            label.widthAnchor.constraint(equalToConstant: 100),

            portField.leadingAnchor.constraint(equalTo: label.trailingAnchor, constant: 16),
            portField.centerYAnchor.constraint(equalTo: container.centerYAnchor),
            portField.trailingAnchor.constraint(equalTo: container.trailingAnchor),

            container.heightAnchor.constraint(equalToConstant: 40)
        ])

        return container
    }

    private func makeSaveButton() -> NSButton {
        let button = NSButton(title: "Save and Restart", target: self, action: #selector(saveClicked))
        button.translatesAutoresizingMaskIntoConstraints = false
        button.wantsLayer = true
        button.isBordered = false
        button.bezelStyle = .rounded

        // 先赋值给 saveButton，然后再调用 updateButtonAppearance
        saveButton = button
        updateButtonAppearance(enabled: false)

        button.heightAnchor.constraint(equalToConstant: 44).isActive = true
        button.widthAnchor.constraint(greaterThanOrEqualToConstant: 200).isActive = true

        return button
    }

    private func updateButtonAppearance(enabled: Bool) {
        saveButton.isEnabled = enabled

        let alpha: CGFloat = enabled ? 1.0 : 0.5
        let color = enabled ? DSV2.primary : DSV2.onSurfaceVariant

        saveButton.layer?.backgroundColor = color.withAlphaComponent(alpha).cgColor
        saveButton.layer?.cornerRadius = DSV2.radiusButton

        let attributes: [NSAttributedString.Key: Any] = [
            .foregroundColor: NSColor.white,
            .font: NSFont.systemFont(ofSize: 13, weight: .bold)
        ]
        saveButton.attributedTitle = NSAttributedString(string: "Save and Restart", attributes: attributes)
    }

    @objc private func configChanged() {
        // 更新配置
        var newAddresses: [ListenAddress] = []

        // 127.0.0.1
        if let portStr = localhostPortField.stringValue as String?,
           let port = Int(portStr), port > 0 {
            newAddresses.append(ListenAddress(ip: "127.0.0.1", port: port, enabled: true))
        }

        // 局域网 IP
        for ip in lanIPs {
            if let checkbox = lanIPCheckboxes[ip],
               let portField = lanIPPortFields[ip],
               checkbox.state == .on,
               let port = Int(portField.stringValue), port > 0 {
                newAddresses.append(ListenAddress(ip: ip, port: port, enabled: true))
                portField.isEnabled = true
            } else if let portField = lanIPPortFields[ip] {
                portField.isEnabled = false
            }
        }

        config.addresses = newAddresses
        onConfigChanged(config)

        hasChanges = true
        updateButtonAppearance(enabled: true)
    }

    @objc private func saveClicked() {
        onSaveAndRestart()
    }

    func resetButtonState() {
        hasChanges = false
        updateButtonAppearance(enabled: false)
    }

    private func getLocalhostPort() -> Int {
        return config.addresses.first(where: { $0.ip == "127.0.0.1" })?.port ?? defaultPort
    }

    private func isLANIPEnabled(_ ip: String) -> Bool {
        return config.addresses.contains(where: { $0.ip == ip && $0.enabled })
    }

    private func getLANIPPort(_ ip: String) -> Int {
        return config.addresses.first(where: { $0.ip == ip })?.port ?? defaultPort
    }

    private func styleInputField(_ field: NSTextField) {
        field.wantsLayer = true
        field.isBordered = false
        field.drawsBackground = true
        field.backgroundColor = DSV2.surfaceContainerLowest
        field.textColor = NSColor(hex: "#E5E2E1")
        field.font = DSV2.fontMonoMd
        field.translatesAutoresizingMaskIntoConstraints = false
        field.focusRingType = .none
        field.alignment = .center
        field.usesSingleLineMode = true
        field.lineBreakMode = .byClipping

        field.layer?.borderWidth = 1
        field.layer?.borderColor = DSV2.outlineVariant.withAlphaComponent(0.15).cgColor
        field.layer?.cornerRadius = 8

        field.cell?.wraps = false
        field.cell?.isScrollable = true
        field.cell?.usesSingleLineMode = true

        field.heightAnchor.constraint(equalToConstant: 40).isActive = true
        field.widthAnchor.constraint(equalToConstant: 120).isActive = true
    }
}
