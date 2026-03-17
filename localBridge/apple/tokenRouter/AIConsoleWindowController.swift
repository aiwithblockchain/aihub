import AppKit

// MARK: - Window Controller

final class AIConsoleWindowController: NSWindowController {
    private static var instance: AIConsoleWindowController?
    
    /// 是否处于独立 App 模式（而非嵌入在主应用中）
    static var isStandaloneMode: Bool = false

    // MARK: - Show

    static func show() {
        print("AIConsoleWindowController: show() called")

        if instance == nil {
            print("AIConsoleWindowController: creating new instance")
            instance = AIConsoleWindowController()
        }
        
        // 2. 显示并置顶窗口
        guard let window = instance?.window else { 
            print("AIConsoleWindowController: error - no window")
            return 
        }
        
        print("AIConsoleWindowController: ordering front")
        instance?.showWindow(self)
        window.makeKeyAndOrderFront(nil)
        
        // 3. 激活应用（仅 macOS 13 需要手动激活，14+ 系统自动处理）
        print("AIConsoleWindowController: activating app")
        if #unavailable(macOS 14.0) {
            NSApp.activate(ignoringOtherApps: true)
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
        
        window.title = "AI 融合器"
        window.isReleasedWhenClosed = false
        window.backgroundColor = .consoleZ950
        window.isRestorable = false // 禁用恢复，解决 className=(null) 错误
        
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
