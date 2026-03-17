import AppKit

final class InstancesPanelViewController: NSViewController {

    // MARK: - UI Elements

    private let titleLabel = NSTextField(labelWithString: "已连接实例")
    private let subtitleLabel = NSTextField(labelWithString: "以下为当前通过 WebSocket 连接到 LocalBridge 的浏览器扩展实例")
    private let refreshButton = NSButton(title: "刷新", target: nil, action: #selector(refreshClicked))
    private let tableView = NSTableView()
    private var scrollView: NSScrollView!
    private let emptyLabel = NSTextField(labelWithString: "暂无已连接的实例\n请确保浏览器扩展已启动并连接到 LocalBridge")

    // MARK: - Data

    private var instances: [LocalBridgeWebSocketServer.InstanceSnapshot] = []

    // MARK: - Lifecycle

    override func loadView() {
        view = NSView()
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
    }

    // MARK: - Public

    /// 刷新实例列表（DetailViewController 切换到此面板时调用）
    func refresh() {
        instances = AppDelegate.shared?.getConnectedInstances() ?? []
        tableView.reloadData()
        updateEmptyState()
    }

    // MARK: - Setup

    private func setupUI() {
        // Title
        titleLabel.font = .systemFont(ofSize: 22, weight: .bold)
        titleLabel.translatesAutoresizingMaskIntoConstraints = false

        subtitleLabel.font = .systemFont(ofSize: 13)
        subtitleLabel.textColor = .secondaryLabelColor
        subtitleLabel.translatesAutoresizingMaskIntoConstraints = false

        // Refresh button
        refreshButton.bezelStyle = .rounded
        refreshButton.target = self
        refreshButton.translatesAutoresizingMaskIntoConstraints = false
        if #available(macOS 11.0, *) {
            refreshButton.image = NSImage(systemSymbolName: "arrow.clockwise", accessibilityDescription: "刷新")
            refreshButton.imagePosition = .imageLeading
        }

        // Table
        setupTableView()

        // Empty state label
        emptyLabel.font = .systemFont(ofSize: 14)
        emptyLabel.textColor = .secondaryLabelColor
        emptyLabel.alignment = .center
        emptyLabel.maximumNumberOfLines = 2
        emptyLabel.translatesAutoresizingMaskIntoConstraints = false
        emptyLabel.isHidden = true

        // Header row
        let headerStack = NSStackView(views: [titleLabel, NSView(), refreshButton])
        headerStack.orientation = .horizontal
        headerStack.alignment = .centerY
        headerStack.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(headerStack)
        view.addSubview(subtitleLabel)
        view.addSubview(scrollView)
        view.addSubview(emptyLabel)

        NSLayoutConstraint.activate([
            headerStack.topAnchor.constraint(equalTo: view.topAnchor, constant: 20),
            headerStack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            headerStack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),

            subtitleLabel.topAnchor.constraint(equalTo: headerStack.bottomAnchor, constant: 6),
            subtitleLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            subtitleLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),

            scrollView.topAnchor.constraint(equalTo: subtitleLabel.bottomAnchor, constant: 16),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -20),

            emptyLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            emptyLabel.centerYAnchor.constraint(equalTo: view.centerYAnchor, constant: 40)
        ])
    }

    private func setupTableView() {
        // Column: clientName
        let nameCol = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("clientName"))
        nameCol.title = "扩展名称"
        nameCol.width = 120
        tableView.addTableColumn(nameCol)

        // Column: instanceId
        let idCol = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("instanceId"))
        idCol.title = "Instance ID"
        idCol.width = 280
        tableView.addTableColumn(idCol)

        // Column: xScreenName
        let accountCol = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("xScreenName"))
        accountCol.title = "X 账号"
        accountCol.width = 120
        tableView.addTableColumn(accountCol)

        // Column: connectedAt
        let connectedCol = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("connectedAt"))
        connectedCol.title = "连接时间"
        connectedCol.width = 160
        tableView.addTableColumn(connectedCol)

        // Column: lastSeenAt
        let lastSeenCol = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("lastSeenAt"))
        lastSeenCol.title = "最后活跃"
        lastSeenCol.width = 160
        tableView.addTableColumn(lastSeenCol)

        // Column: version
        let versionCol = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("version"))
        versionCol.title = "版本"
        versionCol.width = 80
        tableView.addTableColumn(versionCol)

        tableView.delegate = self
        tableView.dataSource = self
        tableView.rowHeight = 36
        tableView.allowsEmptySelection = true
        tableView.usesAlternatingRowBackgroundColors = true
        tableView.columnAutoresizingStyle = .lastColumnOnlyAutoresizingStyle

        scrollView = NSScrollView()
        scrollView.hasVerticalScroller = true
        scrollView.hasHorizontalScroller = true
        scrollView.borderType = .bezelBorder
        scrollView.documentView = tableView
        scrollView.translatesAutoresizingMaskIntoConstraints = false
    }

    private func updateEmptyState() {
        let isEmpty = instances.isEmpty
        tableView.isHidden = isEmpty
        emptyLabel.isHidden = !isEmpty
    }

    // MARK: - Actions

    @objc private func refreshClicked() {
        refresh()

        // 短暂改变按钮文字给用户反馈
        refreshButton.title = "已刷新 ✓"
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in
            self?.refreshButton.title = "刷新"
        }
    }

    // MARK: - Date formatting

    private let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "MM-dd HH:mm:ss"
        return f
    }()
}

// MARK: - NSTableViewDataSource

extension InstancesPanelViewController: NSTableViewDataSource {
    func numberOfRows(in tableView: NSTableView) -> Int {
        return instances.count
    }
}

// MARK: - NSTableViewDelegate

extension InstancesPanelViewController: NSTableViewDelegate {
    func tableView(_ tableView: NSTableView, viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
        guard let identifier = tableColumn?.identifier else { return nil }

        let instance = instances[row]

        let cellId = NSUserInterfaceItemIdentifier("Cell_\(identifier.rawValue)")
        var cell = tableView.makeView(withIdentifier: cellId, owner: self) as? NSTableCellView

        if cell == nil {
            cell = NSTableCellView()
            cell?.identifier = cellId
            let textField = NSTextField(labelWithString: "")
            textField.translatesAutoresizingMaskIntoConstraints = false
            textField.lineBreakMode = .byTruncatingMiddle
            cell?.addSubview(textField)
            cell?.textField = textField
            NSLayoutConstraint.activate([
                textField.leadingAnchor.constraint(equalTo: cell!.leadingAnchor, constant: 4),
                textField.trailingAnchor.constraint(equalTo: cell!.trailingAnchor, constant: -4),
                textField.centerYAnchor.constraint(equalTo: cell!.centerYAnchor)
            ])
        }

        switch identifier.rawValue {
        case "clientName":
            cell?.textField?.stringValue = instance.clientName
            cell?.textField?.font = .systemFont(ofSize: 13, weight: .medium)

        case "instanceId":
            // 临时 ID 用灰色斜体显示
            let displayId = instance.isTemporary ? "\(instance.instanceId)  (旧版扩展)" : instance.instanceId
            cell?.textField?.stringValue = displayId
            cell?.textField?.font = .monospacedSystemFont(ofSize: 11, weight: .regular)
            cell?.textField?.textColor = instance.isTemporary ? .secondaryLabelColor : .labelColor

        case "xScreenName":
            if let name = instance.xScreenName {
                cell?.textField?.stringValue = "@\(name)"
                cell?.textField?.textColor = .systemBlue
            } else {
                cell?.textField?.stringValue = "—"
                cell?.textField?.textColor = .tertiaryLabelColor
            }

        case "connectedAt":
            cell?.textField?.stringValue = dateFormatter.string(from: instance.connectedAt)
            cell?.textField?.font = .monospacedSystemFont(ofSize: 11, weight: .regular)
            cell?.textField?.textColor = .secondaryLabelColor

        case "lastSeenAt":
            let secondsAgo = Int(Date().timeIntervalSince(instance.lastSeenAt))
            if secondsAgo < 60 {
                cell?.textField?.stringValue = "\(secondsAgo)s 前"
                cell?.textField?.textColor = .systemGreen
            } else {
                cell?.textField?.stringValue = dateFormatter.string(from: instance.lastSeenAt)
                cell?.textField?.textColor = .secondaryLabelColor
            }
            cell?.textField?.font = .monospacedSystemFont(ofSize: 11, weight: .regular)

        case "version":
            cell?.textField?.stringValue = instance.clientVersion
            cell?.textField?.textColor = .secondaryLabelColor

        default:
            cell?.textField?.stringValue = ""
        }

        return cell
    }

    func tableView(_ tableView: NSTableView, rowViewForRow row: Int) -> NSTableRowView? {
        // 多实例情况下，同一 clientName 的行用浅色背景区分
        return nil  // 使用系统默认行视图即可
    }
}
