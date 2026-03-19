import AppKit

final class ConversationsSplitViewController: NSSplitViewController {
    private let sidebarViewController = SidebarViewController()
    private let detailViewController = DetailViewController()
    private let settingsViewController = SettingsViewController()
    
    private var detailItem: NSSplitViewItem?

    override func viewDidLoad() {
        super.viewDidLoad()

        sidebarViewController.delegate = self

        let sidebarItem = NSSplitViewItem(sidebarWithViewController: sidebarViewController)
        sidebarItem.minimumThickness = DS.sidebarWidth
        sidebarItem.maximumThickness = DS.sidebarWidth

        let detailItem = NSSplitViewItem(viewController: detailViewController)
        self.detailItem = detailItem
 
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
        if let currentDetailItem = detailItem, currentDetailItem.viewController != detailViewController {
            // Replace settings with detail
            let newDetailItem = NSSplitViewItem(viewController: detailViewController)
            removeSplitViewItem(currentDetailItem)
            addSplitViewItem(newDetailItem)
            self.detailItem = newDetailItem
        }
        detailViewController.display(conversation: conversation)
    }
    
    func sidebarViewControllerDidSelectSettings(_ controller: SidebarViewController) {
        if let currentDetailItem = detailItem, currentDetailItem.viewController != settingsViewController {
            // Replace detail with settings
            let newSettingsItem = NSSplitViewItem(viewController: settingsViewController)
            removeSplitViewItem(currentDetailItem)
            addSplitViewItem(newSettingsItem)
            self.detailItem = newSettingsItem
        }
    }
}
