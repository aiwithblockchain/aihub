import AppKit

final class InstancesPanelViewController: NSViewController {

    // MARK: - UI Elements

    private let titleLabel = NSTextField(labelWithString: "")
    private let subtitleLabel = NSTextField(labelWithString: "")
    private let refreshButton = NSButton(title: "", target: nil, action: #selector(refreshClicked))
    private var gridView: NSView!
    private var scrollView: NSScrollView!
    private var emptyView: NSStackView!
    private var emptyTextLabel: NSTextField!
    private var emptyHintLabel: NSTextField!
    private let headerImageView = NSImageView()
    private let headerSeparator = NSView()


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

        // 注册语言变化通知
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleLanguageChange),
            name: LanguageManager.languageDidChangeNotification,
            object: nil
        )

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleInstancesDidChange),
            name: LocalBridgeGoManager.instancesDidChangeNotification,
            object: nil
        )

        // 初始化文本
        updateText()
    }

    override func viewWillAppear() {
        super.viewWillAppear()
        // Auto-refresh when entering the panel
        refresh()
    }

    @objc private func handleLanguageChange() {
        updateText()
    }

    @objc private func handleInstancesDidChange(_ notification: Notification) {
        if let snapshots = notification.userInfo?["instances"] as? [LocalBridgeGoManager.InstanceSnapshot] {
            instances = snapshots
            rebuildGridView()
            updateEmptyState()
            return
        }

        refresh()
    }

    private func updateText() {
        titleLabel.stringValue = LanguageManager.shared.localized("instances.title")
        subtitleLabel.stringValue = LanguageManager.shared.localized("instances.subtitle")

        // Update refresh button with localized text
        let buttonAttributes: [NSAttributedString.Key: Any] = [
            .foregroundColor: DSV2.onSurface,
            .font: DSV2.fontLabelMd
        ]
        refreshButton.attributedTitle = NSAttributedString(
            string: LanguageManager.shared.localized("instances.refresh"),
            attributes: buttonAttributes
        )

        // Update empty state labels
        emptyTextLabel?.stringValue = LanguageManager.shared.localized("instances.empty")
        emptyHintLabel?.stringValue = LanguageManager.shared.localized("instances.empty.hint")
    }

    @objc private func handleThemeChange() {
        // 更新背景色
        view.layer?.backgroundColor = DSV2.surface.cgColor

        // 更新标题和副标题颜色
        titleLabel.textColor = DSV2.onSurface
        subtitleLabel.textColor = DSV2.onSurfaceVariant
        headerImageView.contentTintColor = DSV2.primary
        headerSeparator.layer?.backgroundColor = DSV2.divider.withAlphaComponent(0.8).cgColor


        // 更新刷新按钮
        refreshButton.layer?.borderColor = DSV2.outlineVariant.withAlphaComponent(0.1).cgColor
        refreshButton.layer?.backgroundColor = DSV2.surfaceContainerHigh.cgColor
        updateText()
        refreshButton.contentTintColor = DSV2.onSurface

        // 重新构建网格视图以更新实例卡片
        rebuildGridView()

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
        // 设置主视图背景
        view.wantsLayer = true
        view.layer?.backgroundColor = DSV2.surface.cgColor

        // Title - 使用 DSV2 样式
        titleLabel.font = DSV2.fontTitleLg
        titleLabel.textColor = DSV2.onSurface
        titleLabel.translatesAutoresizingMaskIntoConstraints = false

        // Header Icon
        if #available(macOS 11.0, *) {
            headerImageView.image = NSImage(systemSymbolName: "server.rack", accessibilityDescription: nil)
            headerImageView.symbolConfiguration = NSImage.SymbolConfiguration(pointSize: 20, weight: .semibold)
            headerImageView.contentTintColor = DSV2.primary
        }
        headerImageView.translatesAutoresizingMaskIntoConstraints = false

        // Subtitle - 使用更小的字体和大写样式
        subtitleLabel.font = DSV2.fontLabelSm
        subtitleLabel.textColor = DSV2.onSurfaceTertiary
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
        let buttonTitle = LanguageManager.shared.localized("instances.refresh")
        refreshButton.attributedTitle = NSAttributedString(string: buttonTitle, attributes: buttonAttributes)

        if #available(macOS 11.0, *) {
            refreshButton.image = NSImage(systemSymbolName: "arrow.clockwise", accessibilityDescription: "Refresh")
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

        let emptyText = NSTextField(labelWithString: "")
        emptyText.font = DSV2.fontBodyLg
        emptyText.textColor = DSV2.onSurfaceVariant
        emptyText.alignment = .center
        emptyText.isEditable = false
        emptyText.isBordered = false
        emptyText.drawsBackground = false
        emptyTextLabel = emptyText

        let emptyHint = NSTextField(wrappingLabelWithString: "")
        emptyHint.font = DSV2.fontBodySm
        emptyHint.textColor = DSV2.onSurfaceTertiary
        emptyHint.alignment = .center
        emptyHint.isEditable = false
        emptyHint.isBordered = false
        emptyHint.drawsBackground = false
        emptyHintLabel = emptyHint

        emptyView = NSStackView(views: [emptyIcon, emptyText, emptyHint])
        emptyView.orientation = .vertical
        emptyView.spacing = DSV2.spacing4
        emptyView.translatesAutoresizingMaskIntoConstraints = false
        emptyView.isHidden = true

        // Header row
        let headerLeftStack = NSStackView(views: [headerImageView, titleLabel])
        headerLeftStack.orientation = .horizontal
        headerLeftStack.spacing = 8
        headerLeftStack.alignment = .centerY

        let topRow = NSStackView(views: [headerLeftStack, NSView(), refreshButton])
        topRow.orientation = .horizontal
        topRow.alignment = .centerY
        topRow.translatesAutoresizingMaskIntoConstraints = false

        let headerStack = NSStackView(views: [topRow, subtitleLabel])
        headerStack.orientation = .vertical
        headerStack.spacing = 4
        headerStack.alignment = .leading
        headerStack.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(headerStack)
        
        headerSeparator.wantsLayer = true
        headerSeparator.layer?.backgroundColor = DSV2.divider.withAlphaComponent(0.8).cgColor
        headerSeparator.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(headerSeparator)
        
        view.addSubview(scrollView)
        view.addSubview(emptyView)


        NSLayoutConstraint.activate([
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

        let spacing: CGFloat = DSV2.spacing6
        let cardWidth: CGFloat = 390 // 根据要求调窄到 390px
        // 确保高度足以容纳所有的边距、内容和间距（大约需要210px）
        let minCardHeight: CGFloat = 216 
        let columns = 2

        // 计算总高度和宽度
        let rows = (instances.count + columns - 1) / columns
        let totalHeight = CGFloat(rows) * minCardHeight + CGFloat(max(0, rows - 1)) * spacing
        let totalWidth = CGFloat(columns) * cardWidth + CGFloat(columns - 1) * spacing

        gridView.frame = NSRect(x: 0, y: 0, width: totalWidth, height: totalHeight)

        for (index, instance) in instances.enumerated() {
            let row = index / columns
            let col = index % columns

            let card = createInstanceCard(instance: instance)
            gridView.addSubview(card)

            let xOffset = CGFloat(col) * (cardWidth + spacing)
            let yOffset = CGFloat(row) * (minCardHeight + spacing)

            card.frame = NSRect(x: xOffset, y: yOffset, width: cardWidth, height: minCardHeight)
        }
    }


    private func createInstanceCard(instance: LocalBridgeGoManager.InstanceSnapshot) -> NSView {
        // 玻璃卡片容器
        let card = NSView()
        card.wantsLayer = true
        card.layer?.backgroundColor = DSV2.surfaceContainerHigh.withAlphaComponent(0.4).cgColor
        card.layer?.cornerRadius = DSV2.radiusCard
        card.layer?.borderWidth = 1
        card.layer?.borderColor = DSV2.outlineVariant.withAlphaComponent(0.1).cgColor

        // 主容器 StackView
        let mainStack = NSStackView()
        mainStack.orientation = .vertical
        mainStack.alignment = .leading
        mainStack.spacing = 14
        mainStack.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(mainStack)

        // --- Top Row: Icon, Name/Version, Status Badge ---
        let topRow = NSStackView()
        topRow.orientation = .horizontal
        topRow.alignment = .centerY
        topRow.spacing = 12

        // 图标容器
        let iconSize: CGFloat = 40
        let iconContainer = NSView()
        iconContainer.wantsLayer = true
        iconContainer.layer?.backgroundColor = DSV2.surfaceContainerLow.cgColor
        iconContainer.layer?.cornerRadius = 10
        iconContainer.layer?.borderWidth = 1
        iconContainer.layer?.borderColor = DSV2.outlineVariant.withAlphaComponent(0.1).cgColor
        iconContainer.translatesAutoresizingMaskIntoConstraints = false
        iconContainer.widthAnchor.constraint(equalToConstant: iconSize).isActive = true
        iconContainer.heightAnchor.constraint(equalToConstant: iconSize).isActive = true

        let symbolName = instance.clientName == "tweetClaw" ? "network" : "cpu"
        let icon = NSImageView()
        icon.image = NSImage(systemSymbolName: symbolName, accessibilityDescription: nil)
        icon.contentTintColor = instance.clientName == "tweetClaw" ? DSV2.primary : DSV2.secondary
        if #available(macOS 11.0, *) {
            icon.symbolConfiguration = NSImage.SymbolConfiguration(pointSize: 18, weight: .medium)
        }
        icon.translatesAutoresizingMaskIntoConstraints = false
        iconContainer.addSubview(icon)

        // 名称和版本
        let nameVersionStack = NSStackView()
        nameVersionStack.orientation = .vertical
        nameVersionStack.alignment = .leading
        nameVersionStack.spacing = 2
        
        let nameLabel = NSTextField(labelWithString: instance.clientName)
        nameLabel.font = DSV2.fontTitleMd
        nameLabel.textColor = DSV2.onSurface
        
        let versionLabel = NSTextField(labelWithString: "v\(instance.clientVersion)")
        versionLabel.font = DSV2.fontMonoSm
        versionLabel.textColor = DSV2.onSurfaceVariant
        
        nameVersionStack.addArrangedSubview(nameLabel)
        nameVersionStack.addArrangedSubview(versionLabel)

        // 状态徽章
        let secondsAgo = Int(Date().timeIntervalSince(instance.lastSeenAt))
        let isActive = secondsAgo < 60
        
        let statusBadge = NSView()
        statusBadge.wantsLayer = true
        statusBadge.layer?.backgroundColor = (isActive ? DSV2.tertiary : DSV2.onSurfaceVariant).withAlphaComponent(0.1).cgColor
        statusBadge.layer?.cornerRadius = 10
        statusBadge.layer?.borderWidth = 1
        statusBadge.layer?.borderColor = (isActive ? DSV2.tertiary : DSV2.outlineVariant).withAlphaComponent(0.2).cgColor
        statusBadge.translatesAutoresizingMaskIntoConstraints = false
        
        let statusDot = NSView()
        statusDot.wantsLayer = true
        statusDot.layer?.backgroundColor = (isActive ? DSV2.tertiary : DSV2.onSurfaceVariant).cgColor
        statusDot.layer?.cornerRadius = 3.5
        statusDot.translatesAutoresizingMaskIntoConstraints = false
        
        let statusTextValue = isActive ? LanguageManager.shared.localized("instances.active") : LanguageManager.shared.localized("instances.idle")
        let statusText = NSTextField(labelWithString: statusTextValue)
        statusText.font = NSFont.systemFont(ofSize: 10, weight: .bold)
        statusText.textColor = isActive ? DSV2.tertiary : DSV2.onSurfaceVariant
        statusText.translatesAutoresizingMaskIntoConstraints = false

        statusBadge.addSubview(statusDot)
        statusBadge.addSubview(statusText)

        topRow.addArrangedSubview(iconContainer)
        topRow.addArrangedSubview(nameVersionStack)
        topRow.addArrangedSubview(NSView()) // Spacer
        topRow.addArrangedSubview(statusBadge)
        
        mainStack.addArrangedSubview(topRow)

        // --- Mid Section: Pills for Name and ID ---
        let midStack = NSStackView()
        midStack.orientation = .vertical
        midStack.alignment = .leading
        midStack.spacing = 8
        
        if let instanceName = instance.instanceName, !instanceName.isEmpty {
            let pill = createPill(prefix: "NAME:", value: instanceName, color: DSV2.tertiary)
            midStack.addArrangedSubview(pill)
            pill.widthAnchor.constraint(equalTo: midStack.widthAnchor).isActive = true
        }

        let idValue = String(instance.instanceId.prefix(16)) + "..."
        let idPill = createPill(prefix: "ID:", value: idValue, color: DSV2.onSurfaceVariant)
        midStack.addArrangedSubview(idPill)
        idPill.widthAnchor.constraint(equalTo: midStack.widthAnchor).isActive = true
        
        mainStack.addArrangedSubview(midStack)

        // Separator Line
        let separator = NSView()
        separator.wantsLayer = true
        separator.layer?.backgroundColor = DSV2.divider.withAlphaComponent(0.8).cgColor
        separator.translatesAutoresizingMaskIntoConstraints = false
        separator.heightAnchor.constraint(equalToConstant: 1).isActive = true
        mainStack.addArrangedSubview(separator)

        // --- Bottom Section: Metrics ---
        let metricsRow = NSStackView()
        metricsRow.orientation = .horizontal
        metricsRow.distribution = .fillEqually
        metricsRow.alignment = .top
        metricsRow.spacing = 0 
        
        // 指标1：延迟 (左对齐)
        let latencyTitle = isActive ? LanguageManager.shared.localized("instances.latency") : LanguageManager.shared.localized("instances.last_seen")
        let latencyValue = isActive ? "24ms" : timeAgoString(from: instance.lastSeenAt)
        metricsRow.addArrangedSubview(createLeadingMetric(title: latencyTitle, value: latencyValue, color: isActive ? DSV2.secondary : DSV2.onSurfaceVariant))
        
        // 指标2：连接时间 (居中)
        metricsRow.addArrangedSubview(createCenteredMetric(title: LanguageManager.shared.localized("instances.connected_since"), value: shortTimeFormatter.string(from: instance.connectedAt), color: DSV2.onSurface))
        
        // 指标3：状态 (右对齐)
        let statusValue = instance.isTemporary ? LanguageManager.shared.localized("common.legacy") : LanguageManager.shared.localized("instances.active")
        metricsRow.addArrangedSubview(createTrailingMetric(title: LanguageManager.shared.localized("instances.status"), value: statusValue, color: DSV2.onSurface))
        
        mainStack.addArrangedSubview(metricsRow)
        
        // --- Constraints ---
        NSLayoutConstraint.activate([
            mainStack.topAnchor.constraint(equalTo: card.topAnchor, constant: 20),
            mainStack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 20),
            mainStack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -20),
            mainStack.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -20),
            
            topRow.widthAnchor.constraint(equalTo: mainStack.widthAnchor),
            midStack.widthAnchor.constraint(equalTo: mainStack.widthAnchor),
            separator.widthAnchor.constraint(equalTo: mainStack.widthAnchor),
            metricsRow.widthAnchor.constraint(equalTo: mainStack.widthAnchor),

            icon.centerXAnchor.constraint(equalTo: iconContainer.centerXAnchor),
            icon.centerYAnchor.constraint(equalTo: iconContainer.centerYAnchor),
            
            statusBadge.heightAnchor.constraint(equalToConstant: 22),
            statusDot.leadingAnchor.constraint(equalTo: statusBadge.leadingAnchor, constant: 8),
            statusDot.centerYAnchor.constraint(equalTo: statusBadge.centerYAnchor),
            statusDot.widthAnchor.constraint(equalToConstant: 7),
            statusDot.heightAnchor.constraint(equalToConstant: 7),
            
            statusText.leadingAnchor.constraint(equalTo: statusDot.trailingAnchor, constant: 6),
            statusText.trailingAnchor.constraint(equalTo: statusBadge.trailingAnchor, constant: -10),
            statusText.centerYAnchor.constraint(equalTo: statusBadge.centerYAnchor)
        ])

        return card
    }

    private func createPill(prefix: String, value: String, color: NSColor) -> NSView {
        let pill = NSView()
        pill.wantsLayer = true
        pill.layer?.backgroundColor = color.withAlphaComponent(0.08).cgColor
        pill.layer?.cornerRadius = 6
        pill.layer?.borderWidth = 1
        pill.layer?.borderColor = color.withAlphaComponent(0.15).cgColor
        pill.translatesAutoresizingMaskIntoConstraints = false
        pill.heightAnchor.constraint(equalToConstant: 24).isActive = true
        
        let prefixLabel = NSTextField(labelWithString: prefix)
        prefixLabel.font = DSV2.fontMonoSm
        prefixLabel.textColor = color
        prefixLabel.translatesAutoresizingMaskIntoConstraints = false
        
        let valueLabel = NSTextField(labelWithString: value)
        valueLabel.font = DSV2.fontMonoSm
        valueLabel.textColor = color.withAlphaComponent(0.8)
        valueLabel.translatesAutoresizingMaskIntoConstraints = false
        
        pill.addSubview(prefixLabel)
        pill.addSubview(valueLabel)
        
        NSLayoutConstraint.activate([
            prefixLabel.leadingAnchor.constraint(equalTo: pill.leadingAnchor, constant: 8),
            prefixLabel.centerYAnchor.constraint(equalTo: pill.centerYAnchor),
            
            valueLabel.leadingAnchor.constraint(equalTo: prefixLabel.trailingAnchor, constant: 6),
            valueLabel.centerYAnchor.constraint(equalTo: pill.centerYAnchor),
            valueLabel.trailingAnchor.constraint(lessThanOrEqualTo: pill.trailingAnchor, constant: -8)
        ])
        
        return pill
    }

    private func createLeadingMetric(title: String, value: String, color: NSColor) -> NSView {
        let stack = NSStackView()
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 4
        
        let titleLabel = NSTextField(labelWithString: title)
        titleLabel.font = NSFont.systemFont(ofSize: 11, weight: .regular)
        titleLabel.textColor = DSV2.onSurfaceTertiary
        
        let valueLabel = NSTextField(labelWithString: value)
        valueLabel.font = DSV2.fontMonoMd
        valueLabel.textColor = color
        
        stack.addArrangedSubview(titleLabel)
        stack.addArrangedSubview(valueLabel)
        
        return stack
    }

    private func createCenteredMetric(title: String, value: String, color: NSColor) -> NSView {
        let stack = NSStackView()
        stack.orientation = .vertical
        stack.alignment = .centerX
        stack.spacing = 4
        
        let titleLabel = NSTextField(labelWithString: title)
        titleLabel.font = NSFont.systemFont(ofSize: 11, weight: .regular)
        titleLabel.textColor = DSV2.onSurfaceTertiary
        
        let valueLabel = NSTextField(labelWithString: value)
        valueLabel.font = DSV2.fontMonoMd
        valueLabel.textColor = color
        
        stack.addArrangedSubview(titleLabel)
        stack.addArrangedSubview(valueLabel)
        
        return stack
    }

    private func createTrailingMetric(title: String, value: String, color: NSColor) -> NSView {
        let stack = NSStackView()
        stack.orientation = .vertical
        stack.alignment = .trailing
        stack.spacing = 4
        
        let titleLabel = NSTextField(labelWithString: title)
        titleLabel.font = NSFont.systemFont(ofSize: 11, weight: .regular)
        titleLabel.textColor = DSV2.onSurfaceTertiary
        
        let valueLabel = NSTextField(labelWithString: value)
        valueLabel.font = DSV2.fontMonoMd
        valueLabel.textColor = color
        
        stack.addArrangedSubview(titleLabel)
        stack.addArrangedSubview(valueLabel)
        
        return stack
    }

    private func timeAgoString(from date: Date) -> String {
        let seconds = Int(Date().timeIntervalSince(date))
        let format = LanguageManager.shared.localized("instances.time_ago")
        
        if seconds < 60 {
            return String(format: format, "\(seconds)", LanguageManager.shared.localized("instances.unit_s"))
        } else if seconds < 3600 {
            return String(format: format, "\(seconds / 60)", LanguageManager.shared.localized("instances.unit_m"))
        } else if seconds < 86400 {
            return String(format: format, "\(seconds / 3600)", LanguageManager.shared.localized("instances.unit_h"))
        } else {
            return String(format: format, "\(seconds / 86400)", LanguageManager.shared.localized("instances.unit_d"))
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
        refreshButton.title = LanguageManager.shared.localized("instances.refreshed")
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in
            self?.updateText()
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
