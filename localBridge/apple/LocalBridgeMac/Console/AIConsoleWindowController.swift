import AppKit

// MARK: - Window Controller

final class AIConsoleWindowController: NSWindowController {
    private static var instance: AIConsoleWindowController?

    // MARK: Show

    static func show() {
        if instance == nil {
            instance = AIConsoleWindowController()
        }

        // 确保应用处于 regular 模式（显示 Dock 和菜单栏）
        if NSApp.activationPolicy() != .regular {
            NSApp.setActivationPolicy(.regular)
        }

        guard let window = instance?.window else { return }

        instance?.showWindow(nil)
        window.makeKeyAndOrderFront(nil)
        window.orderFrontRegardless()

        NSRunningApplication.current.activate(options: .activateIgnoringOtherApps)

        DispatchQueue.main.async {
            window.makeMain()
            window.makeKey()
        }
    }

    // MARK: Init

    init() {
        let vc = AIConsoleRootViewController()
        let window = NSWindow(contentViewController: vc)
        window.title = "AI 融合器"

        let screenFrame = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
        // 目标比例：参考截图1，宽高约 1280×820，尽量接近 IDE 比例
        let targetWidth  = min(screenFrame.width  * 0.88, 1280)
        let targetHeight = min(screenFrame.height * 0.88, 820)

        window.setContentSize(NSSize(width: targetWidth, height: targetHeight))
        window.minSize = NSSize(width: 800, height: 560)
        window.center()
        window.styleMask = [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView]
        window.isReleasedWhenClosed = false
        window.backgroundColor = .consoleZ950
        window.titlebarAppearsTransparent = true
        window.titleVisibility = .hidden
        super.init(window: window)
        window.delegate = self
    }

    required init?(coder: NSCoder) { fatalError() }
}

// MARK: - NSWindowDelegate

extension AIConsoleWindowController: NSWindowDelegate {
    func windowWillClose(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
        AIConsoleWindowController.instance = nil
    }
}
