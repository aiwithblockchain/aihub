import AppKit

final class MainWindowController: NSWindowController {
    init() {
        let contentViewController = ConversationsSplitViewController()
        let window = NSWindow(contentViewController: contentViewController)

        window.title = "LocalBridge"
        window.setContentSize(NSSize(width: 980, height: 680))
        window.minSize = NSSize(width: 820, height: 520)
        window.center()
        window.styleMask = [.titled, .closable, .miniaturizable, .resizable]
        window.titleVisibility = .visible
        window.toolbarStyle = .unified
        window.isReleasedWhenClosed = false

        super.init(window: window)
        
        let toolbar = NSToolbar(identifier: "MainWindowToolbar")
        toolbar.delegate = self
        toolbar.displayMode = .iconAndLabel
        toolbar.showsBaselineSeparator = false
        window.toolbar = toolbar
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    @objc private func quitApp() {
        NSApplication.shared.terminate(nil)
    }
}

extension MainWindowController: NSToolbarDelegate {
    func toolbar(_ toolbar: NSToolbar, itemForItemIdentifier itemIdentifier: NSToolbarItem.Identifier, willBeInsertedIntoToolbar flag: Bool) -> NSToolbarItem? {
        if itemIdentifier == NSToolbarItem.Identifier("QuitAppItem") {
            let item = NSToolbarItem(itemIdentifier: itemIdentifier)
            item.label = "Quit"
            item.paletteLabel = "Quit"
            item.toolTip = "Quit the entire application"
            if #available(macOS 11.0, *) {
                item.image = NSImage(systemSymbolName: "power", accessibilityDescription: "Quit")
            } else {
                item.image = NSImage(named: NSImage.stopProgressFreestandingTemplateName)
            }
            item.target = self
            item.action = #selector(quitApp)
            return item
        }
        return nil
    }

    func toolbarDefaultItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] {
        return [NSToolbarItem.Identifier("QuitAppItem")]
    }

    func toolbarAllowedItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] {
        return [NSToolbarItem.Identifier("QuitAppItem")]
    }
}
