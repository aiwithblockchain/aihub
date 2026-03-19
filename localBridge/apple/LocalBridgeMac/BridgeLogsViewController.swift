import AppKit

final class BridgeLogsViewController: NSViewController {

    private var textView: NSTextView!
    private var scrollView: NSScrollView!
    private let clearButton = NSButton(title: "", target: nil, action: #selector(clearClicked))
    private let copyButton = NSButton(title: "", target: nil, action: #selector(copyClicked))
    private let autoScrollCheckbox = NSButton(checkboxWithTitle: "", target: nil, action: #selector(toggleAutoScroll))
    private let logCountLabel = NSTextField(labelWithString: "0 ENTRIES")
    private var autoScroll = true

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
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    // MARK: - Setup

    private func setupUI() {
        view.wantsLayer = true
        view.layer?.backgroundColor = DSV2.surface.cgColor

        // Header bar with glass effect
        let headerBar = NSView()
        headerBar.wantsLayer = true
        headerBar.layer?.backgroundColor = DSV2.surfaceContainerLow.withAlphaComponent(0.9).cgColor
        headerBar.layer?.borderWidth = 1
        headerBar.layer?.borderColor = DSV2.outlineVariant.withAlphaComponent(0.15).cgColor
        headerBar.translatesAutoresizingMaskIntoConstraints = false

        // Title
        let titleLabel = NSTextField(labelWithString: "Bridge Logs")
        titleLabel.font = DSV2.fontTitleSm
        titleLabel.textColor = DSV2.onSurface
        titleLabel.translatesAutoresizingMaskIntoConstraints = false

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
        let autoScrollLabel = NSTextField(labelWithString: "AUTO-SCROLL")
        autoScrollLabel.font = DSV2.fontLabelSm
        autoScrollLabel.textColor = DSV2.onSurfaceTertiary
        autoScrollLabel.translatesAutoresizingMaskIntoConstraints = false

        autoScrollCheckbox.state = .on
        autoScrollCheckbox.target = self
        autoScrollCheckbox.translatesAutoresizingMaskIntoConstraints = false

        // Action buttons
        setupActionButton(copyButton, icon: "doc.on.doc", tooltip: "Copy")
        setupActionButton(clearButton, icon: "trash", tooltip: "Clear", isDestructive: true)

        // Layout
        let titleRow = NSStackView(views: [titleLabel, logCountLabel])
        titleRow.orientation = .horizontal
        titleRow.spacing = DSV2.spacing2
        titleRow.alignment = .centerY

        let autoScrollRow = NSStackView(views: [autoScrollLabel, autoScrollCheckbox])
        autoScrollRow.orientation = .horizontal
        autoScrollRow.spacing = DSV2.spacing2
        autoScrollRow.alignment = .centerY

        let divider = NSView()
        divider.wantsLayer = true
        divider.layer?.backgroundColor = DSV2.outlineVariant.withAlphaComponent(0.2).cgColor
        divider.translatesAutoresizingMaskIntoConstraints = false
        divider.widthAnchor.constraint(equalToConstant: 1).isActive = true

        let buttonRow = NSStackView(views: [copyButton, clearButton])
        buttonRow.orientation = .horizontal
        buttonRow.spacing = DSV2.spacing2

        let toolbar = NSStackView(views: [titleRow, NSView(), autoScrollRow, divider, buttonRow])
        toolbar.orientation = .horizontal
        toolbar.alignment = .centerY
        toolbar.spacing = DSV2.spacing4
        toolbar.translatesAutoresizingMaskIntoConstraints = false

        headerBar.addSubview(toolbar)

        // Terminal view
        let terminal = DSV2.makeTerminalTextView()
        scrollView = terminal.scrollView
        textView = terminal.textView

        view.addSubview(headerBar)
        view.addSubview(scrollView)

        NSLayoutConstraint.activate([
            logCountLabel.widthAnchor.constraint(greaterThanOrEqualToConstant: 80),
            logCountLabel.heightAnchor.constraint(equalToConstant: 20),

            headerBar.topAnchor.constraint(equalTo: view.topAnchor),
            headerBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            headerBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            headerBar.heightAnchor.constraint(equalToConstant: 56),

            toolbar.centerYAnchor.constraint(equalTo: headerBar.centerYAnchor),
            toolbar.leadingAnchor.constraint(equalTo: headerBar.leadingAnchor, constant: DSV2.spacing6),
            toolbar.trailingAnchor.constraint(equalTo: headerBar.trailingAnchor, constant: -DSV2.spacing6),

            scrollView.topAnchor.constraint(equalTo: headerBar.bottomAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
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

        for line in lines {
            let formattedLine = formatLogLine(line)
            attributedString.append(formattedLine)
            attributedString.append(NSAttributedString(string: "\n"))
        }

        textView.textStorage?.setAttributedString(attributedString)
        logCountLabel.stringValue = "\(lines.count) ENTRIES"

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

            // Message
            if let messageRange = Range(match.range(at: 3), in: line) {
                let message = String(line[messageRange])
                let messageColor = line.contains("error") || line.contains("Error") ? DSV2.error : DSV2.onSurface
                let messageAttr = NSAttributedString(
                    string: message,
                    attributes: [
                        .foregroundColor: messageColor,
                        .font: DSV2.fontMonoSm
                    ]
                )
                attributed.append(messageAttr)
            }
        } else {
            // Fallback: plain text
            attributed.append(NSAttributedString(
                string: line,
                attributes: [
                    .foregroundColor: DSV2.onSurface,
                    .font: DSV2.fontMonoSm
                ]
            ))
        }

        return attributed
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
        BridgeLogger.shared.clear()
    }

    @objc private func copyClicked() {
        let lines = BridgeLogger.shared.snapshot()
        let text = lines.joined(separator: "\n")
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
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
