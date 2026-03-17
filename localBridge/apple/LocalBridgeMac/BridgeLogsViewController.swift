import AppKit

final class BridgeLogsViewController: NSViewController {

    private var textView: NSTextView!
    private var scrollView: NSScrollView!
    private let clearButton = NSButton(title: "清空", target: nil, action: #selector(clearClicked))
    private let autoScrollCheckbox = NSButton(checkboxWithTitle: "自动滚动到底部", target: nil, action: #selector(toggleAutoScroll))
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
        clearButton.bezelStyle = .rounded
        clearButton.target = self
        clearButton.translatesAutoresizingMaskIntoConstraints = false

        autoScrollCheckbox.state = .on
        autoScrollCheckbox.target = self
        autoScrollCheckbox.translatesAutoresizingMaskIntoConstraints = false

        let titleLabel = NSTextField(labelWithString: "Bridge Logs")
        titleLabel.font = .systemFont(ofSize: 18, weight: .semibold)
        titleLabel.translatesAutoresizingMaskIntoConstraints = false

        let toolbar = NSStackView(views: [titleLabel, NSView(), autoScrollCheckbox, clearButton])
        toolbar.orientation = .horizontal
        toolbar.alignment = .centerY
        toolbar.translatesAutoresizingMaskIntoConstraints = false

        // Text view
        scrollView = NSTextView.scrollableTextView()
        textView = scrollView.documentView as? NSTextView
        textView.isEditable = false
        textView.isSelectable = true
        textView.font = .monospacedSystemFont(ofSize: 11, weight: .regular)
        textView.textContainerInset = NSSize(width: 8, height: 8)
        textView.backgroundColor = NSColor(white: 0.08, alpha: 1.0)  // 深色背景，像终端
        textView.textColor = NSColor(red: 0.0, green: 0.9, blue: 0.4, alpha: 1.0) // 绿色文字
        scrollView.borderType = .bezelBorder
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
