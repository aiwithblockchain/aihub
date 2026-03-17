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
        // 1. 获取屏幕和可见区域信息
        let screen = NSScreen.main ?? NSScreen.screens[0]
        let fullFrame = screen.frame
        let visibleFrame = screen.visibleFrame

        // 2. 精确计算 Menu Bar 和 Dock 占用的高度（不使用猜测值）
        let menuBarHeight = fullFrame.maxY - visibleFrame.maxY
        let dockHeight = visibleFrame.minY
        let finalHeight = fullFrame.height - menuBarHeight - dockHeight
        let hMargin: CGFloat = 20

        let winFrame = NSRect(
            x: visibleFrame.midX - 600,
            y: visibleFrame.midY - 400,
            width: 1200,
            height: 800
        )

        // 3. 使用指定的全尺寸样式直接初始化窗口，确保布局引擎一开始就处于正确模式
        let window = NSWindow(
            contentRect: winFrame,
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        
        window.title = "AI 融合器"
        window.isReleasedWhenClosed = false
        window.backgroundColor = .consoleZ950
        window.titlebarAppearsTransparent = true
        window.titleVisibility = .hidden
        window.minSize = NSSize(width: 900, height: 580)

        // 4. 挂载根视图控制器
        let vc = AIConsoleRootViewController()
        window.contentViewController = vc

        super.init(window: window)
        window.delegate = self
        
        // 5. 最后确认一次 Frame，display 设为 true 强制刷新
        window.setFrame(winFrame, display: true)
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
