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
        // 设置主视图背景为深色
        view.wantsLayer = true
        view.layer?.backgroundColor = DSV2.surface.cgColor

        // Toolbar - 使用 DSV2 样式
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
        titleLabel.font = DSV2.fontTitleMd
        titleLabel.textColor = DSV2.onSurface
        titleLabel.translatesAutoresizingMaskIntoConstraints = false

        let iconView = NSImageView()
        if #available(macOS 11.0, *) {
            iconView.image = NSImage(systemSymbolName: "doc.text.magnifyingglass", accessibilityDescription: nil)
            iconView.symbolConfiguration = NSImage.SymbolConfiguration(pointSize: 16, weight: .semibold)
        }
        iconView.contentTintColor = DSV2.onSurfaceVariant
        iconView.translatesAutoresizingMaskIntoConstraints = false

        logCountLabel.font = DSV2.fontLabelSm
        logCountLabel.textColor = DSV2.onSurfaceVariant
        logCountLabel.translatesAutoresizingMaskIntoConstraints = false

        let headerLeft = NSStackView(views: [iconView, titleLabel, logCountLabel])
        headerLeft.orientation = .horizontal
        headerLeft.alignment = .centerY
        headerLeft.spacing = DSV2.spacing2

        let toolbar = NSStackView(views: [headerLeft, NSView(), autoScrollCheckbox, clearButton])
        toolbar.orientation = .horizontal
        toolbar.alignment = .centerY
        toolbar.translatesAutoresizingMaskIntoConstraints = false

        // 使用 DSV2 终端视图工厂
        let terminal = DSV2.makeTerminalTextView()
        scrollView = terminal.scrollView
        textView = terminal.textView

        view.addSubview(toolbar)
        view.addSubview(scrollView)

        NSLayoutConstraint.activate([
            toolbar.topAnchor.constraint(equalTo: view.topAnchor, constant: DSV2.spacing4),
            toolbar.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: DSV2.spacing4),
            toolbar.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -DSV2.spacing4),

            scrollView.topAnchor.constraint(equalTo: toolbar.bottomAnchor, constant: DSV2.spacing4),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: DSV2.spacing4),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -DSV2.spacing4),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -DSV2.spacing4)
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
