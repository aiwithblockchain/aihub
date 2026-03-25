import AppKit

final class AIClawBotViewController: NSViewController {
    private let headerImageView = NSImageView()
    private let titleLabel = NSTextField(labelWithString: "")
    private let subtitleLabel = NSTextField(labelWithString: "API ENDPOINTS")
    private let scrollView = NSScrollView()
    private let stackView = NSStackView()

    struct ApiDoc: Codable {
        let id: String
        let name: String
        let method: String
        let path: String
        let summary: String
        let description: String
        let curl: String
        let response: String?
        let request_body: String?
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
    }

    @objc private func handleLanguageChange() {
        titleLabel.stringValue = LanguageManager.shared.localized("aiclaw.title")
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

        // 更新所有卡片及其内部元素
        for subview in stackView.arrangedSubviews {
            updateCardTheme(subview)
        }

        view.needsDisplay = true
    }

    private func updateCardTheme(_ card: NSView) {
        // 更新卡片背景
        card.layer?.backgroundColor = DSV2.surfaceContainerLow.cgColor
        card.layer?.borderColor = DSV2.outlineVariant.withAlphaComponent(0.15).cgColor

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
                // 更新代码容器背景
                if view.layer?.cornerRadius == DSV2.radiusInput {
                    view.layer?.backgroundColor = DSV2.surfaceContainerLowest.cgColor
                    view.layer?.borderColor = DSV2.outlineVariant.withAlphaComponent(0.1).cgColor
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
        // 根据字体类型判断文本类型并应用相应颜色
        if textField.font == DSV2.fontMonoMd || textField.font == DSV2.fontMonoSm {
            // 代码文本
            textField.textColor = DSV2.tertiary
        } else if textField.font == DSV2.fontBodyMd {
            // 描述文本
            textField.textColor = DSV2.onSurfaceVariant
        } else {
            // 其他文本
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
        stackView.spacing = DSV2.spacing4
        stackView.translatesAutoresizingMaskIntoConstraints = false

        // Scroll view
        scrollView.hasVerticalScroller = true
        scrollView.drawsBackground = false
        scrollView.documentView = stackView
        scrollView.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(headerStack)
        view.addSubview(scrollView)

        DSV2.applyBrightScroller(to: scrollView)

        NSLayoutConstraint.activate([
            headerStack.topAnchor.constraint(equalTo: view.topAnchor, constant: DSV2.spacing6),
            headerStack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: DSV2.spacing6),
            headerStack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -DSV2.spacing6),

            scrollView.topAnchor.constraint(equalTo: headerStack.bottomAnchor, constant: DSV2.spacing6),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: DSV2.spacing6),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -DSV2.spacing6),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -DSV2.spacing6),

            stackView.leadingAnchor.constraint(equalTo: scrollView.leadingAnchor),
            stackView.trailingAnchor.constraint(equalTo: scrollView.trailingAnchor),
            stackView.topAnchor.constraint(equalTo: scrollView.topAnchor)
        ])

        addEndpoints()
    }

    private func addEndpoints() {
        for doc in docs {
            let card = makeEndpointCard(
                method: doc.method,
                path: doc.path,
                description: doc.description,
                curl: doc.curl
            )
            stackView.addArrangedSubview(card)
            card.widthAnchor.constraint(equalTo: stackView.widthAnchor).isActive = true
        }
    }

    private func makeEndpointCard(method: String, path: String, description: String, curl: String) -> NSView {
        let card = NSView()
        card.wantsLayer = true
        card.layer?.cornerRadius = DSV2.radiusCard
        card.layer?.backgroundColor = DSV2.surfaceContainerLow.cgColor
        card.layer?.borderColor = DSV2.outlineVariant.withAlphaComponent(0.15).cgColor
        card.layer?.borderWidth = 1.0

        // Method badge using DSV2
        let methodBadge = DSV2.makeMethodTag(method: method)

        // Path label
        let pathLabel = NSTextField(labelWithString: path)
        pathLabel.font = DSV2.fontMonoMd
        pathLabel.textColor = DSV2.onSurface
        pathLabel.translatesAutoresizingMaskIntoConstraints = false

        // Description
        let descLabel = NSTextField(wrappingLabelWithString: description)
        descLabel.font = DSV2.fontBodyMd
        descLabel.textColor = DSV2.onSurfaceVariant
        descLabel.translatesAutoresizingMaskIntoConstraints = false

        // Curl code block with terminal styling
        let curlContainer = NSView()
        curlContainer.wantsLayer = true
        curlContainer.layer?.backgroundColor = DSV2.surfaceContainerLowest.cgColor
        curlContainer.layer?.cornerRadius = DSV2.radiusInput
        curlContainer.layer?.borderWidth = 1
        curlContainer.layer?.borderColor = DSV2.outlineVariant.withAlphaComponent(0.1).cgColor
        curlContainer.translatesAutoresizingMaskIntoConstraints = false

        let curlLabel = NSTextField(wrappingLabelWithString: curl)
        curlLabel.font = DSV2.fontMonoSm
        curlLabel.textColor = DSV2.tertiary
        curlLabel.backgroundColor = .clear
        curlLabel.drawsBackground = false
        curlLabel.isSelectable = true
        curlLabel.translatesAutoresizingMaskIntoConstraints = false

        curlContainer.addSubview(curlLabel)

        // Copy button with secondary style
        let actionWrapper = TargetActionWrapper(text: curl)
        let copyBtn = DSV2.makeSecondaryButton(title: "复制", target: actionWrapper, action: #selector(actionWrapper.performCopy))
        if #available(macOS 11.0, *) {
            copyBtn.image = NSImage(systemSymbolName: "doc.on.doc", accessibilityDescription: nil)
        }

        let topRow = NSStackView(views: [methodBadge, pathLabel])
        topRow.orientation = NSUserInterfaceLayoutOrientation.horizontal
        topRow.spacing = DSV2.spacing2
        topRow.alignment = .centerY

        let bottomRow = NSStackView(views: [NSView(), copyBtn])
        bottomRow.orientation = NSUserInterfaceLayoutOrientation.horizontal

        let cardStack = NSStackView(views: [topRow, descLabel, curlContainer, bottomRow])
        cardStack.orientation = NSUserInterfaceLayoutOrientation.vertical
        cardStack.alignment = NSLayoutConstraint.Attribute.leading
        cardStack.spacing = DSV2.spacing4
        cardStack.translatesAutoresizingMaskIntoConstraints = false

        card.addSubview(cardStack)

        NSLayoutConstraint.activate([
            curlLabel.topAnchor.constraint(equalTo: curlContainer.topAnchor, constant: DSV2.spacing2),
            curlLabel.leadingAnchor.constraint(equalTo: curlContainer.leadingAnchor, constant: DSV2.spacing2),
            curlLabel.trailingAnchor.constraint(equalTo: curlContainer.trailingAnchor, constant: -DSV2.spacing2),
            curlLabel.bottomAnchor.constraint(equalTo: curlContainer.bottomAnchor, constant: -DSV2.spacing2),

            cardStack.topAnchor.constraint(equalTo: card.topAnchor, constant: DSV2.spacing4),
            cardStack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: DSV2.spacing4),
            cardStack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -DSV2.spacing4),
            cardStack.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -DSV2.spacing4),

            topRow.widthAnchor.constraint(equalTo: cardStack.widthAnchor),
            descLabel.widthAnchor.constraint(equalTo: cardStack.widthAnchor),
            curlContainer.widthAnchor.constraint(equalTo: cardStack.widthAnchor),
            bottomRow.widthAnchor.constraint(equalTo: cardStack.widthAnchor)
        ])

        return card
    }
}

// Helper to handle copy action from button
private class TargetActionWrapper: NSObject {
    let text: String
    init(text: String) { self.text = text }
    @objc func performCopy() {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
    }
}
