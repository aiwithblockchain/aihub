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
        
        // 设置菜单栏（包含复制粘贴等核心功能）
        setupMenuBar()
        
        // 显示 AI 控制台主窗体
        AIConsoleWindowController.show()
    }
    
    private func setupMenuBar() {
        let mainMenu = NSMenu()
        
        // 1. App Menu
        let appMenu = NSMenu()
        let processName = ProcessInfo.processInfo.processName
        appMenu.addItem(withTitle: "关于 \(processName)", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "隐藏 \(processName)", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        appMenu.addItem(withTitle: "隐藏其他", action: #selector(NSApplication.hideOtherApplications(_:)), keyEquivalent: "h").keyEquivalentModifierMask = [.command, .option]
        appMenu.addItem(withTitle: "显示全部", action: #selector(NSApplication.unhideAllApplications(_:)), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "退出 \(processName)", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        
        let appMenuItem = NSMenuItem()
        appMenuItem.submenu = appMenu
        mainMenu.addItem(appMenuItem)
        
        // 2. Edit Menu (非常重要：支持复制、粘贴、全选)
        let editMenu = NSMenu(title: "编辑")
        editMenu.addItem(withTitle: "撤销", action: #selector(UndoManager.undo), keyEquivalent: "z")
        editMenu.addItem(withTitle: "重做", action: #selector(UndoManager.redo), keyEquivalent: "Z")
        editMenu.addItem(NSMenuItem.separator())
        editMenu.addItem(withTitle: "剪切", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "复制", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "粘贴", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "全选", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        
        let editMenuItem = NSMenuItem()
        editMenuItem.submenu = editMenu
        mainMenu.addItem(editMenuItem)
        
        // 3. Window Menu
        let windowMenu = NSMenu(title: "窗口")
        windowMenu.addItem(withTitle: "最小化", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        windowMenu.addItem(withTitle: "缩放", action: #selector(NSWindow.performZoom(_:)), keyEquivalent: "")
        windowMenu.addItem(NSMenuItem.separator())
        windowMenu.addItem(withTitle: "全部置于前层", action: #selector(NSApplication.arrangeInFront(_:)), keyEquivalent: "")
        
        let windowMenuItem = NSMenuItem()
        windowMenuItem.submenu = windowMenu
        mainMenu.addItem(windowMenuItem)
        
        NSApp.mainMenu = mainMenu
    }
    
    func applicationSupportsSecureRestorableState(_ app: NSApplication) -> Bool {
        return true
    }
    
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }
}
