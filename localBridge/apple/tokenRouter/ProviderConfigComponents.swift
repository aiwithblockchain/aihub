import AppKit

// MARK: - ProviderConfigCard Delegate

protocol ProviderConfigCardDelegate: AnyObject {
    func didRequestEdit(_ config: ProviderConfig)
    func didRequestDelete(_ config: ProviderConfig)
}

// MARK: - ProviderConfigCard

final class ProviderConfigCard: NSView {
    private let config: ProviderConfig
    private weak var delegate: ProviderConfigCardDelegate?

    private let nameLabel = NSTextField(labelWithString: "")
    private let typeLabel = NSTextField(labelWithString: "")
    private let urlLabel = NSTextField(labelWithString: "")
    private let statusBadge = NSTextField(labelWithString: "")
    private let editButton = NSButton()
    private let deleteButton = NSButton()

    init(config: ProviderConfig, delegate: ProviderConfigCardDelegate?) {
        self.config = config
        self.delegate = delegate
        super.init(frame: .zero)
        setupUI()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func setupUI() {
        wantsLayer = true
        layer?.cornerRadius = 8
        layer?.borderWidth = 1

        nameLabel.stringValue = config.name
        nameLabel.font = .systemFont(ofSize: 14, weight: .semibold)
        nameLabel.translatesAutoresizingMaskIntoConstraints = false
        addSubview(nameLabel)

        typeLabel.stringValue = config.providerType.displayName
        typeLabel.font = .systemFont(ofSize: 12)
        typeLabel.translatesAutoresizingMaskIntoConstraints = false
        addSubview(typeLabel)

        urlLabel.stringValue = config.baseURL
        urlLabel.font = .systemFont(ofSize: 11)
        urlLabel.lineBreakMode = .byTruncatingMiddle
        urlLabel.translatesAutoresizingMaskIntoConstraints = false
        addSubview(urlLabel)

        statusBadge.stringValue = config.isProxyMode ? "代理" : "直连"
        statusBadge.font = .systemFont(ofSize: 10, weight: .medium)
        statusBadge.alignment = .center
        statusBadge.wantsLayer = true
        statusBadge.layer?.cornerRadius = 8
        statusBadge.translatesAutoresizingMaskIntoConstraints = false
        addSubview(statusBadge)

        editButton.image = NSImage(systemSymbolName: "pencil", accessibilityDescription: "编辑")
        editButton.isBordered = false
        editButton.target = self
        editButton.action = #selector(editTapped)
        editButton.translatesAutoresizingMaskIntoConstraints = false
        addSubview(editButton)

        deleteButton.image = NSImage(systemSymbolName: "trash", accessibilityDescription: "删除")
        deleteButton.isBordered = false
        deleteButton.target = self
        deleteButton.action = #selector(deleteTapped)
        deleteButton.translatesAutoresizingMaskIntoConstraints = false
        addSubview(deleteButton)

        NSLayoutConstraint.activate([
            heightAnchor.constraint(equalToConstant: 80),

            nameLabel.topAnchor.constraint(equalTo: topAnchor, constant: 12),
            nameLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),

            statusBadge.centerYAnchor.constraint(equalTo: nameLabel.centerYAnchor),
            statusBadge.leadingAnchor.constraint(equalTo: nameLabel.trailingAnchor, constant: 8),
            statusBadge.widthAnchor.constraint(equalToConstant: 44),
            statusBadge.heightAnchor.constraint(equalToConstant: 18),

            typeLabel.topAnchor.constraint(equalTo: nameLabel.bottomAnchor, constant: 4),
            typeLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),

            urlLabel.topAnchor.constraint(equalTo: typeLabel.bottomAnchor, constant: 4),
            urlLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            urlLabel.trailingAnchor.constraint(lessThanOrEqualTo: editButton.leadingAnchor, constant: -8),

            deleteButton.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
            deleteButton.centerYAnchor.constraint(equalTo: centerYAnchor),
            deleteButton.widthAnchor.constraint(equalToConstant: 24),
            deleteButton.heightAnchor.constraint(equalToConstant: 24),

            editButton.trailingAnchor.constraint(equalTo: deleteButton.leadingAnchor, constant: -8),
            editButton.centerYAnchor.constraint(equalTo: centerYAnchor),
            editButton.widthAnchor.constraint(equalToConstant: 24),
            editButton.heightAnchor.constraint(equalToConstant: 24)
        ])

        applyTheme()
    }

    private func applyTheme() {
        let palette = ThemeManager.shared.palette(for: effectiveAppearance)
        layer?.backgroundColor = palette.elevatedBackground.cgColor
        layer?.borderColor = palette.border.cgColor
        nameLabel.textColor = palette.textPrimary
        typeLabel.textColor = palette.textSecondary
        urlLabel.textColor = palette.textTertiary
        statusBadge.textColor = config.isProxyMode ? palette.primary : .systemGreen
        statusBadge.layer?.backgroundColor = (config.isProxyMode ? palette.primary : .systemGreen).withAlphaComponent(0.15).cgColor
        editButton.contentTintColor = palette.textSecondary
        deleteButton.contentTintColor = .systemRed
    }

    @objc private func editTapped() {
        delegate?.didRequestEdit(config)
    }

    @objc private func deleteTapped() {
        delegate?.didRequestDelete(config)
    }
}

// MARK: - ProviderEditSheet

final class ProviderEditSheet: NSViewController {
    private let config: ProviderConfig?
    private let onSave: (ProviderConfig) -> Void

    private let titleLabel = NSTextField(labelWithString: "")
    private let nameField = NSTextField()
    private let typePopup = NSPopUpButton()
    private let baseURLField = NSTextField()
    private let apiKeyField = NSSecureTextField()
    private let modelField = NSTextField()
    private let saveButton = NSButton(title: "保存", target: nil, action: nil)
    private let cancelButton = NSButton(title: "取消", target: nil, action: nil)

    init(config: ProviderConfig?, onSave: @escaping (ProviderConfig) -> Void) {
        self.config = config
        self.onSave = onSave
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func loadView() {
        view = NSView(frame: NSRect(x: 0, y: 0, width: 500, height: 400))
        view.wantsLayer = true
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        loadConfig()
    }

    private func setupUI() {
        titleLabel.stringValue = config == nil ? "新增 Provider" : "编辑 Provider"
        titleLabel.font = .systemFont(ofSize: 16, weight: .semibold)
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(titleLabel)

        let nameLabel = NSTextField(labelWithString: "名称:")
        nameLabel.font = .systemFont(ofSize: 13)
        nameLabel.alignment = .right
        nameLabel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(nameLabel)

        nameField.placeholderString = "例如: Claude (直连)"
        nameField.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(nameField)

        let typeLabel = NSTextField(labelWithString: "类型:")
        typeLabel.font = .systemFont(ofSize: 13)
        typeLabel.alignment = .right
        typeLabel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(typeLabel)

        typePopup.addItems(withTitles: ProviderType.allCases.map { $0.displayName })
        typePopup.target = self
        typePopup.action = #selector(typeChanged)
        typePopup.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(typePopup)

        let urlLabel = NSTextField(labelWithString: "Base URL:")
        urlLabel.font = .systemFont(ofSize: 13)
        urlLabel.alignment = .right
        urlLabel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(urlLabel)

        baseURLField.placeholderString = "https://api.anthropic.com/v1"
        baseURLField.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(baseURLField)

        let keyLabel = NSTextField(labelWithString: "API Key:")
        keyLabel.font = .systemFont(ofSize: 13)
        keyLabel.alignment = .right
        keyLabel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(keyLabel)

        apiKeyField.placeholderString = "sk-ant-xxxxx"
        apiKeyField.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(apiKeyField)

        let modelLabel = NSTextField(labelWithString: "模型:")
        modelLabel.font = .systemFont(ofSize: 13)
        modelLabel.alignment = .right
        modelLabel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(modelLabel)

        modelField.placeholderString = "claude-sonnet-4-20250514"
        modelField.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(modelField)

        saveButton.target = self
        saveButton.action = #selector(saveTapped)
        saveButton.keyEquivalent = "\r"
        saveButton.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(saveButton)

        cancelButton.target = self
        cancelButton.action = #selector(cancelTapped)
        cancelButton.keyEquivalent = "\u{1b}"
        cancelButton.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(cancelButton)

        NSLayoutConstraint.activate([
            titleLabel.topAnchor.constraint(equalTo: view.topAnchor, constant: 20),
            titleLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),

            nameLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 24),
            nameLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            nameLabel.widthAnchor.constraint(equalToConstant: 80),

            nameField.centerYAnchor.constraint(equalTo: nameLabel.centerYAnchor),
            nameField.leadingAnchor.constraint(equalTo: nameLabel.trailingAnchor, constant: 12),
            nameField.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),

            typeLabel.topAnchor.constraint(equalTo: nameLabel.bottomAnchor, constant: 16),
            typeLabel.leadingAnchor.constraint(equalTo: nameLabel.leadingAnchor),
            typeLabel.widthAnchor.constraint(equalTo: nameLabel.widthAnchor),

            typePopup.centerYAnchor.constraint(equalTo: typeLabel.centerYAnchor),
            typePopup.leadingAnchor.constraint(equalTo: nameField.leadingAnchor),
            typePopup.widthAnchor.constraint(equalToConstant: 200),

            urlLabel.topAnchor.constraint(equalTo: typeLabel.bottomAnchor, constant: 16),
            urlLabel.leadingAnchor.constraint(equalTo: nameLabel.leadingAnchor),
            urlLabel.widthAnchor.constraint(equalTo: nameLabel.widthAnchor),

            baseURLField.centerYAnchor.constraint(equalTo: urlLabel.centerYAnchor),
            baseURLField.leadingAnchor.constraint(equalTo: nameField.leadingAnchor),
            baseURLField.trailingAnchor.constraint(equalTo: nameField.trailingAnchor),

            keyLabel.topAnchor.constraint(equalTo: urlLabel.bottomAnchor, constant: 16),
            keyLabel.leadingAnchor.constraint(equalTo: nameLabel.leadingAnchor),
            keyLabel.widthAnchor.constraint(equalTo: nameLabel.widthAnchor),

            apiKeyField.centerYAnchor.constraint(equalTo: keyLabel.centerYAnchor),
            apiKeyField.leadingAnchor.constraint(equalTo: nameField.leadingAnchor),
            apiKeyField.trailingAnchor.constraint(equalTo: nameField.trailingAnchor),

            modelLabel.topAnchor.constraint(equalTo: keyLabel.bottomAnchor, constant: 16),
            modelLabel.leadingAnchor.constraint(equalTo: nameLabel.leadingAnchor),
            modelLabel.widthAnchor.constraint(equalTo: nameLabel.widthAnchor),

            modelField.centerYAnchor.constraint(equalTo: modelLabel.centerYAnchor),
            modelField.leadingAnchor.constraint(equalTo: nameField.leadingAnchor),
            modelField.trailingAnchor.constraint(equalTo: nameField.trailingAnchor),

            cancelButton.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -20),
            cancelButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            cancelButton.widthAnchor.constraint(equalToConstant: 80),

            saveButton.centerYAnchor.constraint(equalTo: cancelButton.centerYAnchor),
            saveButton.trailingAnchor.constraint(equalTo: cancelButton.leadingAnchor, constant: -12),
            saveButton.widthAnchor.constraint(equalToConstant: 80)
        ])
    }

    private func loadConfig() {
        if let config = config {
            nameField.stringValue = config.name
            if let index = ProviderType.allCases.firstIndex(of: config.providerType) {
                typePopup.selectItem(at: index)
            }
            baseURLField.stringValue = config.baseURL
            apiKeyField.stringValue = config.apiKey
            modelField.stringValue = config.model ?? ""
        } else {
            typeChanged()
        }
    }

    @objc private func typeChanged() {
        let selectedIndex = typePopup.indexOfSelectedItem
        guard ProviderType.allCases.indices.contains(selectedIndex) else { return }
        let type = ProviderType.allCases[selectedIndex]

        // 切换类型时总是更新为该类型的默认值
        baseURLField.stringValue = type.defaultBaseURL
        baseURLField.placeholderString = type.defaultBaseURL

        modelField.stringValue = type.defaultModel ?? ""
        modelField.placeholderString = type.defaultModel ?? "留空使用默认模型"

        print("🔄 [EditSheet] 类型切换为: \(type.displayName)")
        print("   默认 Base URL: \(type.defaultBaseURL)")
        print("   默认模型: \(type.defaultModel ?? "无")")
    }

    @objc private func saveTapped() {
        print("💾 [EditSheet] 保存按钮被点击")
        let name = nameField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        let baseURL = baseURLField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        let apiKey = apiKeyField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        let model = modelField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)

        print("   名称: \(name)")
        print("   Base URL: \(baseURL)")
        print("   API Key: \(apiKey.prefix(10))...")
        print("   模型: \(model)")

        guard !name.isEmpty else {
            print("❌ [EditSheet] 验证失败: 名称为空")
            showAlert("名称不能为空")
            return
        }
        guard !baseURL.isEmpty else {
            print("❌ [EditSheet] 验证失败: Base URL 为空")
            showAlert("Base URL 不能为空")
            return
        }
        guard !apiKey.isEmpty else {
            print("❌ [EditSheet] 验证失败: API Key 为空")
            showAlert("API Key 不能为空")
            return
        }

        let selectedIndex = typePopup.indexOfSelectedItem
        let type = ProviderType.allCases[selectedIndex]
        print("   类型: \(type.displayName)")

        let newConfig: ProviderConfig
        if let existingConfig = config {
            print("   模式: 更新现有配置")
            newConfig = existingConfig.updated(
                name: name,
                baseURL: baseURL,
                apiKey: apiKey,
                model: model.isEmpty ? nil : model
            )
        } else {
            print("   模式: 创建新配置")
            newConfig = ProviderConfig(
                name: name,
                baseURL: baseURL,
                apiKey: apiKey,
                model: model.isEmpty ? nil : model,
                providerType: type
            )
        }

        print("✅ [EditSheet] 配置创建成功，调用保存回调")
        onSave(newConfig)
        dismiss(nil)
    }

    @objc private func cancelTapped() {
        dismiss(nil)
    }

    private func showAlert(_ message: String) {
        let alert = NSAlert()
        alert.messageText = "输入错误"
        alert.informativeText = message
        alert.alertStyle = .warning
        alert.addButton(withTitle: "确定")
        alert.runModal()
    }
}
