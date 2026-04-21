import AppKit

private final class FlippedStackView: NSStackView {
    override var isFlipped: Bool { true }
}

final class AIClawBotViewController: NSViewController {
    private let headerImageView = NSImageView()
    private let titleLabel = NSTextField(labelWithString: "")
    private let subtitleLabel = NSTextField(labelWithString: "API ENDPOINTS")
    private let scrollView = NSScrollView()
    private let stackView = FlippedStackView()
    private let headerSeparator = NSView()
    
    // Toast 提示
    private var toastView: NSView?
    private var toastTimer: Timer?

    struct ApiDoc: Codable {
        let id: String
        let name: String
        let name_zh: String?
        let method: String
        let path: String
        let summary: String
        let summary_zh: String?
        let description: String
        let description_zh: String?
        let curl: String
        let response: String?
        let request_body: String?
        
        var localizedName: String {
            if LanguageManager.shared.currentLanguage == .chinese, let val = name_zh, !val.isEmpty { return val }
            return name
        }
        var localizedSummary: String {
            if LanguageManager.shared.currentLanguage == .chinese, let val = summary_zh, !val.isEmpty { return val }
            return summary
        }
        var localizedDescription: String {
            if LanguageManager.shared.currentLanguage == .chinese, let val = description_zh, !val.isEmpty { return val }
            return description
        }
    }

    private var docs: [ApiDoc] = []

    override func loadView() {
        view = NSView()
        view.wantsLayer = true
        view.layer?.backgroundColor = DSV2.surface.cgColor
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        loadDocs()
        setupUI()

        NotificationCenter.default.addObserver(self, selector: #selector(handleThemeChange), name: ThemeManager.themeDidChangeNotification, object: nil)

        // 注册语言变化通知
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleLanguageChange),
            name: LanguageManager.languageDidChangeNotification,
            object: nil
        )

        // 初始化文本
        titleLabel.stringValue = LanguageManager.shared.localized("aiclaw.title")
        subtitleLabel.stringValue = LanguageManager.shared.localized("api.endpoints")
    }

    @objc private func handleLanguageChange() {
        titleLabel.stringValue = LanguageManager.shared.localized("aiclaw.title")
        subtitleLabel.stringValue = LanguageManager.shared.localized("api.endpoints")
        
        // Redraw endpoints to apply new language
        addEndpoints()
    }

    private func loadDocs() {
        guard let url = Bundle.main.url(forResource: "ai_claw_api_docs", withExtension: "json") else {
            print("Error: ai_claw_api_docs.json not found")
            return
        }

        do {
            let data = try Data(contentsOf: url)
            docs = try JSONDecoder().decode([ApiDoc].self, from: data)
        } catch {
            print("Error loading ai_claw_api_docs.json: \(error)")
        }
    }

    @objc private func handleThemeChange() {
        view.layer?.backgroundColor = DSV2.surface.cgColor
        headerImageView.contentTintColor = DSV2.primary
        titleLabel.textColor = DSV2.onSurface
        subtitleLabel.textColor = DSV2.onSurfaceTertiary
        headerSeparator.layer?.backgroundColor = DSV2.divider.withAlphaComponent(0.8).cgColor

        // 更新所有卡片及其内部元素
        for subview in stackView.arrangedSubviews {
            updateCardTheme(subview)
        }

        view.needsDisplay = true
    }

    private func updateCardTheme(_ card: NSView) {
        // 更新卡片背景
        card.layer?.backgroundColor = DSV2.surfaceContainerHigh.withAlphaComponent(0.8).cgColor
        card.layer?.borderColor = DSV2.cardBorder.withAlphaComponent(0.15).cgColor
        card.layer?.borderWidth = 1

        // 递归更新卡片内所有子视图
        for subview in card.subviews {
            if let stackView = subview as? NSStackView {
                updateStackViewTheme(stackView)
            } else if let textField = subview as? NSTextField {
                updateTextFieldTheme(textField)
            } else if subview.subviews.count > 0 {
                updateCardTheme(subview)
            }
        }
    }

    private func updateStackViewTheme(_ stackView: NSStackView) {
        for view in stackView.arrangedSubviews {
            if let textField = view as? NSTextField {
                updateTextFieldTheme(textField)
            } else if let nestedStack = view as? NSStackView {
                updateStackViewTheme(nestedStack)
            } else {
                // 更新代码容器背景 - 检测 curlContainer (radiusCard) 或其他代码块
                if view.layer?.cornerRadius == DSV2.radiusCard || view.layer?.cornerRadius == DSV2.radiusInput {
                    view.layer?.backgroundColor = DSV2.codeBackground.cgColor
                    view.layer?.borderColor = NSColor.clear.cgColor
                    view.layer?.borderWidth = 0
                }
                // 递归更新容器内的元素
                for subview in view.subviews {
                    if let textField = subview as? NSTextField {
                        updateTextFieldTheme(textField)
                    }
                }
            }
        }
    }

    private func updateTextFieldTheme(_ textField: NSTextField) {
        // 如果是 cURL 标签
        if textField.identifier?.rawValue == "curlLabel" {
            textField.attributedStringValue = highlightCurl(textField.stringValue)
            return
        }

        // 如果是说明文字标签
        if textField.identifier?.rawValue == "descriptionLabel" {
            textField.textColor = ThemeManager.shared.isDarkMode ? DSV2.onSurface : DSV2.onSurfaceVariant
            
            // 重新应用带有正确颜色的属性文本（保持行间距）
            let style = NSMutableParagraphStyle()
            style.lineSpacing = 3
            let attrStr = NSMutableAttributedString(string: textField.stringValue, attributes: [
                .font: DSV2.fontBodyMd,
                .foregroundColor: textField.textColor ?? DSV2.onSurface,
                .paragraphStyle: style
            ])
            textField.attributedStringValue = attrStr
            return
        }

        // 其他通用标签
        if textField.font == DSV2.fontLabelSm {
            textField.textColor = DSV2.onSurfaceTertiary
        } else {
            textField.textColor = DSV2.onSurface
        }
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    private func setupUI() {
        // Header Icon
        if #available(macOS 11.0, *) {
            headerImageView.image = NSImage(systemSymbolName: "cpu", accessibilityDescription: nil)
            headerImageView.symbolConfiguration = NSImage.SymbolConfiguration(pointSize: 20, weight: .semibold)
            headerImageView.contentTintColor = DSV2.primary
        }
        headerImageView.translatesAutoresizingMaskIntoConstraints = false

        // Title
        titleLabel.font = DSV2.fontTitleLg
        titleLabel.textColor = DSV2.onSurface
        titleLabel.translatesAutoresizingMaskIntoConstraints = false

        // Subtitle
        subtitleLabel.font = DSV2.fontLabelSm
        subtitleLabel.textColor = DSV2.onSurfaceTertiary
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

        // Stack view for cards
        stackView.orientation = .vertical
        stackView.alignment = .leading
        stackView.distribution = .fill
        stackView.spacing = DSV2.spacing4
        stackView.setHuggingPriority(.required, for: .vertical)
        stackView.translatesAutoresizingMaskIntoConstraints = false

        // Scroll view
        scrollView.hasVerticalScroller = true
        scrollView.hasHorizontalScroller = false
        scrollView.drawsBackground = false
        scrollView.documentView = stackView
        scrollView.translatesAutoresizingMaskIntoConstraints = false

        headerSeparator.wantsLayer = true
        headerSeparator.layer?.backgroundColor = DSV2.divider.withAlphaComponent(0.8).cgColor
        headerSeparator.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(headerStack)
        view.addSubview(headerSeparator)
        view.addSubview(scrollView)

        DSV2.applyBrightScroller(to: scrollView)

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

            stackView.topAnchor.constraint(equalTo: scrollView.contentView.topAnchor),
            stackView.leadingAnchor.constraint(equalTo: scrollView.contentView.leadingAnchor),
            stackView.trailingAnchor.constraint(equalTo: scrollView.contentView.trailingAnchor),
            stackView.widthAnchor.constraint(equalTo: scrollView.contentView.widthAnchor)
        ])

        addEndpoints()
    }

    private func addEndpoints() {
        // Clear existing cards
        stackView.arrangedSubviews.forEach { $0.removeFromSuperview() }
        
        for doc in docs {
            let card = makeEndpointCard(
                method: doc.method,
                path: doc.path,
                description: doc.localizedDescription,
                curl: doc.curl
            )
            stackView.addArrangedSubview(card)
            card.widthAnchor.constraint(equalTo: stackView.widthAnchor).isActive = true
        }
        
        // Add a bottom spacer to push all cards to the top
        let spacer = NSView()
        spacer.translatesAutoresizingMaskIntoConstraints = false
        stackView.addArrangedSubview(spacer)
        // This spacer will absorb all extra vertical space
        spacer.setContentHuggingPriority(.init(1), for: .vertical)
    }

    private func highlightCurl(_ text: String) -> NSAttributedString {
        let attrString = NSMutableAttributedString(string: text, attributes: [
            .font: DSV2.fontMonoSm,
            .foregroundColor: DSV2.onSurfaceVariant
        ])

        // Define regex patterns and colors
        let patterns: [(String, NSColor)] = [
            ("\\bcurl\\b", DSV2.primary),                  // curl command
            ("-X |-H |-d ", DSV2.secondary),              // flags
            ("GET|POST|PUT|DELETE|PATCH", DSV2.tertiary),  // methods
            ("http[s]?://\\S+", DSV2.secondary),          // URLs
            ("'[^']*'|\"[^\"]*\"", DSV2.tertiary)          // quoted strings (data)
        ]

        for (pattern, color) in patterns {
            if let regex = try? NSRegularExpression(pattern: pattern) {
                let matches = regex.matches(in: text, range: NSRange(text.startIndex..., in: text))
                for match in matches {
                    attrString.addAttribute(.foregroundColor, value: color, range: match.range)
                    if pattern.contains("GET") {
                        attrString.addAttribute(.font, value: NSFont.monospacedSystemFont(ofSize: 11, weight: .bold), range: match.range)
                    }
                }
            }
        }

        let paragraphStyle = NSMutableParagraphStyle()
        paragraphStyle.lineSpacing = 3
        attrString.addAttribute(.paragraphStyle, value: paragraphStyle, range: NSRange(location: 0, length: attrString.length))

        return attrString
    }

    private func makeEndpointCard(method: String, path: String, description: String, curl: String) -> NSView {
        let card = NSView()
        card.wantsLayer = true
        card.layer?.cornerRadius = DSV2.radiusContainer
        card.layer?.backgroundColor = DSV2.surfaceContainerHigh.withAlphaComponent(0.8).cgColor
        card.layer?.borderColor = DSV2.cardBorder.withAlphaComponent(0.15).cgColor
        card.layer?.borderWidth = 1

        // Method badge using DSV2
        let methodBadge = DSV2.makeMethodTag(method: method)

        // Path label
        let pathLabel = NSTextField(wrappingLabelWithString: path)
        pathLabel.font = DSV2.fontMonoMd
        pathLabel.textColor = DSV2.onSurface
        pathLabel.translatesAutoresizingMaskIntoConstraints = false

        // Description
        let descLabel = NSTextField(wrappingLabelWithString: description)
        descLabel.identifier = NSUserInterfaceItemIdentifier("descriptionLabel")
        descLabel.font = DSV2.fontBodyMd
        descLabel.textColor = ThemeManager.shared.isDarkMode ? DSV2.onSurface : DSV2.onSurfaceVariant
        descLabel.translatesAutoresizingMaskIntoConstraints = false
        descLabel.isSelectable = true
        
        // 点击复制功能
        let descCopyGesture = NSClickGestureRecognizer(target: self, action: #selector(copyContent))
        descLabel.addGestureRecognizer(descCopyGesture)
        descLabel.toolTip = LanguageManager.shared.localized("common.copy")
        
        // Add line spacing to description
        let descStyle = NSMutableParagraphStyle()
        descStyle.lineSpacing = 3
        descLabel.attributedStringValue = NSAttributedString(string: description, attributes: [
            .font: DSV2.fontBodyMd,
            .foregroundColor: ThemeManager.shared.isDarkMode ? DSV2.onSurface : DSV2.onSurfaceVariant,
            .paragraphStyle: descStyle
        ])

        // Curl code block with terminal styling
        let curlContainer = NSView()
        curlContainer.wantsLayer = true
        curlContainer.layer?.backgroundColor = DSV2.codeBackground.cgColor
        curlContainer.layer?.cornerRadius = DSV2.radiusCard
        curlContainer.layer?.borderWidth = 0
        curlContainer.layer?.borderColor = NSColor.clear.cgColor
        curlContainer.translatesAutoresizingMaskIntoConstraints = false

        let curlLabel = NSTextField(wrappingLabelWithString: curl)
        curlLabel.identifier = NSUserInterfaceItemIdentifier("curlLabel")
        curlLabel.font = DSV2.fontMonoSm
        curlLabel.textColor = DSV2.onSurface
        curlLabel.backgroundColor = .clear
        curlLabel.drawsBackground = false
        curlLabel.isEditable = false
        curlLabel.isSelectable = true
        curlLabel.allowsEditingTextAttributes = true
        curlLabel.translatesAutoresizingMaskIntoConstraints = false
        
        // 点击复制功能
        let curlCopyGesture = NSClickGestureRecognizer(target: self, action: #selector(copyContent))
        curlLabel.addGestureRecognizer(curlCopyGesture)
        curlLabel.toolTip = LanguageManager.shared.localized("common.copy")
        
        // Apply CURL syntax highlighting
        curlLabel.attributedStringValue = highlightCurl(curl)

        curlContainer.addSubview(curlLabel)

        let topRow = NSStackView(views: [pathLabel, methodBadge])
        topRow.orientation = NSUserInterfaceLayoutOrientation.horizontal
        topRow.spacing = DSV2.spacing2
        topRow.alignment = .bottom

        let cardStack = NSStackView(views: [topRow, descLabel, curlContainer])
        cardStack.orientation = NSUserInterfaceLayoutOrientation.vertical
        cardStack.alignment = .leading
        cardStack.spacing = 11 // Increased from 8 to improve breathing room
        cardStack.translatesAutoresizingMaskIntoConstraints = false

        card.addSubview(cardStack)

        NSLayoutConstraint.activate([
            curlLabel.topAnchor.constraint(equalTo: curlContainer.topAnchor, constant: DSV2.spacing2),
            curlLabel.leadingAnchor.constraint(equalTo: curlContainer.leadingAnchor, constant: DSV2.spacing2),
            curlLabel.trailingAnchor.constraint(equalTo: curlContainer.trailingAnchor, constant: -DSV2.spacing2),
            curlLabel.bottomAnchor.constraint(equalTo: curlContainer.bottomAnchor, constant: -DSV2.spacing2),

            cardStack.topAnchor.constraint(equalTo: card.topAnchor, constant: 12),
            cardStack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 12),
            cardStack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -12),
            cardStack.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -12),

            topRow.widthAnchor.constraint(equalTo: cardStack.widthAnchor),
            descLabel.widthAnchor.constraint(equalTo: cardStack.widthAnchor),
            curlContainer.widthAnchor.constraint(equalTo: cardStack.widthAnchor)
        ])

        return card
    }

    // MARK: - Handlers & Actions

    @objc private func copyContent(_ sender: NSClickGestureRecognizer) {
        guard let label = sender.view as? NSTextField else { return }
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(label.stringValue, forType: .string)
        
        showToast(LanguageManager.shared.localized("common.copied"))
    }

    private func showToast(_ message: String) {
        toastTimer?.invalidate()
        toastView?.removeFromSuperview()

        let container = NSView()
        container.wantsLayer = true
        container.layer?.backgroundColor = DSV2.primary.cgColor
        container.layer?.cornerRadius = 12
        container.layer?.shadowColor = NSColor.black.cgColor
        container.layer?.shadowOpacity = 0.3
        container.layer?.shadowRadius = 10
        container.layer?.shadowOffset = CGSize(width: 0, height: 4)
        container.translatesAutoresizingMaskIntoConstraints = false

        let label = NSTextField(labelWithString: message)
        label.font = NSFont.systemFont(ofSize: 13, weight: .medium)
        label.textColor = .white
        label.alignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(label)

        view.addSubview(container)
        self.toastView = container

        NSLayoutConstraint.activate([
            label.centerYAnchor.constraint(equalTo: container.centerYAnchor),
            label.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 16),
            label.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -16),
            container.heightAnchor.constraint(equalToConstant: 36),
            container.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            container.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -40)
        ])

        container.alphaValue = 0

        NSAnimationContext.runAnimationGroup { context in
            context.duration = 0.3
            context.timingFunction = CAMediaTimingFunction(name: .easeOut)
            container.animator().alphaValue = 1
        }

        toastTimer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: false) { [weak self] _ in
            self?.hideToast()
        }
    }

    private func hideToast() {
        guard let toast = toastView else { return }
        NSAnimationContext.runAnimationGroup({ context in
            context.duration = 0.3
            context.timingFunction = CAMediaTimingFunction(name: .easeIn)
            toast.animator().alphaValue = 0
        }) {
            toast.removeFromSuperview()
        }
    }
}
