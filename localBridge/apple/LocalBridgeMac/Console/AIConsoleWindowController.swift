import AppKit

// MARK: - Window Controller

final class AIConsoleWindowController: NSWindowController {
    private static var instance: AIConsoleWindowController?

    // MARK: - Show

    static func show() {
        if instance == nil {
            instance = AIConsoleWindowController()
        }
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

    // MARK: - Init

    init() {
        let vc = AIConsoleRootViewController()
        let window = NSWindow(contentViewController: vc)
        window.title = "AI 融合器"

        // 尽可能撑满屏幕可用区域，四边留 20pt 边距
        let screen = NSScreen.main ?? NSScreen.screens[0]
        let sf = screen.visibleFrame
        let margin: CGFloat = 20
        let winFrame = NSRect(
            x: sf.minX + margin,
            y: sf.minY + margin,
            width:  sf.width  - margin * 2,
            height: sf.height - margin * 2
        )
        window.setFrame(winFrame, display: false)
        window.minSize = NSSize(width: 900, height: 580)

        window.styleMask = [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView]
        window.isReleasedWhenClosed  = false
        window.backgroundColor       = .consoleZ950
        window.titlebarAppearsTransparent = true
        window.titleVisibility       = .hidden

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
