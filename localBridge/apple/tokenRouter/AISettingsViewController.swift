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

final class AISettingsViewController: NSViewController {
    private let titleLabel = NSTextField(labelWithString: "设置")
    private let closeButton = NSButton()
    private let sidebarView = NSView()
    private let detailContainer = NSView()
    private var sidebarButtons: [SettingsSection: NSButton] = [:]
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

        closeButton.image = NSImage(systemSymbolName: "xmark", accessibilityDescription: "关闭")
        closeButton.isBordered = false
        closeButton.target = self
        closeButton.action = #selector(closeSettings)
        closeButton.wantsLayer = true
        closeButton.layer?.cornerRadius = 6
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
            let button = NSButton(title: section.title, target: self, action: #selector(sidebarButtonTapped(_:)))
            button.tag = SettingsSection.allCases.firstIndex(of: section) ?? 0
            button.isBordered = false
            button.alignment = .left
            button.font = .systemFont(ofSize: 14)
            button.wantsLayer = true
            button.layer?.cornerRadius = 8
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
            button.font = .systemFont(ofSize: 14, weight: isSelected ? .medium : .regular)
            button.contentTintColor = isSelected ? palette.textPrimary : palette.textTertiary
            button.layer?.backgroundColor = isSelected ? palette.elevatedBackground.cgColor : NSColor.clear.cgColor
        }
    }

    func applyTheme() {
        let palette = ThemeManager.shared.palette(for: view.effectiveAppearance)
        view.layer?.backgroundColor = palette.windowBackground.cgColor
        sidebarView.layer?.backgroundColor = palette.sidebarBackground.cgColor
        detailContainer.layer?.backgroundColor = palette.windowBackground.cgColor
        titleLabel.textColor = palette.textPrimary
        closeButton.contentTintColor = palette.textSecondary
        closeButton.layer?.backgroundColor = NSColor.clear.cgColor

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
    private let titleLabel = NSTextField(labelWithString: "Models")
    private let subtitleLabel = NSTextField(labelWithString: "管理您的模型配置")
    private let addButton = NSButton(title: "新增", target: nil, action: nil)

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
        addButton.bezelStyle = .regularSquare
        addButton.isBordered = false
        addButton.wantsLayer = true
        addButton.layer?.cornerRadius = 8

        let headerStack = NSStackView(views: [titleLabel, subtitleLabel])
        headerStack.orientation = .vertical
        headerStack.alignment = .leading
        headerStack.spacing = 4
        headerStack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(headerStack)

        addButton.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(addButton)

        NSLayoutConstraint.activate([
            headerStack.topAnchor.constraint(equalTo: view.topAnchor, constant: 24),
            headerStack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),

            addButton.topAnchor.constraint(equalTo: view.topAnchor, constant: 24),
            addButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
            addButton.widthAnchor.constraint(greaterThanOrEqualToConstant: 88),
            addButton.heightAnchor.constraint(equalToConstant: 36)
        ])

        applyTheme()
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
