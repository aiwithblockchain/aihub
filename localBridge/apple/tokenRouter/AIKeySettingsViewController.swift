import AppKit

final class AIKeySettingsViewController: NSViewController {
    private let titleLabel = NSTextField(labelWithString: "控制台设置")
    private let appearanceTitleLabel = NSTextField(labelWithString: "外观")
    private let appearanceLabel = NSTextField(labelWithString: "主题样式:")
    private let appearancePopUpButton = NSPopUpButton()

    private let apiKeyTitleLabel = NSTextField(labelWithString: "AI API Key 管理")
    private let anthropicKeyLabel = NSTextField(labelWithString: "Anthropic API Key:")
    private let anthropicKeyField = NSSecureTextField()
    private let openaiKeyLabel = NSTextField(labelWithString: "OpenAI API Key:")
    private let openaiKeyField = NSSecureTextField()
    private let geminiKeyLabel = NSTextField(labelWithString: "Gemini API Key:")
    private let geminiKeyField = NSSecureTextField()

    private let saveButton = NSButton(title: "保存设置", target: nil, action: #selector(saveClicked))
    private let closeButton = NSButton(title: "关闭", target: nil, action: #selector(closeClicked))
    private var themeObserver: NSObjectProtocol?

    override func loadView() {
        let rootView = ThemeAwareView(frame: NSRect(x: 0, y: 0, width: 450, height: 400))
        rootView.wantsLayer = true
        rootView.onEffectiveAppearanceChange = { [weak self] in
            self?.applyTheme()
        }
        view = rootView
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        loadAPIKeys()
        loadAppearancePreference()
        applyTheme()
        themeObserver = NotificationCenter.default.addObserver(
            forName: ThemeManager.didChangeNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.loadAppearancePreference()
            self?.applyTheme()
        }
    }

    deinit {
        if let themeObserver {
            NotificationCenter.default.removeObserver(themeObserver)
        }
    }

    private func setupUI() {
        titleLabel.font = .systemFont(ofSize: 20, weight: .bold)
        titleLabel.isEditable = false
        titleLabel.isBordered = false
        titleLabel.drawsBackground = false
        titleLabel.translatesAutoresizingMaskIntoConstraints = false

        appearanceTitleLabel.font = .systemFont(ofSize: 16, weight: .semibold)
        appearanceTitleLabel.isEditable = false
        appearanceTitleLabel.isBordered = false
        appearanceTitleLabel.drawsBackground = false
        appearanceTitleLabel.translatesAutoresizingMaskIntoConstraints = false

        appearanceLabel.isEditable = false
        appearanceLabel.isBordered = false
        appearanceLabel.drawsBackground = false

        appearancePopUpButton.translatesAutoresizingMaskIntoConstraints = false
        appearancePopUpButton.target = self
        appearancePopUpButton.action = #selector(appearanceSelectionChanged)
        appearancePopUpButton.addItems(withTitles: ConsoleAppearancePreference.allCases.map(\.label))
        appearancePopUpButton.widthAnchor.constraint(equalToConstant: 240).isActive = true

        apiKeyTitleLabel.font = .systemFont(ofSize: 16, weight: .semibold)
        apiKeyTitleLabel.isEditable = false
        apiKeyTitleLabel.isBordered = false
        apiKeyTitleLabel.drawsBackground = false
        apiKeyTitleLabel.translatesAutoresizingMaskIntoConstraints = false

        let stack = NSStackView()
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 18
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)

        stack.addArrangedSubview(titleLabel)
        stack.addArrangedSubview(appearanceTitleLabel)

        let appearanceRow = NSStackView(views: [appearanceLabel, appearancePopUpButton])
        appearanceRow.orientation = .horizontal
        appearanceRow.alignment = .centerY
        appearanceRow.spacing = 12
        stack.addArrangedSubview(appearanceRow)

        let sectionGap = NSView()
        sectionGap.heightAnchor.constraint(equalToConstant: 6).isActive = true
        stack.addArrangedSubview(sectionGap)
        stack.addArrangedSubview(apiKeyTitleLabel)

        addRow(label: anthropicKeyLabel, field: anthropicKeyField, to: stack)
        addRow(label: openaiKeyLabel, field: openaiKeyField, to: stack)
        addRow(label: geminiKeyLabel, field: geminiKeyField, to: stack)

        let footerGap = NSView()
        footerGap.heightAnchor.constraint(equalToConstant: 8).isActive = true
        stack.addArrangedSubview(footerGap)

        saveButton.target = self
        closeButton.target = self
        let buttonStack = NSStackView(views: [saveButton, closeButton])
        buttonStack.spacing = 12
        stack.addArrangedSubview(buttonStack)

        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: view.topAnchor, constant: 30),
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 30),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -30)
        ])
    }

    private func addRow(label: NSTextField, field: NSSecureTextField, to stack: NSStackView) {
        label.isEditable = false
        label.isBordered = false
        label.drawsBackground = false

        field.isBordered = false
        field.focusRingType = .none
        field.wantsLayer = true
        field.layer?.cornerRadius = 6

        let row = NSStackView(views: [label, field])
        row.orientation = .horizontal
        row.alignment = .centerY
        row.spacing = 12
        field.widthAnchor.constraint(equalToConstant: 240).isActive = true
        stack.addArrangedSubview(row)
    }

    private func loadAPIKeys() {
        let keychain = KeychainTokenStore()
        anthropicKeyField.placeholderString = (try? keychain.load(key: KeychainTokenStore.anthropicAPIKey)) != nil ? "••••••••" : "Anthropic key"
        openaiKeyField.placeholderString = (try? keychain.load(key: KeychainTokenStore.openAIAPIKey)) != nil ? "••••••••" : "OpenAI key"
        geminiKeyField.placeholderString = (try? keychain.load(key: KeychainTokenStore.geminiAPIKey)) != nil ? "••••••••" : "Gemini key"
    }

    private func loadAppearancePreference() {
        let preference = ThemeManager.shared.appearancePreference
        if let index = ConsoleAppearancePreference.allCases.firstIndex(of: preference) {
            appearancePopUpButton.selectItem(at: index)
        }
    }

    private func applyTheme() {
        let palette = ThemeManager.shared.palette(for: view.effectiveAppearance)
        view.layer?.backgroundColor = palette.panelBackground.cgColor

        titleLabel.textColor = palette.textPrimary
        appearanceTitleLabel.textColor = palette.textSecondary
        appearanceLabel.textColor = palette.textTertiary
        apiKeyTitleLabel.textColor = palette.textSecondary

        [anthropicKeyLabel, openaiKeyLabel, geminiKeyLabel].forEach {
            $0.textColor = palette.textTertiary
        }

        [anthropicKeyField, openaiKeyField, geminiKeyField].forEach {
            $0.textColor = palette.textPrimary
            $0.layer?.backgroundColor = palette.inputBackground.cgColor
        }

        appearancePopUpButton.contentTintColor = palette.textPrimary

        saveButton.wantsLayer = true
        saveButton.isBordered = false
        saveButton.layer?.cornerRadius = 6
        saveButton.layer?.backgroundColor = palette.primary.cgColor
        saveButton.contentTintColor = .white

        closeButton.wantsLayer = true
        closeButton.isBordered = false
        closeButton.layer?.cornerRadius = 6
        closeButton.layer?.backgroundColor = palette.elevatedBackground.cgColor
        closeButton.contentTintColor = palette.textPrimary
    }

    @objc private func appearanceSelectionChanged() {
        let index = appearancePopUpButton.indexOfSelectedItem
        guard ConsoleAppearancePreference.allCases.indices.contains(index) else { return }
        ThemeManager.shared.setAppearancePreference(ConsoleAppearancePreference.allCases[index])
    }

    @objc private func saveClicked() {
        let keychain = KeychainTokenStore()
        let anthropicKey = anthropicKeyField.stringValue
        let openAIKey = openaiKeyField.stringValue
        let geminiKey = geminiKeyField.stringValue

        var saved = false
        if !anthropicKey.isEmpty && anthropicKey != "••••••••" {
            try? keychain.save(key: KeychainTokenStore.anthropicAPIKey, value: anthropicKey)
            saved = true
        }
        if !openAIKey.isEmpty && openAIKey != "••••••••" {
            try? keychain.save(key: KeychainTokenStore.openAIAPIKey, value: openAIKey)
            saved = true
        }
        if !geminiKey.isEmpty && geminiKey != "••••••••" {
            try? keychain.save(key: KeychainTokenStore.geminiAPIKey, value: geminiKey)
            saved = true
        }

        if saved {
            loadAPIKeys()
            anthropicKeyField.stringValue = ""
            openaiKeyField.stringValue = ""
            geminiKeyField.stringValue = ""

            let alert = NSAlert()
            alert.messageText = "保存成功"
            alert.informativeText = "API Key 已安全保存至系统 Keychain。"
            alert.runModal()
        }
    }

    @objc private func closeClicked() {
        dismiss(nil)
    }
}
