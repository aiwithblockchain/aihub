import AppKit

@main
class StandaloneAppDelegate: NSObject, NSApplicationDelegate {
    var windowController: AIConsoleWindowController?

    func applicationDidFinishLaunching(_ notification: Notification) {
        // 设置为独立模式，防止窗口关闭时意外改变主进程的激活策略
        AIConsoleWindowController.isStandaloneMode = true
        
        let wc = AIConsoleWindowController()
        self.windowController = wc
        wc.showWindow(nil)
        
        // 确保应用作为普通应用显示（带菜单栏和 Dock 图标）
        NSApp.setActivationPolicy(.regular)
        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }
}
