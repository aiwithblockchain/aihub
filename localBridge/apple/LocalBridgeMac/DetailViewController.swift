import AppKit

final class DetailViewController: NSViewController {
    private let tabView = NSTabView()
    private let humanVC = TweetClawHumanViewController()
    private let botVC = TweetClawBotViewController()
    
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
            tabView.isHidden = false
        } else {
            placeholderLabel.isHidden = false
            tabView.isHidden = true
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

        tabView.translatesAutoresizingMaskIntoConstraints = false
        
        let humanItem = NSTabViewItem(viewController: humanVC)
        humanItem.label = "For Human"
        
        let botItem = NSTabViewItem(viewController: botVC)
        botItem.label = "For ClawBot"
        
        tabView.addTabViewItem(humanItem)
        tabView.addTabViewItem(botItem)
        
        view.addSubview(tabView)
        tabView.isHidden = true

        NSLayoutConstraint.activate([
            placeholderLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            placeholderLabel.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            
            tabView.topAnchor.constraint(equalTo: view.topAnchor, constant: 10),
            tabView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 10),
            tabView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -10),
            tabView.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -10)
        ])
    }
}
