import AppKit

final class DetailViewController: NSViewController {
    // TweetClaw tab view
    private let tweetClawTabView = NSTabView()
    private let humanVC = TweetClawHumanViewController()
    private let botVC = TweetClawBotViewController()
    
    // AIClaw tab view
    private let aiClawTabView = NSTabView()
    private let aiHumanVC = AIClawHumanViewController()
    private let aiBotVC = AIClawBotViewController()
    
    private let placeholderLabel = NSTextField(labelWithString: "选择左侧会话查看内容")

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
            aiClawTabView.isHidden = true
        } else if conversation.title == "AIClaw" {
            placeholderLabel.isHidden = true
            tweetClawTabView.isHidden = true
            aiClawTabView.isHidden = false
        } else {
            placeholderLabel.isHidden = false
            tweetClawTabView.isHidden = true
            aiClawTabView.isHidden = true
            placeholderLabel.stringValue = "\(conversation.title): \(conversation.preview)"
        }
    }
}

private extension DetailViewController {
    func configureView() {
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor.controlBackgroundColor.cgColor

        placeholderLabel.translatesAutoresizingMaskIntoConstraints = false
        placeholderLabel.font = .systemFont(ofSize: 18)
        placeholderLabel.textColor = .secondaryLabelColor
        view.addSubview(placeholderLabel)

        // TweetClaw tabs
        tweetClawTabView.translatesAutoresizingMaskIntoConstraints = false
        
        let humanItem = NSTabViewItem(viewController: humanVC)
        humanItem.label = "For Human"
        
        let botItem = NSTabViewItem(viewController: botVC)
        botItem.label = "For ClawBot"
        
        tweetClawTabView.addTabViewItem(humanItem)
        tweetClawTabView.addTabViewItem(botItem)
        
        view.addSubview(tweetClawTabView)
        tweetClawTabView.isHidden = true
        
        // AIClaw tabs
        aiClawTabView.translatesAutoresizingMaskIntoConstraints = false
        
        let aiHumanItem = NSTabViewItem(viewController: aiHumanVC)
        aiHumanItem.label = "For Human"
        
        let aiBotItem = NSTabViewItem(viewController: aiBotVC)
        aiBotItem.label = "For Claw"
        
        aiClawTabView.addTabViewItem(aiHumanItem)
        aiClawTabView.addTabViewItem(aiBotItem)
        
        view.addSubview(aiClawTabView)
        aiClawTabView.isHidden = true

        NSLayoutConstraint.activate([
            placeholderLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            placeholderLabel.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            
            tweetClawTabView.topAnchor.constraint(equalTo: view.topAnchor, constant: 10),
            tweetClawTabView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 10),
            tweetClawTabView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -10),
            tweetClawTabView.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -10),
            
            aiClawTabView.topAnchor.constraint(equalTo: view.topAnchor, constant: 10),
            aiClawTabView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 10),
            aiClawTabView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -10),
            aiClawTabView.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -10)
        ])
    }
}
