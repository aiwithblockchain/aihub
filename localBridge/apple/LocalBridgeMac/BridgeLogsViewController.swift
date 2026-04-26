import AppKit

final class BridgeLogsViewController: NSViewController {

    private var textView: NSTextView!
    private var scrollView: NSScrollView!
    private let clearButton = NSButton(title: "", target: nil, action: #selector(clearClicked))
    private let copyButton = NSButton(title: "", target: nil, action: #selector(copyClicked))
    private let autoScrollCheckbox = NSButton(checkboxWithTitle: "", target: nil, action: #selector(toggleAutoScroll))
    private let logCountLabel = NSTextField(labelWithString: "0 \(LanguageManager.shared.localized("logs.entries"))")
    private var autoScroll = true

    // UI 组件引用用于主题更新
    private let headerImageView = NSImageView()
    private var titleLabel: NSTextField!
    private let subtitleLabel = NSTextField(labelWithString: "SYSTEM ENGINE & BRIDGE TRAFFIC LOGS")
    private var autoScrollLabel: NSTextField!
    private let headerSeparator = NSView()

    override func loadView() {
        view = NSView()
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(onLogUpdate),
            name: BridgeLogger.didUpdateNotification,
            object: nil
        )
        reloadLogs()

        // 注册主题变化通知
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleThemeChange),
            name: ThemeManager.themeDidChangeNotification,
            object: nil
        )

        // 注册语言变化通知
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleLanguageChange),
            name: LanguageManager.languageDidChangeNotification,
            object: nil
        )
    }

    @objc private func handleLanguageChange() {
        titleLabel.stringValue = LanguageManager.shared.localized("logs.title")
        autoScrollLabel.stringValue = LanguageManager.shared.localized("logs.auto_scroll")
        clearButton.toolTip = LanguageManager.shared.localized("logs.clear")
        copyButton.toolTip = LanguageManager.shared.localized("common.copy")
        reloadLogs()
    }

    @objc private func handleThemeChange() {
        view.layer?.backgroundColor = DSV2.surface.cgColor
        
        // 更新 Header
        headerImageView.contentTintColor = DSV2.primary
        titleLabel?.textColor = DSV2.onSurface
        subtitleLabel.textColor = DSV2.onSurfaceTertiary
        headerSeparator.layer?.backgroundColor = DSV2.divider.withAlphaComponent(0.8).cgColor
        
        // 更新终端背景
        textView?.textColor = DSV2.tertiary
        textView?.backgroundColor = DSV2.surfaceContainerLowest
        scrollView?.layer?.backgroundColor = DSV2.surfaceContainerLowest.cgColor
        scrollView?.layer?.borderColor = DSV2.cardBorder.withAlphaComponent(0.3).cgColor

        // 更新标签
        autoScrollLabel?.textColor = DSV2.onSurfaceTertiary
        logCountLabel.textColor = DSV2.onSurfaceVariant
        logCountLabel.layer?.backgroundColor = DSV2.surfaceContainerHigh.cgColor
        logCountLabel.layer?.borderColor = DSV2.outlineVariant.withAlphaComponent(0.2).cgColor

        // 更新按钮
        updateButtonTheme(copyButton, isDestructive: false)
        updateButtonTheme(clearButton, isDestructive: true)

        // 重新加载日志以更新颜色
        reloadLogs()
        view.needsDisplay = true
    }

    private func updateButtonTheme(_ button: NSButton, isDestructive: Bool) {
        if isDestructive {
            button.layer?.backgroundColor = DSV2.error.withAlphaComponent(0.1).cgColor
            if #available(macOS 11.0, *) {
                button.contentTintColor = DSV2.error
            }
        } else {
            button.layer?.backgroundColor = NSColor.clear.cgColor
            if #available(macOS 11.0, *) {
                button.contentTintColor = DSV2.onSurfaceVariant
            }
        }
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    // MARK: - Setup

    private func setupUI() {
        view.wantsLayer = true
        view.layer?.backgroundColor = DSV2.surface.cgColor

        // Header Icon
        if #available(macOS 11.0, *) {
            headerImageView.image = NSImage(systemSymbolName: "list.bullet.rectangle.portrait", accessibilityDescription: nil)
            headerImageView.symbolConfiguration = NSImage.SymbolConfiguration(pointSize: 20, weight: .semibold)
            headerImageView.contentTintColor = DSV2.primary
        }
        headerImageView.translatesAutoresizingMaskIntoConstraints = false

        // Title
        titleLabel = NSTextField(labelWithString: LanguageManager.shared.localized("logs.title"))
        titleLabel.font = DSV2.fontTitleLg
        titleLabel.textColor = DSV2.onSurface
        titleLabel.translatesAutoresizingMaskIntoConstraints = false

        // Subtitle
        subtitleLabel.font = DSV2.fontLabelSm
        subtitleLabel.textColor = DSV2.onSurfaceTertiary
        subtitleLabel.translatesAutoresizingMaskIntoConstraints = false

        // Log count badge
        logCountLabel.font = DSV2.fontLabelSm
        logCountLabel.textColor = DSV2.onSurfaceVariant
        logCountLabel.wantsLayer = true
        logCountLabel.layer?.backgroundColor = DSV2.surfaceContainerHigh.cgColor
        logCountLabel.layer?.cornerRadius = DSV2.radiusInput
        logCountLabel.layer?.borderWidth = 1
        logCountLabel.layer?.borderColor = DSV2.outlineVariant.withAlphaComponent(0.2).cgColor
        logCountLabel.alignment = .center
        logCountLabel.translatesAutoresizingMaskIntoConstraints = false

        // Auto-scroll toggle
        autoScrollLabel = NSTextField(labelWithString: LanguageManager.shared.localized("logs.auto_scroll"))
        autoScrollLabel.font = DSV2.fontLabelSm
        autoScrollLabel.textColor = DSV2.onSurfaceTertiary
        autoScrollLabel.translatesAutoresizingMaskIntoConstraints = false

        autoScrollCheckbox.state = .on
        autoScrollCheckbox.target = self
        autoScrollCheckbox.translatesAutoresizingMaskIntoConstraints = false

        // Action buttons
        setupActionButton(copyButton, icon: "doc.on.doc", tooltip: LanguageManager.shared.localized("common.copy"))
        setupActionButton(clearButton, icon: "trash", tooltip: LanguageManager.shared.localized("logs.clear"), isDestructive: true)

        // Header layout
        let headerLeft = NSStackView(views: [headerImageView, titleLabel, logCountLabel])
        headerLeft.orientation = .horizontal
        headerLeft.spacing = DSV2.spacing2
        headerLeft.alignment = .centerY

        let autoScrollRow = NSStackView(views: [autoScrollLabel, autoScrollCheckbox])
        autoScrollRow.orientation = .horizontal
        autoScrollRow.spacing = DSV2.spacing2
        autoScrollRow.alignment = .centerY

        let buttonRow = NSStackView(views: [autoScrollRow, copyButton, clearButton])
        buttonRow.orientation = .horizontal
        buttonRow.spacing = DSV2.spacing4
        buttonRow.alignment = .centerY

        let topRow = NSStackView(views: [headerLeft, NSView(), buttonRow])
        topRow.orientation = .horizontal
        topRow.alignment = .centerY
        topRow.translatesAutoresizingMaskIntoConstraints = false

        let headerStack = NSStackView(views: [topRow, subtitleLabel])
        headerStack.orientation = .vertical
        headerStack.spacing = 4
        headerStack.alignment = .leading
        headerStack.translatesAutoresizingMaskIntoConstraints = false

        headerSeparator.wantsLayer = true
        headerSeparator.layer?.backgroundColor = DSV2.divider.withAlphaComponent(0.8).cgColor
        headerSeparator.translatesAutoresizingMaskIntoConstraints = false

        // Terminal view
        let terminal = DSV2.makeTerminalTextView()
        scrollView = terminal.scrollView
        textView = terminal.textView

        view.addSubview(headerStack)
        view.addSubview(headerSeparator)
        view.addSubview(scrollView)

        NSLayoutConstraint.activate([
            logCountLabel.widthAnchor.constraint(greaterThanOrEqualToConstant: 80),
            logCountLabel.heightAnchor.constraint(equalToConstant: 20),

            headerStack.topAnchor.constraint(equalTo: view.topAnchor, constant: DSV2.spacing6),
            headerStack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: DSV2.spacing6 + 12),
            headerStack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -DSV2.spacing6),

            topRow.widthAnchor.constraint(equalTo: headerStack.widthAnchor),

            headerSeparator.topAnchor.constraint(equalTo: headerStack.bottomAnchor, constant: 12),
            headerSeparator.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            headerSeparator.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            headerSeparator.heightAnchor.constraint(equalToConstant: 1),

            scrollView.topAnchor.constraint(equalTo: headerSeparator.bottomAnchor, constant: 30),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: DSV2.spacing6),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -DSV2.spacing6),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -DSV2.spacing6)
        ])
    }

    private func setupActionButton(_ button: NSButton, icon: String, tooltip: String, isDestructive: Bool = false) {
        button.bezelStyle = .rounded
        button.isBordered = false
        button.wantsLayer = true
        button.target = self

        if isDestructive {
            button.layer?.backgroundColor = DSV2.error.withAlphaComponent(0.1).cgColor
        } else {
            button.layer?.backgroundColor = NSColor.clear.cgColor
        }

        button.layer?.cornerRadius = DSV2.radiusButton
        button.toolTip = tooltip

        if #available(macOS 11.0, *) {
            button.image = NSImage(systemSymbolName: icon, accessibilityDescription: tooltip)
            button.contentTintColor = isDestructive ? DSV2.error : DSV2.onSurfaceVariant
        }

        button.translatesAutoresizingMaskIntoConstraints = false
        button.widthAnchor.constraint(equalToConstant: 32).isActive = true
        button.heightAnchor.constraint(equalToConstant: 32).isActive = true
    }

    // MARK: - Data

    private func reloadLogs() {
        let lines = BridgeLogger.shared.snapshot()

        // Format logs with colors and styling
        let attributedString = NSMutableAttributedString()

        // Define global paragraph style for line spacing
        let paragraphStyle = NSMutableParagraphStyle()
        paragraphStyle.lineSpacing = 3

        for line in lines {
            let formattedLine = formatLogLine(line)
            attributedString.append(formattedLine)
            attributedString.append(NSAttributedString(string: "\n"))
        }

        // Apply line spacing to the entire document
        attributedString.addAttribute(.paragraphStyle, value: paragraphStyle, range: NSRange(location: 0, length: attributedString.length))

        textView.textStorage?.setAttributedString(attributedString)
        logCountLabel.stringValue = "\(lines.count) \(LanguageManager.shared.localized("logs.entries"))"

        if autoScroll {
            textView.scrollToEndOfDocument(nil)
        }
    }

    private func formatLogLine(_ line: String) -> NSAttributedString {
        let attributed = NSMutableAttributedString()

        // Parse log line: [timestamp] [tag] message
        let pattern = #"\[([^\]]+)\]\s*\[([^\]]+)\]\s*(.+)"#

        if let regex = try? NSRegularExpression(pattern: pattern),
           let match = regex.firstMatch(in: line, range: NSRange(line.startIndex..., in: line)) {

            // Timestamp
            if let timestampRange = Range(match.range(at: 1), in: line) {
                let timestamp = String(line[timestampRange])
                let timestampAttr = NSAttributedString(
                    string: "[\(timestamp)] ",
                    attributes: [
                        .foregroundColor: DSV2.onSurfaceTertiary,
                        .font: DSV2.fontMonoSm
                    ]
                )
                attributed.append(timestampAttr)
            }

            // Tag with color
            if let tagRange = Range(match.range(at: 2), in: line) {
                let tag = String(line[tagRange])
                let tagColor = colorForTag(tag)
                let tagAttr = NSAttributedString(
                    string: "[\(tag)] ",
                    attributes: [
                        .foregroundColor: tagColor,
                        .font: DSV2.fontMonoSm.bold()
                    ]
                )
                attributed.append(tagAttr)
            }

            // Message with nested highlighting
            if let messageRange = Range(match.range(at: 3), in: line) {
                let message = String(line[messageRange])
                let highlightedMessage = highlightMessage(message)
                attributed.append(highlightedMessage)
            }
        } else {
            // Fallback for non-standard lines
            attributed.append(highlightMessage(line))
        }

        return attributed
    }

    private func highlightMessage(_ message: String) -> NSAttributedString {
        let attrMessage = NSMutableAttributedString(string: message, attributes: [
            .font: DSV2.fontMonoSm,
            .foregroundColor: DSV2.onSurface
        ])

        // Rich syntax patterns
        let patterns: [(String, NSColor)] = [
            ("http[s]?://\\S+", DSV2.secondary),           // URLs
            ("/[\\w\\-\\.]+(/[\\w\\-\\.]+)+", DSV2.onSurfaceVariant), // Paths
            ("\\b\\d{3}\\b", DSV2.primary),                // HTTP Status codes or numbers
            ("(\"[^\"]+\":|'[^']+'\\:)", DSV2.tertiary),   // JSON Keys
            ("\\b(error|failed|failure|err)\\b", DSV2.error) // Error keywords
        ]

        for (pattern, color) in patterns {
            if let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) {
                let matches = regex.matches(in: message, range: NSRange(message.startIndex..., in: message))
                for match in matches {
                    attrMessage.addAttribute(.foregroundColor, value: color, range: match.range)
                }
            }
        }
        
        return attrMessage
    }

    private func colorForTag(_ tag: String) -> NSColor {
        let tagUpper = tag.uppercased()

        switch tagUpper {
        case "WS", "GO":
            return DSV2.tertiary
        case "REST", "HTTP":
            return DSV2.secondary
        case "ERROR", "ERR":
            return DSV2.error
        case "WARN", "WARNING":
            return NSColor(hex: "#FFA500") // Orange
        case "DB", "DATABASE":
            return NSColor(hex: "#9B59B6") // Purple
        default:
            return DSV2.onSurfaceVariant
        }
    }

    // MARK: - Notifications

    @objc private func onLogUpdate() {
        reloadLogs()
    }

    // MARK: - Actions

    @objc private func clearClicked() {
        let lines = BridgeLogger.shared.snapshot()
        guard !lines.isEmpty else {
            showToast(LanguageManager.shared.localized("logs.already_empty"), style: .warning)
            return
        }

        BridgeLogger.shared.clear()
        AppDelegate.shared?.clearBridgeLogs()
        showToast(LanguageManager.shared.localized("logs.cleared"), style: .success)
    }

    @objc private func copyClicked() {
        let lines = BridgeLogger.shared.snapshot()
        guard !lines.isEmpty else {
            showToast(LanguageManager.shared.localized("logs.nothing_to_copy"), style: .warning)
            return
        }

        let text = lines.joined(separator: "\n")
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
        showToast(LanguageManager.shared.localized("common.copied"), style: .success)
    }

    @objc private func toggleAutoScroll() {
        autoScroll = autoScrollCheckbox.state == .on
    }
}

// MARK: - Extensions

extension NSFont {
    func bold() -> NSFont {
        return NSFont(descriptor: fontDescriptor.withSymbolicTraits(.bold), size: pointSize) ?? self
    }
}
