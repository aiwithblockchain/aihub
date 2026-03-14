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
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
}
