import AppKit

final class AppDelegate: NSObject, NSApplicationDelegate {
    static private(set) var shared: AppDelegate?
    
    private var statusItem: NSStatusItem?
    private lazy var mainWindowController = MainWindowController()
    private let goServer = LocalBridgeGoManager()

    func applicationDidFinishLaunching(_ notification: Notification) {
        AppDelegate.shared = self

        // Run as a menu-bar-only app by default (no Dock icon).
        // It lives in the menu bar and provides WebSocket/REST services.
        NSApp.setActivationPolicy(.accessory)

        goServer.start()
        
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

    func getConnectedInstances() -> [LocalBridgeGoManager.InstanceSnapshot] {
        return goServer.getConnectedInstances()
    }

    func sendQueryXTabsStatus(instanceId: String? = nil) {
        goServer.sendQueryXTabsStatus(instanceId: instanceId)
    }

    func sendQueryXBasicInfo(instanceId: String? = nil) {
        goServer.sendQueryXBasicInfo(instanceId: instanceId)
    }

    func sendOpenTab(path: String, instanceId: String? = nil) {
        goServer.sendOpenTab(path: path, instanceId: instanceId)
    }

    func sendCloseTab(tabId: Int, instanceId: String? = nil) {
        goServer.sendCloseTab(tabId: tabId, instanceId: instanceId)
    }

    func sendNavigateTab(tabId: Int?, path: String, instanceId: String? = nil) {
        goServer.sendNavigateTab(tabId: tabId, path: path, instanceId: instanceId)
    }

    func sendExecAction(action: String, tweetId: String?, userId: String?, tabId: Int?, text: String? = nil, instanceId: String? = nil) {
        goServer.sendExecAction(action: action, tweetId: tweetId, userId: userId, tabId: tabId, text: text, instanceId: instanceId)
    }

    func sendQueryAITabsStatus(instanceId: String? = nil) {
        goServer.sendQueryAITabsStatus(instanceId: instanceId)
    }

    func sendSendMessage(platform: String, prompt: String, instanceId: String? = nil) {
        goServer.sendSendMessage(platform: platform, prompt: prompt, instanceId: instanceId)
    }

    func sendNewConversation(platform: String, instanceId: String? = nil) {
        goServer.sendNewConversation(platform: platform, instanceId: instanceId)
    }

    @objc private func restartWebSocketServer() {
        print("[LocalBridgeMac] Restarting WebSocket Service...")
        goServer.stop { [weak self] in
            print("[LocalBridgeMac] Old listeners released, starting new ones...")
            self?.goServer.start()
        }
    }
}
