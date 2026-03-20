import AppKit

final class DetailViewController: NSViewController {
    // TweetClaw tab view
    private let tweetClawTabView = NSTabView()
    private var tweetClawSegmentedControl: SegmentedControl!
    private let humanVC = TweetClawHumanViewController()
    private let clawVC = TweetClawClawViewController()

    // AIClaw tab view
    private let aiClawTabView = NSTabView()
    private var aiClawSegmentedControl: SegmentedControl!
    private let aiHumanVC = AIClawHumanViewController()
    private let aiClawVC = AIClawBotViewController()
    
    private let placeholderLabel = NSTextField(labelWithString: "选择左侧会话查看内容")
    private let instancesPanelView = InstancesPanelViewController()
    private let bridgeLogsVC = BridgeLogsViewController()

    override func loadView() {
        view = NSView()
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        configureView()
    }

    func display(conversation: Conversation) {
        if conversation.title == "TweetClaw" {
            placeholderLabel.isHidden = true
            tweetClawTabView.isHidden = false
            tweetClawSegmentedControl.isHidden = false
            aiClawTabView.isHidden = true
            aiClawSegmentedControl.isHidden = true
            instancesPanelView.view.isHidden = true
            bridgeLogsVC.view.isHidden = true
            
            // 如果切到 TweetClaw 时当前选中的是 For Claw 标签页，强制刷新一次详情显示
            if tweetClawSegmentedControl.indexOfSelectedItem() == 1 {
                clawVC.selectDefaultRow()
            }
        } else if conversation.title == "AIClaw" {
            placeholderLabel.isHidden = true
            tweetClawTabView.isHidden = true
            tweetClawSegmentedControl.isHidden = true
            aiClawTabView.isHidden = false
            aiClawSegmentedControl.isHidden = false
            instancesPanelView.view.isHidden = true
            bridgeLogsVC.view.isHidden = true
        } else if conversation.title == "已连接实例" {
            placeholderLabel.isHidden = true
            tweetClawTabView.isHidden = true
            tweetClawSegmentedControl.isHidden = true
            aiClawTabView.isHidden = true
            aiClawSegmentedControl.isHidden = true
            instancesPanelView.view.isHidden = false
            bridgeLogsVC.view.isHidden = true
            instancesPanelView.refresh()
        } else if conversation.title == "Bridge Logs" {
            placeholderLabel.isHidden = true
            tweetClawTabView.isHidden = true
            tweetClawSegmentedControl.isHidden = true
            aiClawTabView.isHidden = true
            aiClawSegmentedControl.isHidden = true
            instancesPanelView.view.isHidden = true
            bridgeLogsVC.view.isHidden = false
        } else {
            placeholderLabel.isHidden = false
            tweetClawTabView.isHidden = true
            tweetClawSegmentedControl.isHidden = true
            aiClawTabView.isHidden = true
            aiClawSegmentedControl.isHidden = true
            instancesPanelView.view.isHidden = true
            bridgeLogsVC.view.isHidden = true
            placeholderLabel.stringValue = "\(conversation.title): \(conversation.preview)"
        }
    }
}

private extension DetailViewController {
    func configureView() {
        view.wantsLayer = true
        view.layer?.backgroundColor = DSV2.surface.cgColor

        placeholderLabel.translatesAutoresizingMaskIntoConstraints = false
        placeholderLabel.font = DS.fontTitle
        placeholderLabel.textColor = DS.colorTextTertiary
        view.addSubview(placeholderLabel)

        // TweetClaw tabs
        tweetClawTabView.tabViewType = .noTabsNoBorder
        tweetClawTabView.translatesAutoresizingMaskIntoConstraints = false
        
        let humanItem = NSTabViewItem(viewController: humanVC)
        let clawItem = NSTabViewItem(viewController: clawVC)
        
        tweetClawTabView.addTabViewItem(humanItem)
        tweetClawTabView.addTabViewItem(clawItem)

        tweetClawSegmentedControl = DSV2.makeSegmentedControl(items: ["For Human", "For Claw"], target: self, action: #selector(tweetClawSegmentChanged(_:)))
        tweetClawSegmentedControl.translatesAutoresizingMaskIntoConstraints = false

        // Apply DSV2 styling with container
        tweetClawSegmentedControl.wantsLayer = true
        tweetClawSegmentedControl.layer?.backgroundColor = DSV2.surfaceContainerLow.cgColor
        tweetClawSegmentedControl.layer?.cornerRadius = DSV2.radiusButton
        tweetClawSegmentedControl.layer?.borderWidth = 1
        tweetClawSegmentedControl.layer?.borderColor = DSV2.outlineVariant.withAlphaComponent(0.2).cgColor
        
        view.addSubview(tweetClawTabView)
        view.addSubview(tweetClawSegmentedControl)
        tweetClawTabView.isHidden = true
        tweetClawSegmentedControl.isHidden = true
        
        // AIClaw tabs
        aiClawTabView.tabViewType = .noTabsNoBorder
        aiClawTabView.translatesAutoresizingMaskIntoConstraints = false
        
        let aiHumanItem = NSTabViewItem(viewController: aiHumanVC)
        let aiClawItem = NSTabViewItem(viewController: aiClawVC)
        
        aiClawTabView.addTabViewItem(aiHumanItem)
        aiClawTabView.addTabViewItem(aiClawItem)

        aiClawSegmentedControl = DSV2.makeSegmentedControl(items: ["For Human", "For Claw"], target: self, action: #selector(aiClawSegmentChanged(_:)))
        aiClawSegmentedControl.translatesAutoresizingMaskIntoConstraints = false

        // Apply DSV2 styling with container
        aiClawSegmentedControl.wantsLayer = true
        aiClawSegmentedControl.layer?.backgroundColor = DSV2.surfaceContainerLow.cgColor
        aiClawSegmentedControl.layer?.cornerRadius = DSV2.radiusButton
        aiClawSegmentedControl.layer?.borderWidth = 1
        aiClawSegmentedControl.layer?.borderColor = DSV2.outlineVariant.withAlphaComponent(0.2).cgColor
        
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
            
            tweetClawSegmentedControl.topAnchor.constraint(equalTo: view.topAnchor, constant: DS.spacingM),
            tweetClawSegmentedControl.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            
            tweetClawTabView.topAnchor.constraint(equalTo: tweetClawSegmentedControl.bottomAnchor, constant: DS.spacingS),
            tweetClawTabView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tweetClawTabView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tweetClawTabView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            
            aiClawSegmentedControl.topAnchor.constraint(equalTo: view.topAnchor, constant: DS.spacingM),
            aiClawSegmentedControl.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            
            aiClawTabView.topAnchor.constraint(equalTo: aiClawSegmentedControl.bottomAnchor, constant: DS.spacingS),
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
    
    @objc func tweetClawSegmentChanged(_ sender: SegmentedControl) {
        let index = sender.indexOfSelectedItem()
        tweetClawTabView.selectTabViewItem(at: index)
        
        // 当用户手动切换到 For Claw 时，强制同步第一行 API 卡片详情到右侧黑色背景显示区域
        if index == 1 {
            clawVC.selectDefaultRow()
        }
    }

    @objc func aiClawSegmentChanged(_ sender: SegmentedControl) {
        aiClawTabView.selectTabViewItem(at: sender.indexOfSelectedItem())
    }
}
