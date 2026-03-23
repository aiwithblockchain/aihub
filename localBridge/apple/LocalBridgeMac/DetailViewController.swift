import AppKit

final class DetailViewController: NSViewController {
    // TweetClaw
    private let clawVC = TweetClawClawViewController()

    // AIClaw tab view
    private let aiClawTabView = NSTabView()
    private var aiClawSegmentedControl: SegmentedControl!
    private let aiHumanVC = AIClawHumanViewController()
    private let aiClawVC = AIClawBotViewController()
    
    private let placeholderLabel = NSTextField(labelWithString: "选择左侧列表项查看内容")
    private let instancesPanelView = InstancesPanelViewController()
    private let bridgeLogsVC = BridgeLogsViewController()

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
        clawVC.view.isHidden = conversation.title != "TweetClaw"
        aiClawTabView.isHidden = conversation.title != "AIClaw"
        aiClawSegmentedControl.isHidden = conversation.title != "AIClaw"
        instancesPanelView.view.isHidden = conversation.title != "已连接实例"
        bridgeLogsVC.view.isHidden = conversation.title != "Bridge Logs"
        
        if conversation.title == "TweetClaw" {
            clawVC.selectDefaultRow()
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

        // AIClaw tabs
        let aiHumanItem = NSTabViewItem(viewController: aiHumanVC)
        let aiClawItem = NSTabViewItem(viewController: aiClawVC)
        aiClawTabView.addTabViewItem(aiHumanItem)
        aiClawTabView.addTabViewItem(aiClawItem)
        aiClawTabView.tabViewType = .noTabsNoBorder // 隐藏默认标签，解决类名显示问题
        aiClawTabView.translatesAutoresizingMaskIntoConstraints = false
        
        aiClawSegmentedControl = SegmentedControl(items: ["For Human", "For Claw"], target: self, action: #selector(aiClawSegmentChanged))
        aiClawSegmentedControl.translatesAutoresizingMaskIntoConstraints = false
        
        view.addSubview(aiClawTabView)
        view.addSubview(aiClawSegmentedControl)
        aiClawTabView.isHidden = true
        aiClawSegmentedControl.isHidden = true

        // Instances Panel
        addChild(instancesPanelView)
        instancesPanelView.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(instancesPanelView.view)
        instancesPanelView.view.isHidden = true

        // Bridge Logs
        addChild(bridgeLogsVC)
        bridgeLogsVC.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(bridgeLogsVC.view)
        bridgeLogsVC.view.isHidden = true

        NSLayoutConstraint.activate([
            placeholderLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            placeholderLabel.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            
            clawVC.view.topAnchor.constraint(equalTo: view.topAnchor),
            clawVC.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            clawVC.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            clawVC.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            
            aiClawSegmentedControl.topAnchor.constraint(equalTo: view.topAnchor, constant: DSV2.spacing6),
            aiClawSegmentedControl.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            
            aiClawTabView.topAnchor.constraint(equalTo: aiClawSegmentedControl.bottomAnchor, constant: DSV2.spacing4),
            aiClawTabView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            aiClawTabView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            aiClawTabView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            instancesPanelView.view.topAnchor.constraint(equalTo: view.topAnchor),
            instancesPanelView.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            instancesPanelView.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            instancesPanelView.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            bridgeLogsVC.view.topAnchor.constraint(equalTo: view.topAnchor),
            bridgeLogsVC.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            bridgeLogsVC.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            bridgeLogsVC.view.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }

    @objc func aiClawSegmentChanged(_ sender: SegmentedControl) {
        aiClawTabView.selectTabViewItem(at: sender.indexOfSelectedItem())
    }
}
