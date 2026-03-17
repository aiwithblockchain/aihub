import AppKit

final class AppDelegate: NSObject, NSApplicationDelegate {
    static private(set) var shared: AppDelegate?
    
    private var statusItem: NSStatusItem?
    private lazy var mainWindowController = MainWindowController()
    private let wsServer = LocalBridgeWebSocketServer()

    func applicationDidFinishLaunching(_ notification: Notification) {
        AppDelegate.shared = self

        // Run as a menu-bar-only app by default (no Dock icon).
        // AIConsoleWindowController.show() will switch to .regular when the
        // AI Console window opens, and switch back to .accessory when it closes.
        NSApp.setActivationPolicy(.accessory)

        wsServer.start()
        
        NotificationCenter.default.addObserver(self, selector: #selector(restartWebSocketServer), name: NSNotification.Name("RestartWebSocketServer"), object: nil)
        
        let statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        self.statusItem = statusItem

        guard let button = statusItem.button else {
            return
        }

        if let image = NSImage(named: "MenuBarIcon") {
            image.isTemplate = true
            button.image = image
        } else {
            button.image = NSImage(systemSymbolName: "message.badge", accessibilityDescription: "LocalBridge")
        }
        button.imagePosition = .imageOnly
        button.toolTip = "Open LocalBridge"
        button.target = self
        button.action = #selector(openMainWindow)
        button.sendAction(on: [.leftMouseUp, .rightMouseUp])
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        // Never quit when the last window is closed — we live in the menu bar.
        false
    }

    @objc
    private func openMainWindow() {
        if let event = NSApp.currentEvent,
           event.type == .rightMouseUp ||
           (event.type == .leftMouseUp && event.modifierFlags.contains(.control)) {
            let menu = NSMenu()
            menu.addItem(NSMenuItem(title: "退出 LocalBridge", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
            statusItem?.menu = menu
            statusItem?.button?.performClick(nil)
            statusItem?.menu = nil
            return
        }
        
        if let window = mainWindowController.window {
            window.makeKeyAndOrderFront(nil)
            window.orderFrontRegardless()
        }
        mainWindowController.showWindow(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    // MARK: - WebSocket forwarding

    func getConnectedInstances() -> [LocalBridgeWebSocketServer.InstanceSnapshot] {
        return wsServer.getConnectedInstances()
    }

    func sendQueryXTabsStatus(instanceId: String? = nil) {
        wsServer.sendQueryXTabsStatus(instanceId: instanceId)
    }

    func sendQueryXBasicInfo(instanceId: String? = nil) {
        wsServer.sendQueryXBasicInfo(instanceId: instanceId)
    }

    func sendOpenTab(path: String, instanceId: String? = nil) {
        wsServer.sendOpenTab(path: path, instanceId: instanceId)
    }

    func sendCloseTab(tabId: Int, instanceId: String? = nil) {
        wsServer.sendCloseTab(tabId: tabId, instanceId: instanceId)
    }

    func sendNavigateTab(tabId: Int?, path: String, instanceId: String? = nil) {
        wsServer.sendNavigateTab(tabId: tabId, path: path, instanceId: instanceId)
    }

    func sendExecAction(action: String, tweetId: String?, userId: String?, tabId: Int?, text: String? = nil, instanceId: String? = nil) {
        wsServer.sendExecAction(action: action, tweetId: tweetId, userId: userId, tabId: tabId, text: text, instanceId: instanceId)
    }

    func sendQueryAITabsStatus(instanceId: String? = nil) {
        wsServer.sendQueryAITabsStatus(instanceId: instanceId)
    }

    func sendSendMessage(platform: String, prompt: String, instanceId: String? = nil) {
        wsServer.sendSendMessage(platform: platform, prompt: prompt, instanceId: instanceId)
    }

    func sendNewConversation(platform: String, instanceId: String? = nil) {
        wsServer.sendNewConversation(platform: platform, instanceId: instanceId)
    }

    @objc private func restartWebSocketServer() {
        print("[LocalBridgeMac] Restarting WebSocket Service...")
        wsServer.stop { [weak self] in
            print("[LocalBridgeMac] Old listeners released, starting new ones...")
            self?.wsServer.start()
        }
    }
}
