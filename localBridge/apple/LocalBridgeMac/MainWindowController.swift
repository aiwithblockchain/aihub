import AppKit

final class MainWindowController: NSWindowController {
    init() {
        let contentViewController = ConversationsSplitViewController()
        let window = NSWindow(contentViewController: contentViewController)

        window.title = "LocalBridge"
        window.setContentSize(NSSize(width: 1000, height: 700))
        window.minSize = NSSize(width: 860, height: 560)
        window.center()
        window.styleMask = [.titled, .closable, .miniaturizable, .resizable]
        window.titleVisibility = .visible
        window.toolbarStyle = .unified
        window.isReleasedWhenClosed = false

        super.init(window: window)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    @objc private func quitApp() {
        NSApplication.shared.terminate(nil)
    }
}


