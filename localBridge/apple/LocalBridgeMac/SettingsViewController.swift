import AppKit

// MARK: - Custom Alert

/// 自定义深色主题提示框，符合 DSV2 设计规范
class CustomAlert {

    /// 显示成功提示框
    static func showSuccess(title: String, message: String, parentWindow: NSWindow? = nil) {
        guard let window = parentWindow, let contentView = window.contentView else {
            // 如果没有父窗口，使用系统 Alert 作为后备
            let alert = NSAlert()
            alert.messageText = title
            alert.informativeText = message
            alert.alertStyle = .informational
            alert.addButton(withTitle: LanguageManager.shared.localized("settings.confirm"))
            alert.runModal()
            return
        }

        // 创建叠加层
        let overlay = CustomAlertOverlay(title: title, message: message)
        overlay.frame = contentView.bounds
        overlay.autoresizingMask = [.width, .height]
        contentView.addSubview(overlay, positioned: .above, relativeTo: nil)

        // 淡入动画
        overlay.alphaValue = 0
        NSAnimationContext.runAnimationGroup({ context in
            context.duration = 0.2
            overlay.animator().alphaValue = 1
        })
    }
}

/// 自定义提示框叠加层
private class CustomAlertOverlay: NSView {
    private let alertBox: NSView

    init(title: String, message: String) {
        alertBox = NSView()
        super.init(frame: .zero)
        setupContent(title: title, message: message)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func setupContent(title: String, message: String) {
        self.wantsLayer = true

        // 半透明黑色背景
        self.layer?.backgroundColor = NSColor.black.withAlphaComponent(0.5).cgColor

        // 提示框容器
        alertBox.wantsLayer = true
        alertBox.layer?.backgroundColor = DSV2.surfaceContainerHigh.cgColor
        alertBox.layer?.cornerRadius = DSV2.radiusCard
        alertBox.layer?.shadowColor = NSColor.black.cgColor
        alertBox.layer?.shadowOpacity = 0.3
        alertBox.layer?.shadowOffset = CGSize(width: 0, height: 10)
        alertBox.layer?.shadowRadius = 20
        alertBox.translatesAutoresizingMaskIntoConstraints = false
        addSubview(alertBox)

        // 图标
        let iconView = makeSuccessIcon()
        alertBox.addSubview(iconView)

        // 标题
        let titleLabel = NSTextField(labelWithString: title)
        titleLabel.font = DSV2.fontTitleLg
        titleLabel.textColor = DSV2.onSurface
        titleLabel.alignment = .center
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        alertBox.addSubview(titleLabel)

        // 消息
        let messageLabel = NSTextField(wrappingLabelWithString: message)
        messageLabel.font = DSV2.fontBodyMd
        messageLabel.textColor = DSV2.onSurfaceVariant
        messageLabel.alignment = .center
        messageLabel.maximumNumberOfLines = 3
        messageLabel.translatesAutoresizingMaskIntoConstraints = false
        alertBox.addSubview(messageLabel)

        // 确定按钮
        let confirmButton = DSV2.makeGradientButton(
            title: LanguageManager.shared.localized("settings.confirm"),
            target: self,
            action: #selector(closeAlert)
        )
        alertBox.addSubview(confirmButton)

        // 布局
        NSLayoutConstraint.activate([
            alertBox.centerXAnchor.constraint(equalTo: centerXAnchor),
            alertBox.centerYAnchor.constraint(equalTo: centerYAnchor),
            alertBox.widthAnchor.constraint(equalToConstant: 360),
            alertBox.heightAnchor.constraint(equalToConstant: 240),

            iconView.topAnchor.constraint(equalTo: alertBox.topAnchor, constant: DSV2.spacing6),
            iconView.centerXAnchor.constraint(equalTo: alertBox.centerXAnchor),

            titleLabel.topAnchor.constraint(equalTo: iconView.bottomAnchor, constant: DSV2.spacing4),
            titleLabel.leadingAnchor.constraint(equalTo: alertBox.leadingAnchor, constant: DSV2.spacing6),
            titleLabel.trailingAnchor.constraint(equalTo: alertBox.trailingAnchor, constant: -DSV2.spacing6),

            messageLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: DSV2.spacing2),
            messageLabel.leadingAnchor.constraint(equalTo: alertBox.leadingAnchor, constant: DSV2.spacing6),
            messageLabel.trailingAnchor.constraint(equalTo: alertBox.trailingAnchor, constant: -DSV2.spacing6),

            confirmButton.topAnchor.constraint(equalTo: messageLabel.bottomAnchor, constant: DSV2.spacing6),
            confirmButton.centerXAnchor.constraint(equalTo: alertBox.centerXAnchor),
            confirmButton.widthAnchor.constraint(equalToConstant: 120)
        ])
    }

    private func makeSuccessIcon() -> NSView {
        let container = NSView()
        container.wantsLayer = true
        container.translatesAutoresizingMaskIntoConstraints = false

        let imageView = NSImageView()
        imageView.image = NSImage(named: "shrimp_icon")
        imageView.imageScaling = .scaleProportionallyUpOrDown
        imageView.translatesAutoresizingMaskIntoConstraints = false

        // 如果没有找到虾虾图标，使用 SF Symbol
        if imageView.image == nil {
            if #available(macOS 11.0, *) {
                imageView.image = NSImage(systemSymbolName: "checkmark.circle.fill", accessibilityDescription: nil)
                imageView.contentTintColor = DSV2.tertiary
            }
        }

        container.addSubview(imageView)

        NSLayoutConstraint.activate([
            imageView.centerXAnchor.constraint(equalTo: container.centerXAnchor),
            imageView.centerYAnchor.constraint(equalTo: container.centerYAnchor),
            imageView.widthAnchor.constraint(equalToConstant: 64),
            imageView.heightAnchor.constraint(equalToConstant: 64),
            container.widthAnchor.constraint(equalToConstant: 80),
            container.heightAnchor.constraint(equalToConstant: 80)
        ])

        return container
    }

    @objc private func closeAlert() {
        // 淡出动画后移除
        NSAnimationContext.runAnimationGroup({ context in
            context.duration = 0.2
            self.animator().alphaValue = 0
        }, completionHandler: {
            self.removeFromSuperview()
        })
    }

    // 点击背景也可以关闭
    override func mouseDown(with event: NSEvent) {
        let location = convert(event.locationInWindow, from: nil)
        if !alertBox.frame.contains(location) {
            closeAlert()
        }
    }
}

// MARK: - Centered Text Field

class CenteredTextField: NSTextField {
    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        self.cell = CenteredTextFieldCell()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        self.cell = CenteredTextFieldCell()
    }

    override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
    }

    override var intrinsicContentSize: NSSize {
        // 让高度回归文本自然高度，从而允许外部容器进行 centerY 居中
        return super.intrinsicContentSize
    }

    override func becomeFirstResponder() -> Bool {
        let success = super.becomeFirstResponder()
        if success, let fieldEditor = window?.fieldEditor(true, for: self) as? NSTextView {
            // 关键：强制 Field Editor 透明，避免出现黑色背景条
            fieldEditor.drawsBackground = false
            fieldEditor.backgroundColor = .clear
            fieldEditor.insertionPointColor = textColor ?? .white
            fieldEditor.font = font
        }
        return success
    }
}

final class CenteredTextFieldCell: NSTextFieldCell {
    override func titleRect(forBounds rect: NSRect) -> NSRect {
        var titleRect = super.titleRect(forBounds: rect)
        
        let titleSize = self.attributedStringValue.size()
        if titleSize.height > 0 {
            titleRect.origin.y = (rect.height - titleSize.height) / 2
            titleRect.size.height = titleSize.height
        }
        
        // 保持水平边距
        titleRect.origin.x = 8
        titleRect.size.width = rect.width - 16
        return titleRect
    }

    override func drawInterior(withFrame cellFrame: NSRect, in controlView: NSView) {
        super.drawInterior(withFrame: titleRect(forBounds: cellFrame), in: controlView)
    }

    override func select(withFrame rect: NSRect, in controlView: NSView, editor textObj: NSText, delegate: Any?, start selStart: Int, length selLength: Int) {
        super.select(withFrame: titleRect(forBounds: rect), in: controlView, editor: textObj, delegate: delegate, start: selStart, length: selLength)
    }

    override func edit(withFrame rect: NSRect, in controlView: NSView, editor textObj: NSText, delegate: Any?, event: NSEvent?) {
        super.edit(withFrame: titleRect(forBounds: rect), in: controlView, editor: textObj, delegate: delegate, event: event)
    }
}
// MARK: - Flipped View

class SettingsFlippedView: NSView {
    override var isFlipped: Bool { true }
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

            invalidateIntrinsicContentSize()
            needsLayout = true
            superview?.needsLayout = true
        }, completionHandler: nil)
    }
}

final class SettingsViewController: NSViewController {
    private let headerImageView = NSImageView()
    private let titleLabel = NSTextField(labelWithString: "")
    private let subtitleLabel = NSTextField(labelWithString: "")
    private let headerSeparator = NSView()
    private let stayOnTopCheckbox = NSButton(checkboxWithTitle: "", target: nil, action: #selector(toggleStayOnTop))
    private var themeSegmentedControl: SegmentedControl!
    private var languageSegmentedControl: SegmentedControl!

    // UI labels that need to be updated on language change
    private var generalCardTitle: NSTextField!
    private var checkboxLabel: NSTextField!
    private var checkboxHint: NSTextField!
    private var themeLabel: NSTextField!
    private var themeDescLabel: NSTextField!
    private var languageLabel: NSTextField!
    private var languageDescLabel: NSTextField!
    private var aiClawCardTitle: NSTextField!
    private var tweetClawCardTitle: NSTextField!
    private var restAPICardTitle: NSTextField!

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

        // 监听主题变化
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(themeDidChange),
            name: ThemeManager.themeDidChangeNotification,
            object: nil
        )

        // 监听语言变化
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleLanguageChange),
            name: LanguageManager.languageDidChangeNotification,
            object: nil
        )
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    @objc private func handleLanguageChange() {
        updateAllText()
    }

    private func updateAllText() {
        titleLabel.stringValue = LanguageManager.shared.localized("settings.title")
        subtitleLabel.stringValue = LanguageManager.shared.localized("settings.subtitle")
        checkboxLabel?.stringValue = LanguageManager.shared.localized("settings.keep_on_top")
        checkboxHint?.stringValue = LanguageManager.shared.localized("settings.keep_on_top.hint")
        generalCardTitle?.stringValue = LanguageManager.shared.localized("settings.general").uppercased()
        aiClawCardTitle?.stringValue = LanguageManager.shared.localized("settings.aiclaw_websocket").uppercased()
        tweetClawCardTitle?.stringValue = LanguageManager.shared.localized("settings.tweetclaw_websocket").uppercased()
        restAPICardTitle?.stringValue = LanguageManager.shared.localized("settings.rest_api").uppercased()
        languageLabel?.stringValue = LanguageManager.shared.localized("settings.language")
        languageDescLabel?.stringValue = LanguageManager.shared.localized("settings.language.description")
        themeLabel?.stringValue = LanguageManager.shared.localized("settings.theme")
        themeDescLabel?.stringValue = LanguageManager.shared.localized("settings.theme.description")

        // Update theme segmented control button labels
        themeSegmentedControl?.updateItems([
            LanguageManager.shared.localized("settings.theme.dark"),
            LanguageManager.shared.localized("settings.theme.light"),
            LanguageManager.shared.localized("settings.theme.auto")
        ])
    }

    override func viewWillAppear() {
        super.viewWillAppear()
        updateCheckboxState()
    }

    @objc private func themeDidChange() {
        applyTheme()
    }

    private func applyTheme() {
        // 更新主视图背景
        view.layer?.backgroundColor = DSV2.surface.cgColor

        // 更新标题和副标题
        titleLabel.textColor = DSV2.onSurface
        subtitleLabel.textColor = DSV2.onSurfaceTertiary
        headerImageView.contentTintColor = DSV2.primary
        headerSeparator.layer?.backgroundColor = DSV2.divider.withAlphaComponent(0.8).cgColor

        // 更新分段按钮外观
        languageSegmentedControl?.updateSegmentedControlTheme()
        themeSegmentedControl?.updateSegmentedControlTheme()

        // 递归更新所有卡片和子视图
        updateViewColors(view)

        // 强制重绘
        view.needsDisplay = true
        view.needsLayout = true
    }

    private func updateViewColors(_ view: NSView) {
        // 更新 layer 背景色
        if let layer = view.layer {
            // 检查是否是卡片背景
            if layer.cornerRadius == DSV2.radiusContainer {
                layer.backgroundColor = DSV2.surfaceContainerHigh.withAlphaComponent(0.8).cgColor
                layer.borderColor = DSV2.cardBorder.withAlphaComponent(0.15).cgColor
            }
            // 检查是否是输入框容器背景
            else if layer.cornerRadius == 8 || layer.cornerRadius == DSV2.radiusInput {
                layer.backgroundColor = DSV2.surfaceContainerHigh.cgColor
                layer.borderColor = DSV2.outlineVariant.withAlphaComponent(0.3).cgColor
            }
            // 更新分割线
            if view is NSBox || (view.wantsLayer && view.frame.height <= 1) {
                view.layer?.backgroundColor = DSV2.divider.cgColor
            }
            // 更新边框颜色 (如果不是卡片或输入框)
            if layer.borderWidth > 0 && layer.cornerRadius != DSV2.radiusContainer && layer.cornerRadius != 8 && layer.cornerRadius != DSV2.radiusInput {
                layer.borderColor = DSV2.outlineVariant.withAlphaComponent(0.3).cgColor
            }
        }

        // 更新文本颜色
        if let textField = view as? NSTextField {
            // 对所有非编辑状态的标签根据字体大小判断颜色
            if !textField.isEditable || textField is CenteredTextField {
                if let font = textField.font {
                    if font.pointSize >= 18 {
                        textField.textColor = DSV2.onSurface
                    } else if font.pointSize >= 13 {
                        textField.textColor = DSV2.onSurface
                    } else {
                        textField.textColor = DSV2.onSurfaceVariant
                    }
                }
            } else {
                // 编辑状态的输入框文本颜色
                textField.textColor = DSV2.onSurface
            }
        }

        // 递归处理子视图
        for subview in view.subviews {
            updateViewColors(subview)
        }
    }

    private func setupUI() {
        // Header Icon
        if #available(macOS 11.0, *) {
            headerImageView.image = NSImage(systemSymbolName: "gearshape.fill", accessibilityDescription: nil)
            headerImageView.symbolConfiguration = NSImage.SymbolConfiguration(pointSize: 20, weight: .semibold)
            headerImageView.contentTintColor = DSV2.primary
        }
        headerImageView.translatesAutoresizingMaskIntoConstraints = false

        // Title
        titleLabel.font = DSV2.fontTitleLg
        titleLabel.textColor = DSV2.onSurface
        titleLabel.stringValue = LanguageManager.shared.localized("settings.title")
        titleLabel.translatesAutoresizingMaskIntoConstraints = false

        // Subtitle
        subtitleLabel.font = DSV2.fontLabelSm
        subtitleLabel.textColor = DSV2.onSurfaceTertiary
        subtitleLabel.stringValue = LanguageManager.shared.localized("settings.subtitle")
        subtitleLabel.translatesAutoresizingMaskIntoConstraints = false

        // Header layout
        let headerLeft = NSStackView(views: [headerImageView, titleLabel])
        headerLeft.orientation = .horizontal
        headerLeft.spacing = DSV2.spacing2
        headerLeft.alignment = .centerY

        let headerStack = NSStackView(views: [headerLeft, subtitleLabel])
        headerStack.orientation = .vertical
        headerStack.spacing = 4
        headerStack.alignment = .leading
        headerStack.translatesAutoresizingMaskIntoConstraints = false

        // Header Separator
        headerSeparator.wantsLayer = true
        headerSeparator.layer?.backgroundColor = DSV2.divider.withAlphaComponent(0.8).cgColor
        headerSeparator.translatesAutoresizingMaskIntoConstraints = false

        // 配置复选框
        stayOnTopCheckbox.title = ""
        stayOnTopCheckbox.translatesAutoresizingMaskIntoConstraints = false
        stayOnTopCheckbox.target = self
        if #available(macOS 10.14, *) {
            stayOnTopCheckbox.contentTintColor = DSV2.primary
        }

        // 创建卡片
        let generalCard = makeSettingsCard(
            title: LanguageManager.shared.localized("settings.general"),
            icon: "tune",
            iconColor: DSV2.primary,
            views: [makeCheckboxRow(), makeLanguageRow(), makeThemeRow()]
        )

        // 创建服务配置卡片
        let aiClawCard = makeServiceCard(serviceName: "aiClaw", title: LanguageManager.shared.localized("settings.aiclaw_websocket"), icon: "network", defaultPort: 10087)
        let tweetClawCard = makeServiceCard(serviceName: "tweetClaw", title: LanguageManager.shared.localized("settings.tweetclaw_websocket"), icon: "network", defaultPort: 10086)
        let restAPICard = makeServiceCard(serviceName: "restAPI", title: LanguageManager.shared.localized("settings.rest_api"), icon: "server.rack", defaultPort: 10088)

        let cardStack = NSStackView(views: [
            generalCard,
            aiClawCard,
            tweetClawCard,
            restAPICard
        ])
        cardStack.orientation = .vertical
        cardStack.alignment = .leading
        cardStack.spacing = DSV2.spacing4
        cardStack.translatesAutoresizingMaskIntoConstraints = false

        // 创建滚动视图
        let scrollView = NSScrollView()
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.hasVerticalScroller = true
        scrollView.hasHorizontalScroller = false
        scrollView.drawsBackground = false
        scrollView.automaticallyAdjustsContentInsets = false

        // 将 contentStack 包装在一个容器中
        let containerView = SettingsFlippedView()
        containerView.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(cardStack)

        scrollView.documentView = containerView
        DSV2.applyBrightScroller(to: scrollView)

        view.addSubview(headerStack)
        view.addSubview(headerSeparator)
        view.addSubview(scrollView)

        NSLayoutConstraint.activate([
            headerStack.topAnchor.constraint(equalTo: view.topAnchor, constant: DSV2.spacing6),
            headerStack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: DSV2.spacing6 + 12),
            headerStack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -DSV2.spacing6),

            headerSeparator.topAnchor.constraint(equalTo: headerStack.bottomAnchor, constant: 12),
            headerSeparator.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            headerSeparator.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            headerSeparator.heightAnchor.constraint(equalToConstant: 1),

            scrollView.topAnchor.constraint(equalTo: headerSeparator.bottomAnchor, constant: 30),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: DSV2.spacing6),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -DSV2.spacing6),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -DSV2.spacing6),

            cardStack.topAnchor.constraint(equalTo: containerView.topAnchor),
            cardStack.leadingAnchor.constraint(equalTo: containerView.leadingAnchor),
            cardStack.trailingAnchor.constraint(equalTo: containerView.trailingAnchor),
            cardStack.bottomAnchor.constraint(equalTo: containerView.bottomAnchor, constant: -DSV2.spacing8),
            cardStack.widthAnchor.constraint(equalTo: scrollView.contentView.widthAnchor),

            generalCard.widthAnchor.constraint(equalTo: cardStack.widthAnchor),
            aiClawCard.widthAnchor.constraint(equalTo: cardStack.widthAnchor),
            tweetClawCard.widthAnchor.constraint(equalTo: cardStack.widthAnchor),
            restAPICard.widthAnchor.constraint(equalTo: cardStack.widthAnchor)
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

        let card = makeCollapsibleCard(
            title: title.uppercased(),
            icon: icon,
            iconColor: DSV2.secondary,
            contentView: configView
        )

        // Store references to service card titles by finding the title label in the card
        if let titleLabel = findTitleLabel(in: card) {
            if serviceName == "aiClaw" {
                aiClawCardTitle = titleLabel
            } else if serviceName == "tweetClaw" {
                tweetClawCardTitle = titleLabel
            } else if serviceName == "restAPI" {
                restAPICardTitle = titleLabel
            }
        }

        return card
    }

    private func findTitleLabel(in view: NSView) -> NSTextField? {
        if let textField = view as? NSTextField, textField.font == DSV2.fontLabelSm {
            return textField
        }
        for subview in view.subviews {
            if let found = findTitleLabel(in: subview) {
                return found
            }
        }
        return nil
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
        CustomAlert.showSuccess(
            title: LanguageManager.shared.localized("settings.saved"),
            message: LanguageManager.shared.localized("settings.saved.message"),
            parentWindow: view.window
        )

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

        checkboxLabel = NSTextField(labelWithString: LanguageManager.shared.localized("settings.keep_on_top"))
        checkboxLabel.font = DSV2.fontBodyMd
        checkboxLabel.textColor = DSV2.onSurface
        checkboxLabel.isBordered = false
        checkboxLabel.isEditable = false
        checkboxLabel.drawsBackground = false
        checkboxLabel.translatesAutoresizingMaskIntoConstraints = false

        checkboxHint = NSTextField(labelWithString: LanguageManager.shared.localized("settings.keep_on_top.hint"))
        checkboxHint.font = NSFont.systemFont(ofSize: 11, weight: .regular)
        checkboxHint.textColor = DSV2.onSurfaceVariant
        checkboxHint.isBordered = false
        checkboxHint.isEditable = false
        checkboxHint.drawsBackground = false
        checkboxHint.translatesAutoresizingMaskIntoConstraints = false

        textContainer.addSubview(checkboxLabel)
        textContainer.addSubview(checkboxHint)

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

            checkboxLabel.topAnchor.constraint(equalTo: textContainer.topAnchor),
            checkboxLabel.leadingAnchor.constraint(equalTo: textContainer.leadingAnchor),
            checkboxLabel.trailingAnchor.constraint(equalTo: textContainer.trailingAnchor),

            checkboxHint.topAnchor.constraint(equalTo: checkboxLabel.bottomAnchor, constant: 4),
            checkboxHint.leadingAnchor.constraint(equalTo: textContainer.leadingAnchor),
            checkboxHint.trailingAnchor.constraint(equalTo: textContainer.trailingAnchor),
            checkboxHint.bottomAnchor.constraint(equalTo: textContainer.bottomAnchor),

            rowContainer.topAnchor.constraint(equalTo: container.topAnchor),
            rowContainer.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            rowContainer.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            rowContainer.bottomAnchor.constraint(equalTo: container.bottomAnchor)
        ])

        return container
    }

    private func makeLanguageRow() -> NSView {
        let container = NSView()
        container.translatesAutoresizingMaskIntoConstraints = false

        languageLabel = NSTextField(labelWithString: LanguageManager.shared.localized("settings.language"))
        languageLabel.font = DSV2.fontBodyMd
        languageLabel.textColor = DSV2.onSurface
        languageLabel.isBordered = false
        languageLabel.isEditable = false
        languageLabel.drawsBackground = false
        languageLabel.translatesAutoresizingMaskIntoConstraints = false

        languageDescLabel = NSTextField(labelWithString: LanguageManager.shared.localized("settings.language.description"))
        languageDescLabel.font = NSFont.systemFont(ofSize: 11, weight: .regular)
        languageDescLabel.textColor = DSV2.onSurfaceVariant
        languageDescLabel.isBordered = false
        languageDescLabel.isEditable = false
        languageDescLabel.drawsBackground = false
        languageDescLabel.translatesAutoresizingMaskIntoConstraints = false

        // 创建语言分段控制器
        languageSegmentedControl = DSV2.makeSegmentedControl(
            items: ["English", "中文"],
            target: self,
            action: #selector(languageChanged)
        )
        languageSegmentedControl.translatesAutoresizingMaskIntoConstraints = false

        // 设置当前选中项
        let currentLanguage = LanguageManager.shared.currentLanguage
        languageSegmentedControl.selectItem(at: currentLanguage == .english ? 0 : 1)

        container.addSubview(languageLabel)
        container.addSubview(languageDescLabel)
        container.addSubview(languageSegmentedControl)

        NSLayoutConstraint.activate([
            languageLabel.topAnchor.constraint(equalTo: container.topAnchor),
            languageLabel.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            languageLabel.trailingAnchor.constraint(equalTo: container.trailingAnchor),

            languageDescLabel.topAnchor.constraint(equalTo: languageLabel.bottomAnchor, constant: 4),
            languageDescLabel.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            languageDescLabel.trailingAnchor.constraint(equalTo: container.trailingAnchor),

            languageSegmentedControl.topAnchor.constraint(equalTo: languageDescLabel.bottomAnchor, constant: 12),
            languageSegmentedControl.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            languageSegmentedControl.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            languageSegmentedControl.widthAnchor.constraint(equalToConstant: 240),
            languageSegmentedControl.bottomAnchor.constraint(equalTo: container.bottomAnchor)
        ])

        return container
    }

    @objc private func languageChanged() {
        let selectedIndex = languageSegmentedControl.indexOfSelectedItem()
        let language: LanguageManager.Language = selectedIndex == 0 ? .english : .chinese
        LanguageManager.shared.setLanguage(language)
    }

    private func makeThemeRow() -> NSView {
        let container = NSView()
        container.translatesAutoresizingMaskIntoConstraints = false

        themeLabel = NSTextField(labelWithString: LanguageManager.shared.localized("settings.theme"))
        themeLabel.font = DSV2.fontBodyMd
        themeLabel.textColor = DSV2.onSurface
        themeLabel.isBordered = false
        themeLabel.isEditable = false
        themeLabel.drawsBackground = false
        themeLabel.translatesAutoresizingMaskIntoConstraints = false

        themeDescLabel = NSTextField(labelWithString: LanguageManager.shared.localized("settings.theme.description"))
        themeDescLabel.font = NSFont.systemFont(ofSize: 11, weight: .regular)
        themeDescLabel.textColor = DSV2.onSurfaceVariant
        themeDescLabel.isBordered = false
        themeDescLabel.isEditable = false
        themeDescLabel.drawsBackground = false
        themeDescLabel.translatesAutoresizingMaskIntoConstraints = false

        // 创建主题分段控制器
        themeSegmentedControl = DSV2.makeSegmentedControl(
            items: [
                LanguageManager.shared.localized("settings.theme.dark"),
                LanguageManager.shared.localized("settings.theme.light"),
                LanguageManager.shared.localized("settings.theme.auto")
            ],
            target: self,
            action: #selector(themeChanged)
        )
        themeSegmentedControl.translatesAutoresizingMaskIntoConstraints = false

        // 根据当前主题设置选中项
        let currentTheme = ThemeManager.shared.userTheme
        switch currentTheme {
        case .dark:
            themeSegmentedControl.selectItem(at: 0)
        case .light:
            themeSegmentedControl.selectItem(at: 1)
        case .auto:
            themeSegmentedControl.selectItem(at: 2)
        }

        container.addSubview(themeLabel)
        container.addSubview(themeDescLabel)
        container.addSubview(themeSegmentedControl)

        NSLayoutConstraint.activate([
            themeLabel.topAnchor.constraint(equalTo: container.topAnchor),
            themeLabel.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            themeLabel.trailingAnchor.constraint(equalTo: container.trailingAnchor),

            themeDescLabel.topAnchor.constraint(equalTo: themeLabel.bottomAnchor, constant: 4),
            themeDescLabel.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            themeDescLabel.trailingAnchor.constraint(equalTo: container.trailingAnchor),

            themeSegmentedControl.topAnchor.constraint(equalTo: themeDescLabel.bottomAnchor, constant: 12),
            themeSegmentedControl.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            themeSegmentedControl.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            themeSegmentedControl.widthAnchor.constraint(equalToConstant: 240),
            themeSegmentedControl.bottomAnchor.constraint(equalTo: container.bottomAnchor)
        ])

        return container
    }

    @objc private func themeChanged() {
        let selectedIndex = themeSegmentedControl.indexOfSelectedItem()
        let newTheme: AppTheme
        switch selectedIndex {
        case 0:
            newTheme = .dark
        case 1:
            newTheme = .light
        case 2:
            newTheme = .auto
        default:
            newTheme = .dark
        }
        ThemeManager.shared.setTheme(newTheme)
    }

    private func makeSettingsCard(title: String, icon: String, iconColor: NSColor, views: [NSView]) -> NSView {
        let container = NSView()
        container.wantsLayer = true
        container.translatesAutoresizingMaskIntoConstraints = false

        container.layer?.backgroundColor = DSV2.surfaceContainerHigh.withAlphaComponent(0.8).cgColor
        container.layer?.cornerRadius = DSV2.radiusContainer
        container.layer?.borderColor = DSV2.cardBorder.withAlphaComponent(0.15).cgColor
        container.layer?.borderWidth = 1

        let iconView = NSImageView()
        if #available(macOS 11.0, *) {
            iconView.image = NSImage(systemSymbolName: icon, accessibilityDescription: nil)
            iconView.symbolConfiguration = NSImage.SymbolConfiguration(pointSize: 18, weight: .medium)
        }
        iconView.contentTintColor = iconColor
        iconView.translatesAutoresizingMaskIntoConstraints = false

        let titleLabel = NSTextField(labelWithString: title.uppercased())
        titleLabel.font = DSV2.fontLabelSm
        titleLabel.textColor = DSV2.onSurfaceTertiary
        titleLabel.isBordered = false
        titleLabel.isEditable = false
        titleLabel.drawsBackground = false
        titleLabel.translatesAutoresizingMaskIntoConstraints = false

        // Store reference to general card title
        if icon == "tune" {
            generalCardTitle = titleLabel
        }

        let headerStack = NSStackView(views: [iconView, titleLabel])
        headerStack.orientation = .horizontal
        headerStack.spacing = DSV2.spacing2
        headerStack.alignment = .centerY
        headerStack.translatesAutoresizingMaskIntoConstraints = false

        let contentStack = NSStackView(views: views)
        contentStack.orientation = .vertical
        contentStack.alignment = .leading
        contentStack.spacing = DSV2.spacing6
        contentStack.translatesAutoresizingMaskIntoConstraints = false

        container.addSubview(headerStack)
        container.addSubview(contentStack)

        NSLayoutConstraint.activate([
            iconView.widthAnchor.constraint(equalToConstant: 20),
            iconView.heightAnchor.constraint(equalToConstant: 20),

            headerStack.topAnchor.constraint(equalTo: container.topAnchor, constant: 12),
            headerStack.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 12),

            contentStack.topAnchor.constraint(equalTo: headerStack.bottomAnchor, constant: DSV2.spacing4),
            contentStack.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 12),
            contentStack.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -12),
            contentStack.bottomAnchor.constraint(equalTo: container.bottomAnchor, constant: -12)
        ])

        return container
    }

    private func makeCollapsibleCard(title: String, icon: String, iconColor: NSColor, contentView: NSView) -> NSView {
        let chevronView = NSImageView()
        if #available(macOS 11.0, *) {
            chevronView.image = NSImage(systemSymbolName: "chevron.right", accessibilityDescription: nil)
            chevronView.symbolConfiguration = NSImage.SymbolConfiguration(pointSize: 14, weight: .medium)
        }
        chevronView.contentTintColor = DSV2.onSurfaceVariant
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

        let titleLabel = NSTextField(labelWithString: title.uppercased())
        titleLabel.font = DSV2.fontLabelSm
        titleLabel.textColor = DSV2.onSurfaceTertiary
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

            titleLabel.leadingAnchor.constraint(equalTo: iconView.trailingAnchor, constant: DSV2.spacing2),
            titleLabel.centerYAnchor.constraint(equalTo: headerContainer.centerYAnchor),
            titleLabel.trailingAnchor.constraint(lessThanOrEqualTo: chevronView.leadingAnchor, constant: -DSV2.spacing2),

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
        stackView.spacing = DSV2.spacing6
        stackView.translatesAutoresizingMaskIntoConstraints = false
        stackView.setHuggingPriority(.required, for: .vertical)
        stackView.setContentCompressionResistancePriority(.required, for: .vertical)

        // Container
        let container = CollapsibleCardContainer(headerView: headerContainer, contentView: contentView, chevronView: chevronView)
        container.wantsLayer = true
        container.translatesAutoresizingMaskIntoConstraints = false
        container.layer?.backgroundColor = DSV2.surfaceContainerHigh.withAlphaComponent(0.8).cgColor
        container.layer?.cornerRadius = DSV2.radiusContainer
        container.layer?.borderColor = DSV2.cardBorder.withAlphaComponent(0.15).cgColor
        container.layer?.borderWidth = 1

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
            stackView.topAnchor.constraint(equalTo: container.topAnchor, constant: DSV2.spacing4),
            stackView.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: DSV2.spacing6),
            stackView.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -DSV2.spacing6),
            stackView.bottomAnchor.constraint(equalTo: container.bottomAnchor, constant: -DSV2.spacing4),

            headerContainer.widthAnchor.constraint(equalTo: stackView.widthAnchor),
            contentView.widthAnchor.constraint(equalTo: stackView.widthAnchor),

            clickArea.topAnchor.constraint(equalTo: headerContainer.topAnchor, constant: -8),
            clickArea.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            clickArea.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            clickArea.heightAnchor.constraint(equalToConstant: 44)
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
    private var initialConfig: ServiceConfig // 用于对比变更
    private let lanIPs: [String]
    private let defaultPort: Int
    private let onConfigChanged: (ServiceConfig) -> Void
    private let onSaveAndRestart: () -> Void

    private var localhostPortField: CenteredTextField!
    private var lanIPCheckboxes: [String: NSButton] = [:]
    private var lanIPPortFields: [String: CenteredTextField] = [:]
    private var saveButton: NSButton!
    private var hasChanges = false

    init(serviceName: String, title: String, config: ServiceConfig, lanIPs: [String], defaultPort: Int,
         onConfigChanged: @escaping (ServiceConfig) -> Void,
         onSaveAndRestart: @escaping () -> Void) {
        self.serviceName = serviceName
        self.config = config
        self.initialConfig = config
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
            let separator = NSView()
            separator.wantsLayer = true
            separator.layer?.backgroundColor = DSV2.divider.cgColor
            separator.translatesAutoresizingMaskIntoConstraints = false
            contentStack.addArrangedSubview(separator)
            separator.widthAnchor.constraint(equalTo: contentStack.widthAnchor).isActive = true
            separator.heightAnchor.constraint(equalToConstant: 1).isActive = true

            let lanLabel = NSTextField(labelWithString: LanguageManager.shared.localized("settings.lan_ip_addresses").uppercased())
            lanLabel.font = DSV2.fontLabelSm
            lanLabel.textColor = DSV2.onSurfaceTertiary
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
        updateButtonAppearance(enabled: false) // 初始化按钮样式

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
        label.textColor = DSV2.onSurface
        label.isBordered = false
        label.isEditable = false
        label.drawsBackground = false
        label.translatesAutoresizingMaskIntoConstraints = false

        // 物理包裹容器
        let fieldContainer = NSView()
        fieldContainer.wantsLayer = true
        fieldContainer.layer?.backgroundColor = DSV2.surfaceContainerHigh.cgColor
        fieldContainer.layer?.cornerRadius = 8
        fieldContainer.layer?.borderWidth = 1
        fieldContainer.layer?.borderColor = DSV2.outlineVariant.withAlphaComponent(0.3).cgColor // 增加边框可见度
        fieldContainer.translatesAutoresizingMaskIntoConstraints = false

        localhostPortField = CenteredTextField()
        localhostPortField.isBordered = false
        localhostPortField.drawsBackground = false
        localhostPortField.font = NSFont.monospacedSystemFont(ofSize: 14, weight: .medium)
        localhostPortField.textColor = DSV2.onSurface
        localhostPortField.alignment = .center
        localhostPortField.focusRingType = .none
        localhostPortField.isEditable = true
        localhostPortField.isSelectable = true
        localhostPortField.isEnabled = true
        localhostPortField.backgroundColor = .clear
        localhostPortField.drawsBackground = false
        localhostPortField.translatesAutoresizingMaskIntoConstraints = false
        localhostPortField.stringValue = "\(getLocalhostPort())"
        localhostPortField.target = self
        localhostPortField.action = #selector(configChanged)

        observeTextField(localhostPortField, fieldContainer: fieldContainer)

        fieldContainer.addSubview(localhostPortField)
        container.addSubview(label)
        container.addSubview(fieldContainer)

        NSLayoutConstraint.activate([
            label.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            label.centerYAnchor.constraint(equalTo: container.centerYAnchor),
            label.widthAnchor.constraint(equalToConstant: 120),

            fieldContainer.leadingAnchor.constraint(equalTo: label.trailingAnchor, constant: 16),
            fieldContainer.centerYAnchor.constraint(equalTo: container.centerYAnchor),
            fieldContainer.widthAnchor.constraint(equalToConstant: 120),
            fieldContainer.heightAnchor.constraint(equalToConstant: 40),

            // TextField 填满容器以确保点击区域最大化
            localhostPortField.leadingAnchor.constraint(equalTo: fieldContainer.leadingAnchor),
            localhostPortField.trailingAnchor.constraint(equalTo: fieldContainer.trailingAnchor),
            localhostPortField.topAnchor.constraint(equalTo: fieldContainer.topAnchor),
            localhostPortField.bottomAnchor.constraint(equalTo: fieldContainer.bottomAnchor),

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
        label.textColor = DSV2.onSurface
        label.isBordered = false
        label.isEditable = false
        label.drawsBackground = false
        label.translatesAutoresizingMaskIntoConstraints = false

        // 创建一个包裹容器做背景和边框
        let fieldContainer = NSView()
        fieldContainer.wantsLayer = true
        fieldContainer.layer?.backgroundColor = DSV2.surfaceContainerHigh.cgColor
        fieldContainer.layer?.cornerRadius = 8
        fieldContainer.layer?.borderWidth = 1
        fieldContainer.layer?.borderColor = DSV2.outlineVariant.withAlphaComponent(0.3).cgColor // 增加可见度
        fieldContainer.translatesAutoresizingMaskIntoConstraints = false

        let portField = CenteredTextField()
        portField.isBordered = false
        portField.drawsBackground = false
        portField.font = NSFont.monospacedSystemFont(ofSize: 14, weight: .medium)
        portField.textColor = DSV2.onSurface
        portField.alignment = .center
        portField.focusRingType = .none
        portField.isEditable = true
        portField.isSelectable = true
        portField.isEnabled = checkbox.state == .on
        portField.backgroundColor = .clear
        portField.drawsBackground = false
        portField.translatesAutoresizingMaskIntoConstraints = false
        portField.stringValue = "\(getLANIPPort(ip))"
        portField.target = self
        portField.action = #selector(configChanged)
        lanIPPortFields[ip] = portField

        observeTextField(portField, fieldContainer: fieldContainer)

        fieldContainer.addSubview(portField)
        container.addSubview(checkbox)
        container.addSubview(label)
        container.addSubview(fieldContainer)

        NSLayoutConstraint.activate([
            checkbox.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            checkbox.centerYAnchor.constraint(equalTo: container.centerYAnchor),
            checkbox.widthAnchor.constraint(equalToConstant: 20),

            label.leadingAnchor.constraint(equalTo: checkbox.trailingAnchor, constant: 8),
            label.centerYAnchor.constraint(equalTo: container.centerYAnchor),
            label.widthAnchor.constraint(equalToConstant: 100),

            fieldContainer.leadingAnchor.constraint(equalTo: label.trailingAnchor, constant: 16),
            fieldContainer.centerYAnchor.constraint(equalTo: container.centerYAnchor),
            fieldContainer.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            fieldContainer.widthAnchor.constraint(equalToConstant: 120),
            fieldContainer.heightAnchor.constraint(equalToConstant: 40),

            // TextField 填满容器
            portField.leadingAnchor.constraint(equalTo: fieldContainer.leadingAnchor),
            portField.trailingAnchor.constraint(equalTo: fieldContainer.trailingAnchor),
            portField.topAnchor.constraint(equalTo: fieldContainer.topAnchor),
            portField.bottomAnchor.constraint(equalTo: fieldContainer.bottomAnchor),

            container.heightAnchor.constraint(equalToConstant: 40)
        ])

        return container
    }

    private func makeSaveButton() -> NSButton {
        let button = NSButton(title: LanguageManager.shared.localized("settings.save"), target: self, action: #selector(saveClicked))
        button.translatesAutoresizingMaskIntoConstraints = false
        button.wantsLayer = true
        button.isBordered = false
        button.bezelStyle = .rounded

        // Assign to saveButton first, then call updateButtonAppearance
        // The `saveButton = button` assignment is already handled by the caller of makeSaveButton
        // so we just need to set the initial state.
        // The instruction's snippet seems to have a copy-paste error here,
        // so we'll apply the intended styling logic to updateButtonAppearance.
        
        button.heightAnchor.constraint(equalToConstant: 44).isActive = true
        button.widthAnchor.constraint(equalToConstant: 200).isActive = true

        return button
    }

    private func observeTextField(_ textField: NSTextField, fieldContainer: NSView) {
        NotificationCenter.default.addObserver(forName: NSControl.textDidBeginEditingNotification, object: textField, queue: .main) { _ in
            fieldContainer.layer?.borderColor = DSV2.primary.withAlphaComponent(0.5).cgColor
        }
        NotificationCenter.default.addObserver(forName: NSControl.textDidChangeNotification, object: textField, queue: .main) { [weak self] _ in
            self?.configChanged()
        }
        NotificationCenter.default.addObserver(forName: NSControl.textDidEndEditingNotification, object: textField, queue: .main) { [weak self] _ in
            fieldContainer.layer?.borderColor = DSV2.outlineVariant.withAlphaComponent(0.3).cgColor
            self?.configChanged()
        }
    }

    private func updateButtonAppearance(enabled: Bool) {
        saveButton.isEnabled = enabled
        
        // 移除旧的渐变层
        saveButton.layer?.sublayers?.filter { $0 is CAGradientLayer }.forEach { $0.removeFromSuperlayer() }
        
        if enabled {
            // 应用高级渐变样式
            let gradientLayer = CAGradientLayer()
            gradientLayer.colors = [
                DSV2.primary.cgColor,
                DSV2.primaryContainer.cgColor
            ]
            gradientLayer.startPoint = CGPoint(x: 0, y: 0)
            gradientLayer.endPoint = CGPoint(x: 1, y: 1)
            gradientLayer.cornerRadius = DSV2.radiusButton
            gradientLayer.frame = CGRect(x: 0, y: 0, width: 200, height: 44) // 初始大小
            
            saveButton.layer?.insertSublayer(gradientLayer, at: 0)
            saveButton.layer?.backgroundColor = NSColor.clear.cgColor
            
            // 确保布局刷新后更新 frame
            DispatchQueue.main.async {
                gradientLayer.frame = self.saveButton.bounds
            }
        } else {
            saveButton.layer?.backgroundColor = DSV2.onSurfaceVariant.withAlphaComponent(0.2).cgColor
        }
        
        saveButton.layer?.cornerRadius = DSV2.radiusButton
        
        let attributes: [NSAttributedString.Key: Any] = [
            .foregroundColor: enabled ? NSColor.white : DSV2.onSurfaceVariant.withAlphaComponent(0.5),
            .font: NSFont.systemFont(ofSize: 13, weight: .bold)
        ]
        saveButton.attributedTitle = NSAttributedString(string: LanguageManager.shared.localized("settings.save"), attributes: attributes)
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
               let portField = lanIPPortFields[ip] {
                
                let isChecked = checkbox.state == .on
                portField.isEnabled = isChecked // 只要勾选就启用，不论当前端口是否有效
                
                if isChecked,
                   let port = Int(portField.stringValue), port > 0 {
                    newAddresses.append(ListenAddress(ip: ip, port: port, enabled: true))
                }
            }
        }

        config.addresses = newAddresses
        onConfigChanged(config)

        // 智能变更检测：只有真正不同于初始配置时才启用按钮
        let changed = config != initialConfig
        hasChanges = changed
        updateButtonAppearance(enabled: changed)
    }

    @objc private func saveClicked() {
        onSaveAndRestart()
    }

    func resetButtonState() {
        initialConfig = config // 更新初始参考配置
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
        field.textColor = DSV2.onSurface
        field.font = NSFont.monospacedSystemFont(ofSize: 14, weight: .medium)
        field.translatesAutoresizingMaskIntoConstraints = false
        field.focusRingType = .none
        field.alignment = .center
        field.usesSingleLineMode = true
        field.lineBreakMode = .byClipping
        
        // 关键：确保新替换的 cell 保持可编辑状态
        field.isEditable = true
        field.isSelectable = true
        field.isEnabled = true

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
