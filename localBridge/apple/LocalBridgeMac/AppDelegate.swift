import AppKit

final class AppDelegate: NSObject, NSApplicationDelegate {
    static private(set) var shared: AppDelegate?
    
    private var statusItem: NSStatusItem?
    private lazy var mainWindowController = MainWindowController()
    private let wsServer = LocalBridgeWebSocketServer()

    func applicationDidFinishLaunching(_ notification: Notification) {
        AppDelegate.shared = self
        wsServer.start()
        
        let statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        self.statusItem = statusItem

        guard let button = statusItem.button else {
            return
        }

        if let image = NSImage(named: "MenuBarIcon") {
            image.isTemplate = true // Allows the icon to adapt to light/dark mode
            button.image = image
        } else {
            // Fallback to system icon if assets fail
            button.image = NSImage(systemSymbolName: "message.badge", accessibilityDescription: "LocalBridge")
        }
        button.imagePosition = .imageOnly
        button.toolTip = "Open LocalBridge"
        button.target = self
        button.action = #selector(openMainWindow)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        false
    }

    @objc
    private func openMainWindow() {
        mainWindowController.showWindow(nil)
        mainWindowController.window?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    func sendQueryXTabsStatus() {
        wsServer.sendQueryXTabsStatus()
    }
}
