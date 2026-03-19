import AppKit

private enum SettingsSection: String, CaseIterable {
    case model
    case theme
    case account

    var title: String {
        switch self {
        case .model:
            return "Model"
        case .theme:
            return "主题"
        case .account:
            return "账号"
        }
    }
}

private protocol ThemeApplicable: AnyObject {
    func applyTheme()
}

private final class SettingsTitlebarCloseButton: NSButton {
    private var trackingAreaRef: NSTrackingArea?
    private var isHovering = false
    private var cachedPalette: ConsoleThemePalette?

    override var isHighlighted: Bool {
        didSet {
            updateAppearance()
        }
    }

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        image = NSImage(systemSymbolName: "xmark", accessibilityDescription: "关闭")
        isBordered = false
        wantsLayer = true
        layer?.cornerRadius = 6
    }

    required init?(coder: NSCoder) {
        fatalError()
    }

    override func updateTrackingAreas() {
        super.updateTrackingAreas()

        if let trackingAreaRef {
            removeTrackingArea(trackingAreaRef)
        }

        let options: NSTrackingArea.Options = [.mouseEnteredAndExited, .activeInKeyWindow, .inVisibleRect]
        let trackingArea = NSTrackingArea(rect: .zero, options: options, owner: self, userInfo: nil)
        addTrackingArea(trackingArea)
        trackingAreaRef = trackingArea
    }

    override func mouseEntered(with event: NSEvent) {
        isHovering = true
        updateAppearance()
    }

    override func mouseExited(with event: NSEvent) {
        isHovering = false
        updateAppearance()
    }

    func applyTheme(with palette: ConsoleThemePalette) {
        cachedPalette = palette
        updateAppearance()
    }

    private func updateAppearance() {
        guard let palette = cachedPalette else { return }

        contentTintColor = isHighlighted ? palette.textPrimary : palette.textSecondary

        if isHighlighted {
            layer?.backgroundColor = palette.elevatedBackground.withAlphaComponent(0.95).cgColor
        } else if isHovering {
            layer?.backgroundColor = palette.elevatedBackground.withAlphaComponent(0.65).cgColor
        } else {
            layer?.backgroundColor = NSColor.clear.cgColor
        }
    }
}

private final class SettingsSidebarButton: NSButton {
    private var trackingAreaRef: NSTrackingArea?
    private var isHovering = false
    private var isSelectedState = false
    private var cachedPalette: ConsoleThemePalette?

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        isBordered = false
        alignment = .left
        wantsLayer = true
        layer?.cornerRadius = 8
        imagePosition = .noImage
    }

    required init?(coder: NSCoder) {
        fatalError()
    }

    override func updateTrackingAreas() {
        super.updateTrackingAreas()

        if let trackingAreaRef {
            removeTrackingArea(trackingAreaRef)
        }

        let options: NSTrackingArea.Options = [.mouseEnteredAndExited, .activeInKeyWindow, .inVisibleRect]
        let trackingArea = NSTrackingArea(rect: .zero, options: options, owner: self, userInfo: nil)
        addTrackingArea(trackingArea)
        trackingAreaRef = trackingArea
    }

    override func mouseEntered(with event: NSEvent) {
        isHovering = true
        updateAppearance()
    }

    override func mouseExited(with event: NSEvent) {
        isHovering = false
        updateAppearance()
    }

    func applyTheme(with palette: ConsoleThemePalette, isSelected: Bool) {
        cachedPalette = palette
        isSelectedState = isSelected
        font = .systemFont(ofSize: 14, weight: isSelected ? .medium : .regular)
        updateAppearance()
    }

    private func updateAppearance() {
        guard let palette = cachedPalette else { return }

        if isSelectedState {
            contentTintColor = palette.textPrimary
            layer?.backgroundColor = palette.elevatedBackground.cgColor
        } else if isHovering {
            contentTintColor = palette.textPrimary
            layer?.backgroundColor = palette.elevatedBackground.withAlphaComponent(0.45).cgColor
        } else {
            contentTintColor = palette.textTertiary
            layer?.backgroundColor = NSColor.clear.cgColor
        }
    }
}

final class AISettingsViewController: NSViewController {
    private let titleLabel = NSTextField(labelWithString: "设置")
    private let closeButton = SettingsTitlebarCloseButton()
    private let sidebarView = NSView()
    private let detailContainer = NSView()
    private var sidebarButtons: [SettingsSection: SettingsSidebarButton] = [:]
    private var currentDetailViewController: (NSViewController & ThemeApplicable)?
    private var selectedSection: SettingsSection = .model
    private var themeObserver: NSObjectProtocol?

    override func loadView() {
        let rootView = ThemeAwareView(frame: NSRect(x: 0, y: 0, width: 900, height: 600))
        rootView.wantsLayer = true
        rootView.onEffectiveAppearanceChange = { [weak self] in
            self?.applyTheme()
        }
        view = rootView
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        setupLayout()
        setupSidebarItems()
        switchToSection(.model)
        applyTheme()
        themeObserver = NotificationCenter.default.addObserver(
            forName: ThemeManager.didChangeNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.applyTheme()
        }
    }

    deinit {
        if let themeObserver {
            NotificationCenter.default.removeObserver(themeObserver)
        }
    }

    private func setupLayout() {
        let headerView = NSView()
        headerView.wantsLayer = true
        headerView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(headerView)

        titleLabel.font = .systemFont(ofSize: 15, weight: .semibold)
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        headerView.addSubview(titleLabel)

        closeButton.target = self
        closeButton.action = #selector(closeSettings)
        closeButton.translatesAutoresizingMaskIntoConstraints = false
        headerView.addSubview(closeButton)

        sidebarView.wantsLayer = true
        sidebarView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(sidebarView)

        detailContainer.wantsLayer = true
        detailContainer.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(detailContainer)

        let divider = NSView()
        divider.wantsLayer = true
        divider.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(divider)

        let headerDivider = NSView()
        headerDivider.wantsLayer = true
        headerDivider.translatesAutoresizingMaskIntoConstraints = false
        headerView.addSubview(headerDivider)

        divider.identifier = NSUserInterfaceItemIdentifier("settingsSidebarDivider")
        headerDivider.identifier = NSUserInterfaceItemIdentifier("settingsHeaderDivider")

        NSLayoutConstraint.activate([
            headerView.topAnchor.constraint(equalTo: view.topAnchor),
            headerView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            headerView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            headerView.heightAnchor.constraint(equalToConstant: 52),

            titleLabel.leadingAnchor.constraint(equalTo: headerView.leadingAnchor, constant: 24),
            titleLabel.centerYAnchor.constraint(equalTo: headerView.centerYAnchor),

            closeButton.trailingAnchor.constraint(equalTo: headerView.trailingAnchor, constant: -24),
            closeButton.centerYAnchor.constraint(equalTo: headerView.centerYAnchor),
            closeButton.widthAnchor.constraint(equalToConstant: 28),
            closeButton.heightAnchor.constraint(equalToConstant: 28),

            headerDivider.leadingAnchor.constraint(equalTo: headerView.leadingAnchor),
            headerDivider.trailingAnchor.constraint(equalTo: headerView.trailingAnchor),
            headerDivider.bottomAnchor.constraint(equalTo: headerView.bottomAnchor),
            headerDivider.heightAnchor.constraint(equalToConstant: 1),

            sidebarView.topAnchor.constraint(equalTo: headerView.bottomAnchor),
            sidebarView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            sidebarView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            sidebarView.widthAnchor.constraint(equalToConstant: 208),

            divider.topAnchor.constraint(equalTo: headerView.bottomAnchor),
            divider.leadingAnchor.constraint(equalTo: sidebarView.trailingAnchor),
            divider.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            divider.widthAnchor.constraint(equalToConstant: 1),

            detailContainer.topAnchor.constraint(equalTo: headerView.bottomAnchor),
            detailContainer.leadingAnchor.constraint(equalTo: divider.trailingAnchor),
            detailContainer.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            detailContainer.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }

    private func setupSidebarItems() {
        let stack = NSStackView()
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 4
        stack.translatesAutoresizingMaskIntoConstraints = false
        sidebarView.addSubview(stack)

        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: sidebarView.topAnchor, constant: 12),
            stack.leadingAnchor.constraint(equalTo: sidebarView.leadingAnchor, constant: 12),
            stack.trailingAnchor.constraint(equalTo: sidebarView.trailingAnchor, constant: -12)
        ])

        for section in SettingsSection.allCases {
            let button = SettingsSidebarButton()
            button.title = section.title
            button.target = self
            button.action = #selector(sidebarButtonTapped(_:))
            button.tag = SettingsSection.allCases.firstIndex(of: section) ?? 0
            button.translatesAutoresizingMaskIntoConstraints = false
            button.heightAnchor.constraint(equalToConstant: 32).isActive = true
            button.widthAnchor.constraint(equalToConstant: 184).isActive = true
            stack.addArrangedSubview(button)
            sidebarButtons[section] = button
        }
    }

    private func switchToSection(_ section: SettingsSection) {
        selectedSection = section
        currentDetailViewController?.view.removeFromSuperview()
        currentDetailViewController?.removeFromParent()

        let detailViewController: (NSViewController & ThemeApplicable)
        switch section {
        case .model:
            detailViewController = SettingsModelViewController()
        case .theme:
            detailViewController = SettingsThemeViewController()
        case .account:
            detailViewController = SettingsAccountViewController()
        }

        addChild(detailViewController)
        detailViewController.view.translatesAutoresizingMaskIntoConstraints = false
        detailContainer.addSubview(detailViewController.view)
        NSLayoutConstraint.activate([
            detailViewController.view.topAnchor.constraint(equalTo: detailContainer.topAnchor),
            detailViewController.view.leadingAnchor.constraint(equalTo: detailContainer.leadingAnchor),
            detailViewController.view.trailingAnchor.constraint(equalTo: detailContainer.trailingAnchor),
            detailViewController.view.bottomAnchor.constraint(equalTo: detailContainer.bottomAnchor)
        ])

        currentDetailViewController = detailViewController
        updateSidebarSelection()
        applyTheme()
    }

    private func updateSidebarSelection() {
        let palette = ThemeManager.shared.palette(for: view.effectiveAppearance)
        for section in SettingsSection.allCases {
            guard let button = sidebarButtons[section] else { continue }
            let isSelected = section == selectedSection
            button.applyTheme(with: palette, isSelected: isSelected)
        }
    }

    func applyTheme() {
        let palette = ThemeManager.shared.palette(for: view.effectiveAppearance)
        view.layer?.backgroundColor = palette.windowBackground.cgColor
        sidebarView.layer?.backgroundColor = palette.sidebarBackground.cgColor
        detailContainer.layer?.backgroundColor = palette.windowBackground.cgColor
        titleLabel.textColor = palette.textPrimary
        closeButton.applyTheme(with: palette)

        view.subviews
            .filter { $0.identifier?.rawValue == "settingsSidebarDivider" }
            .forEach { $0.layer?.backgroundColor = palette.border.cgColor }

        view.subviews
            .lazy
            .flatMap(\.subviews)
            .filter { $0.identifier?.rawValue == "settingsHeaderDivider" }
            .forEach { $0.layer?.backgroundColor = palette.border.cgColor }

        updateSidebarSelection()
        currentDetailViewController?.applyTheme()
    }

    @objc private func sidebarButtonTapped(_ sender: NSButton) {
        guard SettingsSection.allCases.indices.contains(sender.tag) else { return }
        switchToSection(SettingsSection.allCases[sender.tag])
    }

    @objc private func closeSettings() {
        view.window?.performClose(nil)
    }
}

private final class SettingsModelViewController: NSViewController, ThemeApplicable {
    private let titleLabel = NSTextField(labelWithString: "Provider 配置")
    private let subtitleLabel = NSTextField(labelWithString: "管理 AI Provider 的 API 配置")
    private let addButton = NSButton(title: "新增", target: nil, action: nil)
    private let scrollView = NSScrollView()
    private let stackView = NSStackView()
    private let keychain = KeychainTokenStore()
    private var providerConfigs: [ProviderConfig] = []

    override func loadView() {
        let rootView = ThemeAwareView()
        rootView.wantsLayer = true
        rootView.onEffectiveAppearanceChange = { [weak self] in
            self?.applyTheme()
        }
        view = rootView
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        loadProviderConfigs()
        applyTheme()
    }

    private func setupUI() {
        titleLabel.font = .systemFont(ofSize: 17, weight: .semibold)
        subtitleLabel.font = .systemFont(ofSize: 13)
        addButton.bezelStyle = .regularSquare
        addButton.isBordered = false
        addButton.wantsLayer = true
        addButton.layer?.cornerRadius = 8
        addButton.target = self
        addButton.action = #selector(addProviderTapped)

        let headerStack = NSStackView(views: [titleLabel, subtitleLabel])
        headerStack.orientation = .vertical
        headerStack.alignment = .leading
        headerStack.spacing = 4
        headerStack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(headerStack)

        addButton.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(addButton)

        // 配置列表
        scrollView.drawsBackground = false
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scrollView)

        stackView.orientation = .vertical
        stackView.spacing = 12
        stackView.alignment = .leading
        stackView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.documentView = stackView

        NSLayoutConstraint.activate([
            headerStack.topAnchor.constraint(equalTo: view.topAnchor, constant: 24),
            headerStack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),

            addButton.topAnchor.constraint(equalTo: view.topAnchor, constant: 24),
            addButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
            addButton.widthAnchor.constraint(greaterThanOrEqualToConstant: 88),
            addButton.heightAnchor.constraint(equalToConstant: 36),

            scrollView.topAnchor.constraint(equalTo: headerStack.bottomAnchor, constant: 24),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -24),

            stackView.topAnchor.constraint(equalTo: scrollView.contentView.topAnchor),
            stackView.leadingAnchor.constraint(equalTo: scrollView.contentView.leadingAnchor),
            stackView.trailingAnchor.constraint(equalTo: scrollView.contentView.trailingAnchor),
            stackView.widthAnchor.constraint(equalTo: scrollView.widthAnchor)
        ])
    }

    private func loadProviderConfigs() {
        print("📋 [Settings] 开始加载 Provider 配置...")
        do {
            providerConfigs = try keychain.loadAllProviderConfigs()
            print("✅ [Settings] 成功加载 \(providerConfigs.count) 个 Provider 配置")
            for (index, config) in providerConfigs.enumerated() {
                print("   \(index + 1). \(config.name) - \(config.providerType.displayName)")
                print("      Base URL: \(config.baseURL)")
                print("      代理模式: \(config.isProxyMode ? "是" : "否")")
            }
            refreshProviderList()
        } catch {
            print("❌ [Settings] 加载 Provider 配置失败: \(error)")
            providerConfigs = []
        }
    }

    private func refreshProviderList() {
        stackView.arrangedSubviews.forEach { $0.removeFromSuperview() }

        if providerConfigs.isEmpty {
            let emptyLabel = NSTextField(labelWithString: "暂无配置，点击「新增」添加 Provider")
            emptyLabel.font = .systemFont(ofSize: 13)
            emptyLabel.textColor = .secondaryLabelColor
            emptyLabel.translatesAutoresizingMaskIntoConstraints = false
            stackView.addArrangedSubview(emptyLabel)
        } else {
            for config in providerConfigs {
                let card = ProviderConfigCard(config: config, delegate: self)
                card.translatesAutoresizingMaskIntoConstraints = false
                card.widthAnchor.constraint(equalTo: stackView.widthAnchor).isActive = true
                stackView.addArrangedSubview(card)
            }
        }
    }

    @objc private func addProviderTapped() {
        showProviderEditSheet(config: nil)
    }

    private func showProviderEditSheet(config: ProviderConfig?) {
        let sheet = ProviderEditSheet(config: config) { [weak self] newConfig in
            guard let self = self else { return }
            do {
                try self.keychain.saveProviderConfig(newConfig)
                self.loadProviderConfigs()
            } catch {
                self.showAlert("保存失败", message: error.localizedDescription)
            }
        }
        presentAsSheet(sheet)
    }

    private func showAlert(_ title: String, message: String) {
        let alert = NSAlert()
        alert.messageText = title
        alert.informativeText = message
        alert.alertStyle = .warning
        alert.addButton(withTitle: "确定")
        alert.runModal()
    }

    func applyTheme() {
        let palette = ThemeManager.shared.palette(for: view.effectiveAppearance)
        view.layer?.backgroundColor = palette.windowBackground.cgColor
        titleLabel.textColor = palette.textPrimary
        subtitleLabel.textColor = palette.textSecondary
        addButton.layer?.backgroundColor = palette.primary.cgColor
        addButton.contentTintColor = .white
    }
}

// MARK: - ProviderConfigCardDelegate

extension SettingsModelViewController: ProviderConfigCardDelegate {
    func didRequestEdit(_ config: ProviderConfig) {
        showProviderEditSheet(config: config)
    }

    func didRequestDelete(_ config: ProviderConfig) {
        let alert = NSAlert()
        alert.messageText = "删除 Provider"
        alert.informativeText = "确定要删除「\(config.name)」吗？"
        alert.alertStyle = .warning
        alert.addButton(withTitle: "删除")
        alert.addButton(withTitle: "取消")

        if alert.runModal() == .alertFirstButtonReturn {
            do {
                try keychain.deleteProviderConfig(id: config.id)
                loadProviderConfigs()
            } catch {
                showAlert("删除失败", message: error.localizedDescription)
            }
        }
    }
}

private final class SettingsThemeViewController: NSViewController, ThemeApplicable {
    private let titleLabel = NSTextField(labelWithString: "主题")
    private let subtitleLabel = NSTextField(labelWithString: "控制应用外观模式")
    private let sectionLabel = NSTextField(labelWithString: "主题样式")
    private let appearancePopUpButton = NSPopUpButton()
    private var themeObserver: NSObjectProtocol?

    override func loadView() {
        let rootView = ThemeAwareView()
        rootView.wantsLayer = true
        rootView.onEffectiveAppearanceChange = { [weak self] in
            self?.applyTheme()
        }
        view = rootView
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        titleLabel.font = .systemFont(ofSize: 17, weight: .semibold)
        subtitleLabel.font = .systemFont(ofSize: 13)
        sectionLabel.font = .systemFont(ofSize: 13, weight: .medium)
        appearancePopUpButton.addItems(withTitles: ConsoleAppearancePreference.allCases.map(\.label))
        appearancePopUpButton.target = self
        appearancePopUpButton.action = #selector(appearanceSelectionChanged)

        [titleLabel, subtitleLabel, sectionLabel, appearancePopUpButton].forEach {
            $0.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview($0)
        }

        NSLayoutConstraint.activate([
            titleLabel.topAnchor.constraint(equalTo: view.topAnchor, constant: 24),
            titleLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),

            subtitleLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 4),
            subtitleLabel.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),

            sectionLabel.topAnchor.constraint(equalTo: subtitleLabel.bottomAnchor, constant: 28),
            sectionLabel.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),

            appearancePopUpButton.topAnchor.constraint(equalTo: sectionLabel.bottomAnchor, constant: 10),
            appearancePopUpButton.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
            appearancePopUpButton.widthAnchor.constraint(equalToConstant: 240)
        ])

        loadAppearancePreference()
        themeObserver = NotificationCenter.default.addObserver(
            forName: ThemeManager.didChangeNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.loadAppearancePreference()
            self?.applyTheme()
        }
        applyTheme()
    }

    deinit {
        if let themeObserver {
            NotificationCenter.default.removeObserver(themeObserver)
        }
    }

    func applyTheme() {
        let palette = ThemeManager.shared.palette(for: view.effectiveAppearance)
        view.layer?.backgroundColor = palette.windowBackground.cgColor
        titleLabel.textColor = palette.textPrimary
        subtitleLabel.textColor = palette.textSecondary
        sectionLabel.textColor = palette.textSecondary
        appearancePopUpButton.contentTintColor = palette.textPrimary
    }

    private func loadAppearancePreference() {
        let preference = ThemeManager.shared.appearancePreference
        if let index = ConsoleAppearancePreference.allCases.firstIndex(of: preference) {
            appearancePopUpButton.selectItem(at: index)
        }
    }

    @objc private func appearanceSelectionChanged() {
        let index = appearancePopUpButton.indexOfSelectedItem
        guard ConsoleAppearancePreference.allCases.indices.contains(index) else { return }
        ThemeManager.shared.setAppearancePreference(ConsoleAppearancePreference.allCases[index])
    }
}

private final class SettingsAccountViewController: NSViewController, ThemeApplicable {
    private let titleLabel = NSTextField(labelWithString: "账号")
    private let subtitleLabel = NSTextField(labelWithString: "查看当前账号状态")
    private let levelLabel = NSTextField(labelWithString: "等级")
    private let levelBadge = NSTextField(labelWithString: "free")
    private let manageLabel = NSTextField(labelWithString: "管理")
    private let manageButton = NSButton(title: "管理", target: nil, action: nil)

    override func loadView() {
        let rootView = ThemeAwareView()
        rootView.wantsLayer = true
        rootView.onEffectiveAppearanceChange = { [weak self] in
            self?.applyTheme()
        }
        view = rootView
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        titleLabel.font = .systemFont(ofSize: 17, weight: .semibold)
        subtitleLabel.font = .systemFont(ofSize: 13)
        levelLabel.font = .systemFont(ofSize: 13, weight: .medium)
        manageLabel.font = .systemFont(ofSize: 13, weight: .medium)

        levelBadge.alignment = .center
        levelBadge.wantsLayer = true
        levelBadge.layer?.cornerRadius = 10
        levelBadge.translatesAutoresizingMaskIntoConstraints = false

        manageButton.isBordered = false
        manageButton.wantsLayer = true
        manageButton.layer?.cornerRadius = 8

        [titleLabel, subtitleLabel, levelLabel, levelBadge, manageLabel, manageButton].forEach {
            $0.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview($0)
        }

        NSLayoutConstraint.activate([
            titleLabel.topAnchor.constraint(equalTo: view.topAnchor, constant: 24),
            titleLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),

            subtitleLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 4),
            subtitleLabel.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),

            levelLabel.topAnchor.constraint(equalTo: subtitleLabel.bottomAnchor, constant: 28),
            levelLabel.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),

            levelBadge.topAnchor.constraint(equalTo: levelLabel.bottomAnchor, constant: 10),
            levelBadge.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
            levelBadge.widthAnchor.constraint(equalToConstant: 52),
            levelBadge.heightAnchor.constraint(equalToConstant: 24),

            manageLabel.topAnchor.constraint(equalTo: levelBadge.bottomAnchor, constant: 24),
            manageLabel.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),

            manageButton.topAnchor.constraint(equalTo: manageLabel.bottomAnchor, constant: 10),
            manageButton.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
            manageButton.widthAnchor.constraint(equalToConstant: 88),
            manageButton.heightAnchor.constraint(equalToConstant: 36)
        ])

        applyTheme()
    }

    func applyTheme() {
        let palette = ThemeManager.shared.palette(for: view.effectiveAppearance)
        view.layer?.backgroundColor = palette.windowBackground.cgColor
        titleLabel.textColor = palette.textPrimary
        subtitleLabel.textColor = palette.textSecondary
        levelLabel.textColor = palette.textSecondary
        manageLabel.textColor = palette.textSecondary
        levelBadge.textColor = palette.primary
        levelBadge.layer?.backgroundColor = palette.primary.withAlphaComponent(0.12).cgColor
        manageButton.layer?.backgroundColor = palette.elevatedBackground.cgColor
        manageButton.contentTintColor = palette.textPrimary
    }
}
