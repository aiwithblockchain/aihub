import Foundation

/// 语言管理器,负责管理应用的语言设置
final class LanguageManager {

    static let shared = LanguageManager()

    /// 语言变更通知
    static let languageDidChangeNotification = Notification.Name("LanguageDidChange")

    /// 支持的语言
    enum Language: String {
        case english = "en"
        case chinese = "zh"
    }

    /// 当前语言
    private(set) var currentLanguage: Language {
        didSet {
            if oldValue != currentLanguage {
                // 保存到 UserDefaults
                UserDefaults.standard.set(currentLanguage.rawValue, forKey: "AppLanguage")

                // 发送通知
                NotificationCenter.default.post(
                    name: LanguageManager.languageDidChangeNotification,
                    object: nil
                )
            }
        }
    }

    private init() {
        // 从 UserDefaults 读取保存的语言设置
        if let savedLang = UserDefaults.standard.string(forKey: "AppLanguage"),
           let language = Language(rawValue: savedLang) {
            self.currentLanguage = language
        } else {
            // 默认使用系统语言
            let systemLang = Locale.current.language.languageCode?.identifier ?? "en"
            self.currentLanguage = systemLang.hasPrefix("zh") ? .chinese : .english
        }
    }

    /// 切换语言
    func setLanguage(_ language: Language) {
        currentLanguage = language
    }

    /// 切换到另一种语言
    func toggleLanguage() {
        currentLanguage = (currentLanguage == .english) ? .chinese : .english
    }

    /// 获取本地化文本
    func localized(_ key: String) -> String {
        return Localizations.translations[key]?[currentLanguage.rawValue] ?? key
    }
}
