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

        // 注册主题变化通知
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleThemeChange),
            name: ThemeManager.themeDidChangeNotification,
            object: nil
        )
    }

    @objc private func handleThemeChange() {
        view.needsDisplay = true
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    override func viewDidAppear() {
        super.viewDidAppear()
        
        // 使用 async 确保 TableView 已加载并能正确反映选中状态
        DispatchQueue.main.async {
            self.sidebarViewController.selectDefaultRow()
            if let firstConversation = self.sidebarViewController.defaultConversation {
                self.detailViewController.display(conversation: firstConversation)
            }
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
