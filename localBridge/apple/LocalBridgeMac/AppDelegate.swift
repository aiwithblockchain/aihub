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

        // 监听语言变化
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleLanguageChange),
            name: LanguageManager.languageDidChangeNotification,
            object: nil
        )
        
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
        button.toolTip = LanguageManager.shared.localized("app.open")
        button.target = self
        button.action = #selector(openMainWindow)
        button.sendAction(on: [.leftMouseUp, .rightMouseUp])
    }

    @objc private func handleLanguageChange() {
        statusItem?.button?.toolTip = LanguageManager.shared.localized("app.open")
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
            menu.addItem(NSMenuItem(title: LanguageManager.shared.localized("app.quit"), action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
            statusItem?.menu = menu
            statusItem?.button?.performClick(nil)
            statusItem?.menu = nil
            return
        }

        setDockIconVisible(true)

        // 先激活应用
        NSApp.activate(ignoringOtherApps: true)

        // 显示窗口
        mainWindowController.showWindow(nil)

        // 确保窗口在最前面
        if let window = mainWindowController.window {
            window.makeKeyAndOrderFront(nil)
            window.orderFrontRegardless()
            // 如果设置了保持在最前面，确保 level 正确
            if window.level == .floating {
                window.level = .floating
            }
        }
    }

    func windowWillClose() {
        setDockIconVisible(false)
    }

    private func setDockIconVisible(_ isVisible: Bool) {
        let targetPolicy: NSApplication.ActivationPolicy = isVisible ? .regular : .accessory
        guard NSApp.activationPolicy() != targetPolicy else { return }
        NSApp.setActivationPolicy(targetPolicy)
        if isVisible {
            NSApp.activate(ignoringOtherApps: true)
        }
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

    func sendQueryHomeTimeline(tabId: Int? = nil, instanceId: String? = nil) {
        goServer.sendQueryHomeTimeline(tabId: tabId, instanceId: instanceId)
    }

    func sendQueryTweetDetail(tweetId: String, tabId: Int? = nil, instanceId: String? = nil) {
        goServer.sendQueryTweetDetail(tweetId: tweetId, tabId: tabId, instanceId: instanceId)
    }

    func sendQueryTweet(tweetId: String, tabId: Int? = nil, instanceId: String? = nil) {
        goServer.sendQueryTweet(tweetId: tweetId, tabId: tabId, instanceId: instanceId)
    }

    func sendQueryTweetReplies(tweetId: String, cursor: String? = nil, tabId: Int? = nil, instanceId: String? = nil) {
        print("[LocalBridgeMac] AppDelegate sendQueryTweetReplies tweetId=\(tweetId) cursor=\(cursor ?? "<nil>") tabId=\(tabId.map(String.init) ?? "<nil>") instanceId=\(instanceId ?? "<nil>")")
        goServer.sendQueryTweetReplies(tweetId: tweetId, cursor: cursor, tabId: tabId, instanceId: instanceId)
    }

    func sendQueryUserProfile(screenName: String, tabId: Int? = nil, instanceId: String? = nil) {
        goServer.sendQueryUserProfile(screenName: screenName, tabId: tabId, instanceId: instanceId)
    }

    func sendQuerySearchTimeline(query: String? = nil, cursor: String? = nil, tabId: Int? = nil, instanceId: String? = nil) {
        goServer.sendQuerySearchTimeline(query: query, cursor: cursor, tabId: tabId, instanceId: instanceId)
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

    func sendNavigateToPlatform(platform: String, instanceId: String? = nil) {
        goServer.sendNavigateToPlatform(platform: platform, instanceId: instanceId)
    }

    func fetchAPIDocs() {
        goServer.sendRESTRequest(method: "GET", path: "/api/v1/x/docs", notificationName: "GetAPIDocsReceived")
    }

    func fetchInstances() {
        goServer.sendRESTRequest(method: "GET", path: "/api/v1/x/instances", notificationName: "GetInstancesReceived")
    }

    @objc private func restartWebSocketServer() {
        print("[LocalBridgeMac] Restarting WebSocket Service...")
        goServer.stop { [weak self] in
            print("[LocalBridgeMac] Old listeners released, starting new ones...")
            self?.goServer.start()
        }
    }
}
