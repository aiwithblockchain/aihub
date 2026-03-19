import AppKit

final class InstancesPanelViewController: NSViewController {

    // MARK: - UI Elements

    private let titleLabel = NSTextField(labelWithString: "已连接实例")
    private let subtitleLabel = NSTextField(labelWithString: "以下为当前通过 WebSocket 连接到 LocalBridge 的浏览器扩展实例")
    private let refreshButton = NSButton(title: "刷新", target: nil, action: #selector(refreshClicked))
    private var gridView: NSView!
    private var scrollView: NSScrollView!
    private var emptyView: NSStackView!

    // MARK: - Data

    private var instances: [LocalBridgeGoManager.InstanceSnapshot] = []

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
        rebuildGridView()
        updateEmptyState()
    }

    // MARK: - Setup

    private func setupUI() {
        // 设置主视图背景为深色
        view.wantsLayer = true
        view.layer?.backgroundColor = DSV2.surface.cgColor

        // Title - 使用 DSV2 样式
        titleLabel.font = DSV2.fontDisplaySm
        titleLabel.textColor = DSV2.onSurface
        titleLabel.translatesAutoresizingMaskIntoConstraints = false

        subtitleLabel.font = DSV2.fontBodyMd
        subtitleLabel.textColor = DSV2.onSurfaceVariant
        subtitleLabel.translatesAutoresizingMaskIntoConstraints = false

        // Refresh button
        refreshButton.bezelStyle = .rounded
        refreshButton.target = self
        refreshButton.translatesAutoresizingMaskIntoConstraints = false
        if #available(macOS 11.0, *) {
            refreshButton.image = NSImage(systemSymbolName: "arrow.clockwise", accessibilityDescription: "刷新")
            refreshButton.imagePosition = .imageLeading
        }

        // Grid
        setupGridView()

        // Empty state view - 使用 DSV2 颜色
        let emptyIcon = NSImageView(image: NSImage(systemSymbolName: "wifi.slash", accessibilityDescription: nil)!)
        emptyIcon.contentTintColor = DSV2.onSurfaceTertiary
        if #available(macOS 11.0, *) {
            emptyIcon.symbolConfiguration = NSImage.SymbolConfiguration(pointSize: 36, weight: .thin)
        }

        let emptyText = NSTextField(labelWithString: "暂无已连接的实例")
        emptyText.font = DSV2.fontBodyLg
        emptyText.textColor = DSV2.onSurfaceVariant
        emptyText.alignment = .center
        emptyText.isEditable = false
        emptyText.isBordered = false
        emptyText.drawsBackground = false

        let emptyHint = NSTextField(wrappingLabelWithString: "请确保浏览器扩展已启动并连接到 LocalBridge")
        emptyHint.font = DSV2.fontBodySm
        emptyHint.textColor = DSV2.onSurfaceTertiary
        emptyHint.alignment = .center
        emptyHint.isEditable = false
        emptyHint.isBordered = false
        emptyHint.drawsBackground = false

        emptyView = NSStackView(views: [emptyIcon, emptyText, emptyHint])
        emptyView.orientation = .vertical
        emptyView.spacing = DSV2.spacing4
        emptyView.translatesAutoresizingMaskIntoConstraints = false
        emptyView.isHidden = true

        // Header row
        let headerStack = NSStackView(views: [titleLabel, NSView(), refreshButton])
        headerStack.orientation = .horizontal
        headerStack.alignment = .centerY
        headerStack.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(headerStack)
        view.addSubview(subtitleLabel)
        view.addSubview(scrollView)
        view.addSubview(emptyView)

        NSLayoutConstraint.activate([
            headerStack.topAnchor.constraint(equalTo: view.topAnchor, constant: DSV2.spacing6),
            headerStack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: DSV2.spacing6),
            headerStack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -DSV2.spacing6),

            subtitleLabel.topAnchor.constraint(equalTo: headerStack.bottomAnchor, constant: DSV2.spacing2),
            subtitleLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: DSV2.spacing6),
            subtitleLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -DSV2.spacing6),

            scrollView.topAnchor.constraint(equalTo: subtitleLabel.bottomAnchor, constant: DSV2.spacing4),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: DSV2.spacing6),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -DSV2.spacing6),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -DSV2.spacing6),

            emptyView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            emptyView.centerYAnchor.constraint(equalTo: view.centerYAnchor, constant: 40),
            emptyView.widthAnchor.constraint(lessThanOrEqualTo: view.widthAnchor, constant: -40)
        ])
    }

    private func setupGridView() {
        // 创建一个翻转坐标系的容器视图
        let flippedView = FlippedView()
        flippedView.frame = NSRect(x: 0, y: 0, width: 600, height: 400)
        gridView = flippedView

        scrollView = NSScrollView()
        scrollView.hasVerticalScroller = true
        scrollView.hasHorizontalScroller = false
        scrollView.borderType = .noBorder
        scrollView.documentView = gridView
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.drawsBackground = false
    }

    private func rebuildGridView() {
        // 清空现有视图
        gridView.subviews.forEach { $0.removeFromSuperview() }

        guard !instances.isEmpty else {
            gridView.frame = NSRect(x: 0, y: 0, width: 600, height: 0)
            return
        }

        let cardWidth: CGFloat = 260
        let cardHeight: CGFloat = 130
        let spacing: CGFloat = DS.spacingM
        let columns = 2

        // 计算总高度和宽度
        let rows = (instances.count + columns - 1) / columns
        let totalHeight = CGFloat(rows) * (cardHeight + spacing) + spacing
        let totalWidth = CGFloat(columns) * (cardWidth + spacing) + spacing

        gridView.frame = NSRect(x: 0, y: 0, width: totalWidth, height: totalHeight)

        for (index, instance) in instances.enumerated() {
            let row = index / columns
            let col = index % columns

            let card = createInstanceCard(instance: instance)
            gridView.addSubview(card)

            let xOffset = spacing + CGFloat(col) * (cardWidth + spacing)
            // 因为使用了 FlippedView,y 轴从上往下,所以直接计算即可
            let yOffset = spacing + CGFloat(row) * (cardHeight + spacing)

            card.frame = NSRect(x: xOffset, y: yOffset, width: cardWidth, height: cardHeight)
        }
    }

    private func createInstanceCard(instance: LocalBridgeGoManager.InstanceSnapshot) -> NSView {
        let cardWidth: CGFloat = 260
        let cardHeight: CGFloat = 130

        // 使用 DSV2 玻璃卡片（无边框）
        let card = DSV2.makeGlassCard()
        card.frame = NSRect(x: 0, y: 0, width: cardWidth, height: cardHeight)

        let padding: CGFloat = 12

        // 图标 - 使用 DSV2 主色
        let symbolName = instance.clientName == "tweetClaw" ? "network" : "cpu"
        let icon = NSImageView(frame: NSRect(x: padding, y: cardHeight - padding - 20, width: 20, height: 20))
        icon.image = NSImage(systemSymbolName: symbolName, accessibilityDescription: nil)
        icon.contentTintColor = DSV2.primary
        if #available(macOS 11.0, *) {
            icon.symbolConfiguration = NSImage.SymbolConfiguration(pointSize: 16, weight: .medium)
        }
        card.addSubview(icon)

        // 扩展名称 - 使用 DSV2 文本颜色
        let nameLabel = NSTextField(labelWithString: instance.clientName)
        nameLabel.font = DSV2.fontTitleSm
        nameLabel.textColor = DSV2.onSurface
        nameLabel.isBordered = false
        nameLabel.isEditable = false
        nameLabel.drawsBackground = false
        nameLabel.frame = NSRect(x: padding + 26, y: cardHeight - padding - 18, width: 140, height: 18)
        card.addSubview(nameLabel)

        // 版本标签 - 使用 DSV2 Chip 样式
        let versionLabel = NSTextField(labelWithString: "v\(instance.clientVersion)")
        versionLabel.font = DSV2.fontLabelSm
        versionLabel.textColor = DSV2.onSurfaceVariant
        versionLabel.wantsLayer = true
        versionLabel.layer?.backgroundColor = DSV2.outlineVariant.withAlphaComponent(0.2).cgColor
        versionLabel.layer?.cornerRadius = DSV2.radiusFull / 2
        versionLabel.alignment = .center
        versionLabel.isBordered = false
        versionLabel.isEditable = false
        versionLabel.drawsBackground = false
        versionLabel.frame = NSRect(x: cardWidth - padding - 45, y: cardHeight - padding - 16, width: 45, height: 16)
        card.addSubview(versionLabel)

        // Instance ID 标题
        let idTitleLabel = NSTextField(labelWithString: "Instance ID")
        idTitleLabel.font = DSV2.fontLabelSm
        idTitleLabel.textColor = DSV2.onSurfaceTertiary
        idTitleLabel.isBordered = false
        idTitleLabel.isEditable = false
        idTitleLabel.drawsBackground = false
        idTitleLabel.frame = NSRect(x: padding, y: cardHeight - padding - 42, width: cardWidth - 2 * padding, height: 11)
        card.addSubview(idTitleLabel)

        // Instance ID 值 - 使用等宽字体
        let displayId = instance.isTemporary ? "\(instance.instanceId.prefix(18))..." : "\(instance.instanceId.prefix(22))..."
        let idLabel = NSTextField(labelWithString: displayId)
        idLabel.font = DSV2.fontMonoSm
        idLabel.textColor = instance.isTemporary ? DSV2.onSurfaceTertiary : DSV2.onSurfaceVariant
        idLabel.lineBreakMode = .byTruncatingMiddle
        idLabel.isBordered = false
        idLabel.isEditable = false
        idLabel.drawsBackground = false
        idLabel.frame = NSRect(x: padding, y: cardHeight - padding - 55, width: cardWidth - 2 * padding, height: 11)
        card.addSubview(idLabel)

        // 连接时间标题
        let timeTitleLabel = NSTextField(labelWithString: "连接时间")
        timeTitleLabel.font = DSV2.fontLabelSm
        timeTitleLabel.textColor = DSV2.onSurfaceTertiary
        timeTitleLabel.isBordered = false
        timeTitleLabel.isEditable = false
        timeTitleLabel.drawsBackground = false
        timeTitleLabel.frame = NSRect(x: padding, y: cardHeight - padding - 72, width: cardWidth - 2 * padding, height: 11)
        card.addSubview(timeTitleLabel)

        // 连接时间值
        let timeLabel = NSTextField(labelWithString: dateFormatter.string(from: instance.connectedAt))
        timeLabel.font = DSV2.fontMonoSm
        timeLabel.textColor = DSV2.onSurfaceVariant
        timeLabel.isBordered = false
        timeLabel.isEditable = false
        timeLabel.drawsBackground = false
        timeLabel.frame = NSRect(x: padding, y: cardHeight - padding - 85, width: cardWidth - 2 * padding, height: 11)
        card.addSubview(timeLabel)

        // 活跃状态 - 使用 DSV2 状态点
        let secondsAgo = Int(Date().timeIntervalSince(instance.lastSeenAt))
        let statusColor: NSColor
        let statusText: String

        if secondsAgo < 60 {
            statusColor = DSV2.tertiary
            statusText = "\(secondsAgo)s 前"
        } else {
            statusColor = DSV2.onSurfaceTertiary
            statusText = dateFormatter.string(from: instance.lastSeenAt)
        }

        let statusDot = NSView(frame: NSRect(x: padding, y: padding + 2, width: 6, height: 6))
        statusDot.wantsLayer = true
        statusDot.layer?.backgroundColor = statusColor.cgColor
        statusDot.layer?.cornerRadius = 3
        card.addSubview(statusDot)

        let statusLabel = NSTextField(labelWithString: statusText)
        statusLabel.font = DSV2.fontLabelSm
        statusLabel.textColor = secondsAgo < 60 ? DSV2.tertiary : DSV2.onSurfaceVariant
        statusLabel.isBordered = false
        statusLabel.isEditable = false
        statusLabel.drawsBackground = false
        statusLabel.frame = NSRect(x: padding + 10, y: padding, width: 150, height: 11)
        card.addSubview(statusLabel)

        return card
    }

    private func updateEmptyState() {
        let isEmpty = instances.isEmpty
        scrollView.isHidden = isEmpty
        emptyView.isHidden = !isEmpty
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

// MARK: - FlippedView

/// 翻转坐标系的视图,让 y 轴从上往下
private class FlippedView: NSView {
    override var isFlipped: Bool {
        return true
    }
}
