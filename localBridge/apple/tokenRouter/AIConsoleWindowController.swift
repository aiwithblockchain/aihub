import AppKit

// MARK: - Window Controller

final class AIConsoleWindowController: NSWindowController {
    private static var instance: AIConsoleWindowController?
    
    /// 是否处于独立 App 模式（而非嵌入在主应用中）
    static var isStandaloneMode: Bool = false
    private var themeObserver: NSObjectProtocol?

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
        
        // 动态计算窗口大小：极致占屏比例
        // 宽度占 99.5% (左右边距极其小且均等)
        // 高度设置为 100% 的 visibleFrame (底部贴合 Dock，顶部对齐菜单栏)
        let margin: CGFloat = 8 // 定义侧边页边距
        let width: CGFloat = visibleFrame.width - (margin * 2)
        let height: CGFloat = visibleFrame.height
        
        let winFrame = NSRect(
            x: visibleFrame.origin.x + margin,
            y: visibleFrame.origin.y,
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
        
        // 关键：在设置完 contentViewController 后再次强制确认 Frame，防止尺寸塌陷
        window.setFrame(winFrame, display: true)

        super.init(window: window)
        window.delegate = self
        applyWindowTheme(rebuildContent: false)
        themeObserver = NotificationCenter.default.addObserver(
            forName: ThemeManager.didChangeNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.applyWindowTheme(rebuildContent: true)
        }
        
        // 我们已经通过 winFrame 手动居中了，不需要额外的 window.center()
    }

    required init?(coder: NSCoder) { fatalError() }

    deinit {
        if let themeObserver {
            NotificationCenter.default.removeObserver(themeObserver)
        }
    }

    private func applyWindowTheme(rebuildContent: Bool) {
        window?.backgroundColor = .consoleZ950
        guard rebuildContent, let window else { return }

        let selectedIndex = (window.contentViewController as? AIConsoleRootViewController)?.currentSelectedIndex ?? 0
        let frame = window.frame
        let minSize = window.minSize
        window.contentViewController = AIConsoleRootViewController(selectedIndex: selectedIndex)
        window.minSize = minSize
        window.setFrame(frame, display: true)
    }
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
