import AppKit

final class ConversationsSplitViewController: NSSplitViewController {
    private let sidebarViewController = SidebarViewController()
    private let detailViewController = DetailViewController()

    override func viewDidLoad() {
        super.viewDidLoad()

        sidebarViewController.delegate = self

        let sidebarItem = NSSplitViewItem(sidebarWithViewController: sidebarViewController)
        sidebarItem.minimumThickness = 250
        sidebarItem.maximumThickness = 320

        let detailItem = NSSplitViewItem(viewController: detailViewController)

        addSplitViewItem(sidebarItem)
        addSplitViewItem(detailItem)

        if let firstConversation = sidebarViewController.defaultConversation {
            detailViewController.display(conversation: firstConversation)
        }
    }
}

extension ConversationsSplitViewController: SidebarViewControllerDelegate {
    func sidebarViewController(
        _ controller: SidebarViewController,
        didSelect conversation: Conversation
    ) {
        detailViewController.display(conversation: conversation)
    }
}
