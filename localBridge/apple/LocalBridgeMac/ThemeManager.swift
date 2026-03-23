import AppKit

/// 主题类型
enum AppTheme: String, Codable {
    case dark
    case light
    case auto
}

/// 主题管理器 - 单例模式
final class ThemeManager {
    static let shared = ThemeManager()

    /// 主题变化通知
    static let themeDidChangeNotification = NSNotification.Name("ThemeDidChange")

    /// 用户选择的主题偏好
    private(set) var userTheme: AppTheme {
        didSet {
            saveTheme()
            updateEffectiveTheme()
        }
    }

    /// 当前生效的主题（考虑 auto 模式）
    private(set) var effectiveTheme: AppTheme = .dark {
        didSet {
            if effectiveTheme != oldValue {
                NotificationCenter.default.post(name: Self.themeDidChangeNotification, object: nil)
            }
        }
    }

    private init() {
        self.userTheme = Self.loadTheme()
        self.effectiveTheme = Self.resolveEffectiveTheme(for: userTheme)
        observeSystemAppearance()
    }

    /// 设置主题
    func setTheme(_ theme: AppTheme) {
        userTheme = theme
    }

    /// 获取当前是否为深色模式
    var isDarkMode: Bool {
        return effectiveTheme == .dark
    }

    // MARK: - Private Methods

    private func updateEffectiveTheme() {
        effectiveTheme = Self.resolveEffectiveTheme(for: userTheme)
    }

    private static func resolveEffectiveTheme(for theme: AppTheme) -> AppTheme {
        switch theme {
        case .dark:
            return .dark
        case .light:
            return .light
        case .auto:
            return systemIsDarkMode() ? .dark : .light
        }
    }

    private static func systemIsDarkMode() -> Bool {
        let appearance = NSApp.effectiveAppearance
        if appearance.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua {
            return true
        }
        return false
    }

    private func observeSystemAppearance() {
        DistributedNotificationCenter.default.addObserver(
            self,
            selector: #selector(systemAppearanceDidChange),
            name: NSNotification.Name("AppleInterfaceThemeChangedNotification"),
            object: nil
        )
    }

    @objc private func systemAppearanceDidChange() {
        if userTheme == .auto {
            updateEffectiveTheme()
        }
    }

    // MARK: - Persistence

    private static let themeKey = "appTheme"

    private static func loadTheme() -> AppTheme {
        let defaults = UserDefaults.standard
        if let themeString = defaults.string(forKey: themeKey),
           let theme = AppTheme(rawValue: themeString) {
            return theme
        }
        return .dark // 默认深色主题
    }

    private func saveTheme() {
        let defaults = UserDefaults.standard
        defaults.set(userTheme.rawValue, forKey: Self.themeKey)
        defaults.synchronize()
    }

    deinit {
        DistributedNotificationCenter.default.removeObserver(self)
    }
}
