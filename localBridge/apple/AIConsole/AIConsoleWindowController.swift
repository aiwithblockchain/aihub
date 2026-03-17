import AppKit

// MARK: - Window Controller

final class AIConsoleWindowController: NSWindowController {
    private static var instance: AIConsoleWindowController?
    
    /// 是否处于独立 App 模式（而非嵌入在主应用中）
    static var isStandaloneMode: Bool = false

    // MARK: - Show

    static func show() {
        if instance == nil {
            instance = AIConsoleWindowController()
        }
        
        // 1. 设置激活策略
        NSApp.setActivationPolicy(.regular)
        
        // 2. 显示窗口
        guard let window = instance?.window else { return }
        instance?.showWindow(nil)
        window.makeKeyAndOrderFront(nil)
        window.orderFrontRegardless()
        
        // 3. 强力激活到最前
        NSApp.activate(ignoringOtherApps: true)
        
        DispatchQueue.main.async {
            window.makeMain()
            window.makeKey()
        }
    }

    // MARK: - Init

    init() {
        let screen = NSScreen.main ?? NSScreen.screens[0]
        let visibleFrame = screen.visibleFrame
        
        // IDE-standard size: 1280x850
        let width: CGFloat = 1280
        let height: CGFloat = 850
        let winFrame = NSRect(
            x: visibleFrame.midX - width/2,
            y: visibleFrame.midY - height/2,
            width: width,
            height: height
        )

        let window = NSWindow(
            contentRect: winFrame,
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        
        window.title = "AI 融合器" // 窗口标题，虽然 hidden 但在 Mission Control 可见
        window.isReleasedWhenClosed = false
        window.backgroundColor = .consoleZ950
        window.setFrameAutosaveName("AIConsoleMainWindow")
        
        // 沉浸式标题栏配置
        window.titlebarAppearsTransparent = true
        window.titleVisibility = .hidden
        window.isMovableByWindowBackground = true
        
        window.minSize = NSSize(width: 1000, height: 650)

        // 挂载根视图控制器
        let vc = AIConsoleRootViewController()
        window.contentViewController = vc

        super.init(window: window)
        window.delegate = self
        
        window.center()
    }

    required init?(coder: NSCoder) { fatalError() }
}

// MARK: - NSWindowDelegate

extension AIConsoleWindowController: NSWindowDelegate {
    func windowWillClose(_ notification: Notification) {
        if !AIConsoleWindowController.isStandaloneMode {
            NSApp.setActivationPolicy(.accessory)
        }
        AIConsoleWindowController.instance = nil
    }
}
