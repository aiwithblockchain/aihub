//
//  tokenRouterApp.swift
//  tokenRouter
//
//  Created by wesley on 2026/3/17.
//

import SwiftUI
import SwiftData

@main
struct tokenRouterApp: App {
    @NSApplicationDelegateAdaptor(TokenRouterAppDelegate.self) var appDelegate
    
    var body: some Scene {
        // 使用 Settings 场景来占位，这样不会自动打开主窗口（由 AIConsoleWindowController 负责）
        Settings {
            EmptyView()
        }
    }
}

class TokenRouterAppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        print("TokenRouterAppDelegate: applicationDidFinishLaunching")
        
        // 设置为独立模式
        AIConsoleWindowController.isStandaloneMode = true
        
        // 显示 AI 控制台主窗体
        AIConsoleWindowController.show()
    }
    
    func applicationSupportsSecureRestorableState(_ app: NSApplication) -> Bool {
        return true
    }
    
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }
}
