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

        // 注册主题变化通知
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleThemeChange),
            name: ThemeManager.themeDidChangeNotification,
            object: nil
        )
    }

    @objc private func handleThemeChange() {
        view.layer?.backgroundColor = DSV2.surface.cgColor
        view.needsDisplay = true
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
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
        titleLabel.font = NSFont.systemFont(ofSize: 20, weight: .bold)
        titleLabel.textColor = NSColor(hex: "#E5E2E1")
        titleLabel.translatesAutoresizingMaskIntoConstraints = false

        // Subtitle - 使用更小的字体和大写样式
        subtitleLabel.font = NSFont.systemFont(ofSize: 11, weight: .medium)
        subtitleLabel.textColor = NSColor(hex: "#A0A0A0")
        subtitleLabel.stringValue = "REAL-TIME EXTENSION HEALTH & BRIDGE METRICS"
        subtitleLabel.translatesAutoresizingMaskIntoConstraints = false

        // Refresh button - 使用 DSV2 次要按钮样式
        refreshButton.wantsLayer = true
        refreshButton.isBordered = false
        refreshButton.bezelStyle = .rounded
        refreshButton.target = self
        refreshButton.translatesAutoresizingMaskIntoConstraints = false

        // Ghost Border 样式
        refreshButton.layer?.borderWidth = 1
        refreshButton.layer?.borderColor = DSV2.outlineVariant.withAlphaComponent(0.1).cgColor
        refreshButton.layer?.cornerRadius = DSV2.radiusButton
        refreshButton.layer?.backgroundColor = DSV2.surfaceContainerHigh.cgColor

        let buttonAttributes: [NSAttributedString.Key: Any] = [
            .foregroundColor: DSV2.onSurface,
            .font: DSV2.fontLabelMd
        ]
        refreshButton.attributedTitle = NSAttributedString(string: "刷新", attributes: buttonAttributes)

        if #available(macOS 11.0, *) {
            refreshButton.image = NSImage(systemSymbolName: "arrow.clockwise", accessibilityDescription: "刷新")
            refreshButton.imagePosition = .imageLeading
            refreshButton.contentTintColor = DSV2.onSurface
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

        let cardWidth: CGFloat = 340
        let cardHeight: CGFloat = 160
        let spacing: CGFloat = DSV2.spacing4
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
        let cardWidth: CGFloat = 340
        let cardHeight: CGFloat = 160

        // 玻璃卡片容器
        let card = NSView()
        card.wantsLayer = true
        card.frame = NSRect(x: 0, y: 0, width: cardWidth, height: cardHeight)

        // 玻璃渐变背景
        let gradientLayer = CAGradientLayer()
        gradientLayer.colors = [
            DSV2.surfaceContainerHigh.withAlphaComponent(0.4).cgColor,
            DSV2.surfaceContainerLow.withAlphaComponent(0.4).cgColor
        ]
        gradientLayer.startPoint = CGPoint(x: 0, y: 0)
        gradientLayer.endPoint = CGPoint(x: 1, y: 1)
        gradientLayer.frame = card.bounds
        gradientLayer.cornerRadius = DSV2.radiusCard
        card.layer?.insertSublayer(gradientLayer, at: 0)

        // Ghost Border
        card.layer?.borderWidth = 1
        card.layer?.borderColor = DSV2.outlineVariant.withAlphaComponent(0.1).cgColor
        card.layer?.cornerRadius = DSV2.radiusCard
        card.layer?.backgroundColor = DSV2.surfaceContainerHigh.cgColor

        let padding: CGFloat = 20

        // 图标容器 - 带背景的方形图标
        let iconContainer = NSView(frame: NSRect(x: padding, y: cardHeight - padding - 48, width: 48, height: 48))
        iconContainer.wantsLayer = true
        iconContainer.layer?.backgroundColor = NSColor(hex: "#1E1E1E").cgColor
        iconContainer.layer?.cornerRadius = DSV2.radiusCard
        iconContainer.layer?.borderWidth = 1
        iconContainer.layer?.borderColor = NSColor(hex: "#3A3A3A").withAlphaComponent(0.5).cgColor
        card.addSubview(iconContainer)

        let symbolName = instance.clientName == "tweetClaw" ? "network" : "cpu"
        let icon = NSImageView(frame: NSRect(x: 12, y: 12, width: 24, height: 24))
        icon.image = NSImage(systemSymbolName: symbolName, accessibilityDescription: nil)
        icon.contentTintColor = instance.clientName == "tweetClaw" ? DSV2.primary : DSV2.secondary
        if #available(macOS 11.0, *) {
            icon.symbolConfiguration = NSImage.SymbolConfiguration(pointSize: 20, weight: .medium)
        }
        iconContainer.addSubview(icon)

        // 扩展名称
        let nameLabel = NSTextField(labelWithString: instance.clientName)
        nameLabel.font = DSV2.fontTitleLg
        nameLabel.textColor = NSColor(hex: "#E5E2E1")
        nameLabel.isBordered = false
        nameLabel.isEditable = false
        nameLabel.drawsBackground = false
        nameLabel.frame = NSRect(x: padding + 60, y: cardHeight - padding - 28, width: 180, height: 22)
        card.addSubview(nameLabel)

        // 版本标签
        let versionLabel = NSTextField(labelWithString: "v\(instance.clientVersion)")
        versionLabel.font = DSV2.fontMonoSm
        versionLabel.textColor = NSColor(hex: "#737373")
        versionLabel.isBordered = false
        versionLabel.isEditable = false
        versionLabel.drawsBackground = false
        versionLabel.frame = NSRect(x: padding + 60, y: cardHeight - padding - 46, width: 100, height: 14)
        card.addSubview(versionLabel)

        // 状态徽章（右上角）
        let secondsAgo = Int(Date().timeIntervalSince(instance.lastSeenAt))
        let isActive = secondsAgo < 60

        let statusBadge = NSView(frame: NSRect(x: cardWidth - padding - 70, y: cardHeight - padding - 24, width: 70, height: 24))
        statusBadge.wantsLayer = true
        statusBadge.layer?.backgroundColor = (isActive ? DSV2.tertiary : NSColor(hex: "#3A3A3A")).withAlphaComponent(0.1).cgColor
        statusBadge.layer?.borderWidth = 1
        statusBadge.layer?.borderColor = (isActive ? DSV2.tertiary : NSColor(hex: "#525252")).withAlphaComponent(0.2).cgColor
        statusBadge.layer?.cornerRadius = 12
        card.addSubview(statusBadge)

        let statusDot = NSView(frame: NSRect(x: 8, y: 8, width: 8, height: 8))
        statusDot.wantsLayer = true
        statusDot.layer?.backgroundColor = (isActive ? DSV2.tertiary : NSColor(hex: "#737373")).cgColor
        statusDot.layer?.cornerRadius = 4
        statusBadge.addSubview(statusDot)

        let statusText = NSTextField(labelWithString: isActive ? "ACTIVE" : "IDLE")
        statusText.font = NSFont.systemFont(ofSize: 9, weight: .bold)
        statusText.textColor = isActive ? DSV2.tertiary : NSColor(hex: "#737373")
        statusText.isBordered = false
        statusText.isEditable = false
        statusText.drawsBackground = false
        statusText.alignment = .center
        statusText.frame = NSRect(x: 20, y: 5, width: 45, height: 14)
        statusBadge.addSubview(statusText)

        // Instance Name 容器（如果有名字则显示）
        var currentY: CGFloat = cardHeight - padding - 68
        if let instanceName = instance.instanceName {
            let nameContainer = NSView(frame: NSRect(x: padding + 60, y: currentY, width: cardWidth - padding - 80, height: 18))
            nameContainer.wantsLayer = true
            nameContainer.layer?.backgroundColor = NSColor(hex: "#1A4D2E").withAlphaComponent(0.3).cgColor
            nameContainer.layer?.cornerRadius = 4
            nameContainer.layer?.borderWidth = 1
            nameContainer.layer?.borderColor = NSColor(hex: "#2D5F3F").withAlphaComponent(0.5).cgColor
            card.addSubview(nameContainer)

            let namePrefix = NSTextField(labelWithString: "NAME:")
            namePrefix.font = DSV2.fontMonoSm
            namePrefix.textColor = NSColor(hex: "#4ADE80")
            namePrefix.isBordered = false
            namePrefix.isEditable = false
            namePrefix.drawsBackground = false
            namePrefix.frame = NSRect(x: 6, y: 3, width: 40, height: 12)
            nameContainer.addSubview(namePrefix)

            let nameLabel = NSTextField(labelWithString: instanceName)
            nameLabel.font = DSV2.fontMonoSm
            nameLabel.textColor = NSColor(hex: "#86EFAC")
            nameLabel.isBordered = false
            nameLabel.isEditable = false
            nameLabel.drawsBackground = false
            nameLabel.frame = NSRect(x: 48, y: 3, width: cardWidth - padding - 140, height: 12)
            nameContainer.addSubview(nameLabel)

            currentY -= 22
        }

        // Instance ID 容器（带复制按钮）
        let idContainer = NSView(frame: NSRect(x: padding + 60, y: currentY, width: cardWidth - padding - 80, height: 18))
        idContainer.wantsLayer = true
        idContainer.layer?.backgroundColor = NSColor(hex: "#0E0E0E").withAlphaComponent(0.5).cgColor
        idContainer.layer?.cornerRadius = 4
        idContainer.layer?.borderWidth = 1
        idContainer.layer?.borderColor = NSColor(hex: "#1E1E1E").withAlphaComponent(0.5).cgColor
        card.addSubview(idContainer)

        let idPrefix = NSTextField(labelWithString: "ID:")
        idPrefix.font = DSV2.fontMonoSm
        idPrefix.textColor = NSColor(hex: "#737373")
        idPrefix.isBordered = false
        idPrefix.isEditable = false
        idPrefix.drawsBackground = false
        idPrefix.frame = NSRect(x: 6, y: 3, width: 20, height: 12)
        idContainer.addSubview(idPrefix)

        let displayId = String(instance.instanceId.prefix(12))
        let idLabel = NSTextField(labelWithString: displayId)
        idLabel.font = DSV2.fontMonoSm
        idLabel.textColor = NSColor(hex: "#A0A0A0")
        idLabel.isBordered = false
        idLabel.isEditable = false
        idLabel.drawsBackground = false
        idLabel.frame = NSRect(x: 28, y: 3, width: 120, height: 12)
        idContainer.addSubview(idLabel)

        // 分隔线（使用 Ghost Border 原则）
        let divider = NSView(frame: NSRect(x: padding, y: 56, width: cardWidth - 2 * padding, height: 1))
        divider.wantsLayer = true
        divider.layer?.backgroundColor = DSV2.outlineVariant.withAlphaComponent(0.05).cgColor
        card.addSubview(divider)

        // 底部指标区域（3列布局）
        let metricsY: CGFloat = 16
        let metricWidth: CGFloat = (cardWidth - 2 * padding) / 3

        // 指标1：延迟/最后活跃
        createMetric(
            in: card,
            x: padding,
            y: metricsY,
            width: metricWidth,
            title: isActive ? "LATENCY" : "LAST SEEN",
            value: isActive ? "24ms" : timeAgoString(from: instance.lastSeenAt),
            valueColor: isActive ? DSV2.secondary : NSColor(hex: "#C9C5C4")
        )

        // 指标2：连接时间
        createMetric(
            in: card,
            x: padding + metricWidth,
            y: metricsY,
            width: metricWidth,
            title: "CONNECTED SINCE",
            value: shortTimeFormatter.string(from: instance.connectedAt),
            valueColor: NSColor(hex: "#C9C5C4")
        )

        // 指标3：状态信息
        createMetric(
            in: card,
            x: padding + metricWidth * 2,
            y: metricsY,
            width: metricWidth,
            title: instance.isTemporary ? "TYPE" : "STATUS",
            value: instance.isTemporary ? "Legacy" : "Active",
            valueColor: NSColor(hex: "#C9C5C4")
        )

        return card
    }

    private func createMetric(in container: NSView, x: CGFloat, y: CGFloat, width: CGFloat, title: String, value: String, valueColor: NSColor) {
        let titleLabel = NSTextField(labelWithString: title)
        titleLabel.font = NSFont.systemFont(ofSize: 9, weight: .bold)
        titleLabel.textColor = NSColor(hex: "#737373")
        titleLabel.isBordered = false
        titleLabel.isEditable = false
        titleLabel.drawsBackground = false
        titleLabel.frame = NSRect(x: x, y: y + 18, width: width - 8, height: 10)
        container.addSubview(titleLabel)

        let valueLabel = NSTextField(labelWithString: value)
        valueLabel.font = DSV2.fontMonoSm
        valueLabel.textColor = valueColor
        valueLabel.isBordered = false
        valueLabel.isEditable = false
        valueLabel.drawsBackground = false
        valueLabel.frame = NSRect(x: x, y: y, width: width - 8, height: 14)
        container.addSubview(valueLabel)
    }

    private func timeAgoString(from date: Date) -> String {
        let seconds = Int(Date().timeIntervalSince(date))
        if seconds < 60 {
            return "\(seconds)s ago"
        } else if seconds < 3600 {
            return "\(seconds / 60)m ago"
        } else if seconds < 86400 {
            return "\(seconds / 3600)h ago"
        } else {
            return "\(seconds / 86400)d ago"
        }
    }

    private let shortTimeFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "HH:mm:ss"
        return f
    }()

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
