import AppKit

// 纯 AppKit 入口，绕过 SwiftUI 对 activationPolicy 的干预
MainActor.assumeIsolated {
    let app = NSApplication.shared
    let delegate = TokenRouterAppDelegate()
    app.delegate = delegate
    app.run()
}
