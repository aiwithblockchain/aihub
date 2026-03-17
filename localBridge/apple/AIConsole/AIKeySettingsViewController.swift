import AppKit

final class AIKeySettingsViewController: NSViewController {
    private let titleLabel = NSTextField(labelWithString: "控制台设置")
    
    // API Key Management UI
    private let apiKeyTitleLabel = NSTextField(labelWithString: "AI API Key 管理")
    private let anthropicKeyLabel = NSTextField(labelWithString: "Anthropic API Key:")
    private let anthropicKeyField = NSSecureTextField()
    private let openaiKeyLabel = NSTextField(labelWithString: "OpenAI API Key:")
    private let openaiKeyField = NSSecureTextField()
    private let geminiKeyLabel = NSTextField(labelWithString: "Gemini API Key:")
    private let geminiKeyField = NSSecureTextField()
    
    private let saveButton = NSButton(title: "保存设置", target: nil, action: #selector(saveClicked))
    private let closeButton = NSButton(title: "关闭", target: nil, action: #selector(closeClicked))

    override func loadView() {
        let view = NSView(frame: NSRect(x: 0, y: 0, width: 450, height: 350))
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor.consoleZ900.cgColor
        self.view = view
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        loadAPIKeys()
    }

    private func setupUI() {
        titleLabel.font = .systemFont(ofSize: 20, weight: .bold)
        titleLabel.textColor = .consoleText
        titleLabel.isEditable = false
        titleLabel.isBordered = false
        titleLabel.drawsBackground = false
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        
        apiKeyTitleLabel.font = .systemFont(ofSize: 16, weight: .semibold)
        apiKeyTitleLabel.textColor = .consoleText2
        apiKeyTitleLabel.isEditable = false
        apiKeyTitleLabel.isBordered = false
        apiKeyTitleLabel.drawsBackground = false
        apiKeyTitleLabel.translatesAutoresizingMaskIntoConstraints = false

        let stack = NSStackView(views: [titleLabel, apiKeyTitleLabel])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 20
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)

        func addRow(label: NSTextField, field: NSSecureTextField) {
            label.textColor = .consoleText3
            label.isEditable = false
            label.isBordered = false
            label.drawsBackground = false
            let row = NSStackView(views: [label, field])
            row.orientation = .horizontal
            row.alignment = .centerY
            field.widthAnchor.constraint(equalToConstant: 240).isActive = true
            stack.addArrangedSubview(row)
        }

        addRow(label: anthropicKeyLabel, field: anthropicKeyField)
        addRow(label: openaiKeyLabel, field: openaiKeyField)
        addRow(label: geminiKeyLabel, field: geminiKeyField)

        let footerGap = NSView()
        footerGap.heightAnchor.constraint(equalToConstant: 10).isActive = true
        stack.addArrangedSubview(footerGap)

        saveButton.bezelStyle = .rounded
        closeButton.bezelStyle = .rounded
        let buttonStack = NSStackView(views: [saveButton, closeButton])
        buttonStack.spacing = 12
        stack.addArrangedSubview(buttonStack)

        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: view.topAnchor, constant: 30),
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 30),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -30)
        ])
    }

    private func loadAPIKeys() {
        let keychain = KeychainTokenStore()
        anthropicKeyField.placeholderString = (try? keychain.load(key: KeychainTokenStore.anthropicAPIKey)) != nil ? "••••••••" : "Anthropic key"
        openaiKeyField.placeholderString = (try? keychain.load(key: KeychainTokenStore.openAIAPIKey)) != nil ? "••••••••" : "OpenAI key"
        geminiKeyField.placeholderString = (try? keychain.load(key: KeychainTokenStore.geminiAPIKey)) != nil ? "••••••••" : "Gemini key"
    }

    @objc private func saveClicked() {
        let keychain = KeychainTokenStore()
        let a = anthropicKeyField.stringValue
        let o = openaiKeyField.stringValue
        let g = geminiKeyField.stringValue
        
        var saved = false
        if !a.isEmpty && a != "••••••••" { try? keychain.save(key: KeychainTokenStore.anthropicAPIKey, value: a); saved = true }
        if !o.isEmpty && o != "••••••••" { try? keychain.save(key: KeychainTokenStore.openAIAPIKey, value: o); saved = true }
        if !g.isEmpty && g != "••••••••" { try? keychain.save(key: KeychainTokenStore.geminiAPIKey, value: g); saved = true }
        
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
