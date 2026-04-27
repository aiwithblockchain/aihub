import AppKit

final class DetailViewController: NSViewController {
    // TweetClaw
    private let clawVC = TweetClawClawViewController()

    // AIClaw - only Bot view (API docs)
    private let aiClawVC = AIClawBotViewController()

    private let placeholderLabel = NSTextField(labelWithString: "")
    private let instancesPanelView = InstancesPanelViewController()

    override func loadView() {
        view = NSView()
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        configureView()

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

        // 初始化文本
        updateText()
    }

    @objc private func handleLanguageChange() {
        updateText()
    }

    private func updateText() {
        placeholderLabel.stringValue = LanguageManager.shared.localized("detail.placeholder")
    }

    @objc private func handleThemeChange() {
        view.layer?.backgroundColor = DSV2.surface.cgColor
        view.needsDisplay = true
        view.subviews.forEach { $0.needsDisplay = true }
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    func display(conversation: Conversation) {
        placeholderLabel.isHidden = true

        clawVC.view.isHidden = conversation.type != .tweetclaw
        aiClawVC.view.isHidden = conversation.type != .aiclaw
        instancesPanelView.view.isHidden = conversation.type != .instances

        if conversation.type == .tweetclaw {
            clawVC.selectDefaultRow()
        }

        // Trigger refresh when showing instances panel
        if conversation.type == .instances {
            instancesPanelView.refresh()
        }
    }
}

private extension DetailViewController {
    func configureView() {
        view.wantsLayer = true
        view.layer?.backgroundColor = DSV2.surface.cgColor

        placeholderLabel.translatesAutoresizingMaskIntoConstraints = false
        placeholderLabel.font = DSV2.fontTitleMd
        placeholderLabel.textColor = DSV2.onSurfaceVariant.withAlphaComponent(0.5)
        view.addSubview(placeholderLabel)

        // TweetClaw (Directly use Claw view)
        addChild(clawVC)
        clawVC.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(clawVC.view)
        clawVC.view.isHidden = true

        // AIClaw - only Bot view (API docs)
        addChild(aiClawVC)
        aiClawVC.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(aiClawVC.view)
        aiClawVC.view.isHidden = true

        // Instances Panel
        addChild(instancesPanelView)
        instancesPanelView.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(instancesPanelView.view)
        instancesPanelView.view.isHidden = true

        NSLayoutConstraint.activate([
            placeholderLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            placeholderLabel.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            
            clawVC.view.topAnchor.constraint(equalTo: view.topAnchor),
            clawVC.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            clawVC.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            clawVC.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            aiClawVC.view.topAnchor.constraint(equalTo: view.topAnchor),
            aiClawVC.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            aiClawVC.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            aiClawVC.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            instancesPanelView.view.topAnchor.constraint(equalTo: view.topAnchor),
            instancesPanelView.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            instancesPanelView.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            instancesPanelView.view.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }
}
