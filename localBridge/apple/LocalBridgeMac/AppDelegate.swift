import AppKit

final class AppDelegate: NSObject, NSApplicationDelegate {
    static private(set) var shared: AppDelegate?
    
    private var statusItem: NSStatusItem?
    private lazy var mainWindowController = MainWindowController()
    private let wsServer = LocalBridgeWebSocketServer()

    func applicationDidFinishLaunching(_ notification: Notification) {
        AppDelegate.shared = self
        wsServer.start()
        
        NotificationCenter.default.addObserver(self, selector: #selector(restartWebSocketServer), name: NSNotification.Name("RestartWebSocketServer"), object: nil)
        
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
        button.sendAction(on: [.leftMouseUp, .rightMouseUp])
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        false
    }

    @objc
    private func openMainWindow() {
        if let event = NSApp.currentEvent, event.type == .rightMouseUp || (event.type == .leftMouseUp && event.modifierFlags.contains(.control)) {
            let menu = NSMenu()
            menu.addItem(NSMenuItem(title: "退出 LocalBridge", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
            statusItem?.menu = menu
            statusItem?.button?.performClick(nil) // trigger menu
            statusItem?.menu = nil // clear it so left click works as normal next time
            return
        }
        
        if let window = mainWindowController.window {
            window.makeKeyAndOrderFront(nil)
            // If the window was previously obscured or in another space
            window.orderFrontRegardless()
        }
        mainWindowController.showWindow(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    func sendQueryXTabsStatus() {
        wsServer.sendQueryXTabsStatus()
    }
    
    func sendQueryXBasicInfo() {
        wsServer.sendQueryXBasicInfo()
    }
    
    func sendQueryAITabsStatus() {
        wsServer.sendQueryAITabsStatus()
    }
    @objc private func restartWebSocketServer() {
        print("[LocalBridgeMac] Restarting WebSocket Service...")
        wsServer.stop { [weak self] in
            print("[LocalBridgeMac] Old listeners released, starting new ones...")
            self?.wsServer.start()
        }
    }
}
