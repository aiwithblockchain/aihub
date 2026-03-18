import AppKit

final class AISettingsWindowController: NSWindowController {
    private static var instance: AISettingsWindowController?

    private var themeObserver: NSObjectProtocol?

    static func show() {
        if instance == nil {
            instance = AISettingsWindowController()
        }

        guard let window = instance?.window else { return }
        instance?.showWindow(nil)
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    init() {
        let frame = NSRect(x: 0, y: 0, width: 900, height: 600)
        let window = NSWindow(
            contentRect: frame,
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )

        window.title = "设置"
        window.isReleasedWhenClosed = false
        window.level = .floating
        window.minSize = NSSize(width: 700, height: 500)
        window.titleVisibility = .hidden
        window.titlebarAppearsTransparent = true
        window.isMovableByWindowBackground = true
        window.center()
        window.standardWindowButton(.closeButton)?.isHidden = true
        window.standardWindowButton(.miniaturizeButton)?.isHidden = true
        window.standardWindowButton(.zoomButton)?.isHidden = true
        window.contentViewController = AISettingsViewController()

        super.init(window: window)
        window.delegate = self
        applyWindowTheme()
        themeObserver = NotificationCenter.default.addObserver(
            forName: ThemeManager.didChangeNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.applyWindowTheme()
        }
    }

    required init?(coder: NSCoder) {
        fatalError()
    }

    deinit {
        if let themeObserver {
            NotificationCenter.default.removeObserver(themeObserver)
        }
    }

    private func applyWindowTheme() {
        window?.backgroundColor = .consoleZ950
    }
}

extension AISettingsWindowController: NSWindowDelegate {
    func windowWillClose(_ notification: Notification) {
        AISettingsWindowController.instance = nil
    }
}
