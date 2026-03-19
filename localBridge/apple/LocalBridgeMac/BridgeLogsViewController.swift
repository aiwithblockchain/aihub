import AppKit

final class BridgeLogsViewController: NSViewController {

    private var textView: NSTextView!
    private var scrollView: NSScrollView!
    private let clearButton = NSButton(title: "清空", target: nil, action: #selector(clearClicked))
    private let autoScrollCheckbox = NSButton(checkboxWithTitle: "自动滚动到底部", target: nil, action: #selector(toggleAutoScroll))
    private let logCountLabel = NSTextField(labelWithString: "0 条")
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
        // Toolbar
        if #available(macOS 11.0, *) {
            clearButton.image = NSImage(systemSymbolName: "trash", accessibilityDescription: "清空")
            clearButton.imagePosition = .imageLeading
        }
        clearButton.bezelStyle = .rounded
        clearButton.target = self
        clearButton.translatesAutoresizingMaskIntoConstraints = false

        autoScrollCheckbox.state = .on
        autoScrollCheckbox.target = self
        autoScrollCheckbox.translatesAutoresizingMaskIntoConstraints = false

        let titleLabel = NSTextField(labelWithString: "Bridge Logs")
        titleLabel.font = .systemFont(ofSize: 14, weight: .semibold)
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        
        let iconView = NSImageView()
        if #available(macOS 11.0, *) {
            iconView.image = NSImage(systemSymbolName: "doc.text.magnifyingglass", accessibilityDescription: nil)
            iconView.symbolConfiguration = NSImage.SymbolConfiguration(pointSize: 14, weight: .semibold)
        }
        iconView.translatesAutoresizingMaskIntoConstraints = false
        
        logCountLabel.font = DS.fontCaption
        logCountLabel.textColor = DS.colorTextTertiary
        logCountLabel.translatesAutoresizingMaskIntoConstraints = false

        let headerLeft = NSStackView(views: [iconView, titleLabel, logCountLabel])
        headerLeft.orientation = .horizontal
        headerLeft.alignment = .centerY
        headerLeft.spacing = 8

        let toolbar = NSStackView(views: [headerLeft, NSView(), autoScrollCheckbox, clearButton])
        toolbar.orientation = .horizontal
        toolbar.alignment = .centerY
        toolbar.translatesAutoresizingMaskIntoConstraints = false

        // Text view
        scrollView = NSTextView.scrollableTextView()
        textView = scrollView.documentView as? NSTextView
        textView.isEditable = false
        textView.isSelectable = true
        textView.font = DS.fontMono
        textView.textContainerInset = NSSize(width: 8, height: 8)
        textView.backgroundColor = DS.colorPreviewBg  // 使用文档定义的深色背景 #1A1A1A
        textView.textColor = NSColor(red: 0.0, green: 0.9, blue: 0.4, alpha: 1.0) // 绿色文字
        scrollView.borderType = .noBorder
        scrollView.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(toolbar)
        view.addSubview(scrollView)

        NSLayoutConstraint.activate([
            toolbar.topAnchor.constraint(equalTo: view.topAnchor, constant: 12),
            toolbar.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            toolbar.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),

            scrollView.topAnchor.constraint(equalTo: toolbar.bottomAnchor, constant: 8),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -16)
        ])
    }

    // MARK: - Data

    private func reloadLogs() {
        let lines = BridgeLogger.shared.snapshot()
        textView.string = lines.joined(separator: "\n")
        logCountLabel.stringValue = "\(lines.count) 条"
        if autoScroll {
            textView.scrollToEndOfDocument(nil)
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

    @objc private func toggleAutoScroll() {
        autoScroll = autoScrollCheckbox.state == .on
    }
}
