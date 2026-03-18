import AppKit

enum ConsoleAppearancePreference: String, CaseIterable {
    case system
    case light
    case dark

    var label: String {
        switch self {
        case .system:
            return "跟随系统"
        case .light:
            return "亮色"
        case .dark:
            return "暗色"
        }
    }

    var appAppearance: NSAppearance? {
        switch self {
        case .system:
            return nil
        case .light:
            return NSAppearance(named: .aqua)
        case .dark:
            return NSAppearance(named: .darkAqua)
        }
    }
}

struct ConsoleThemePalette {
    let windowBackground: NSColor
    let sidebarBackground: NSColor
    let panelBackground: NSColor
    let cardBackground: NSColor
    let elevatedBackground: NSColor
    let inputBackground: NSColor
    let border: NSColor
    let strongBorder: NSColor
    let textPrimary: NSColor
    let textSecondary: NSColor
    let textTertiary: NSColor
    let primary: NSColor
    let primaryStrong: NSColor
    let success: NSColor
    let warning: NSColor
    let error: NSColor
    let rolePM: NSColor
    let roleDeveloper: NSColor
    let roleQA: NSColor
    let human: NSColor
}

final class ThemeAwareView: NSView {
    var onEffectiveAppearanceChange: (() -> Void)?

    override func viewDidChangeEffectiveAppearance() {
        super.viewDidChangeEffectiveAppearance()
        onEffectiveAppearanceChange?()
    }
}

@MainActor
final class ThemeManager {
    static let shared = ThemeManager()
    static let didChangeNotification = Notification.Name("ConsoleThemeManagerDidChange")

    private let defaultsKey = "tokenRouter.consoleAppearancePreference"

    private(set) var appearancePreference: ConsoleAppearancePreference

    private init() {
        if let rawValue = UserDefaults.standard.string(forKey: defaultsKey),
           let preference = ConsoleAppearancePreference(rawValue: rawValue) {
            appearancePreference = preference
        } else {
            appearancePreference = .system
        }
    }

    func applyAppearancePreference() {
        NSApp.appearance = appearancePreference.appAppearance
    }

    func setAppearancePreference(_ preference: ConsoleAppearancePreference) {
        guard preference != appearancePreference else { return }
        appearancePreference = preference
        UserDefaults.standard.set(preference.rawValue, forKey: defaultsKey)
        applyAppearancePreference()
        NotificationCenter.default.post(name: Self.didChangeNotification, object: nil)
    }

    func notifySystemAppearanceChangedIfNeeded() {
        guard appearancePreference == .system else { return }
        NotificationCenter.default.post(name: Self.didChangeNotification, object: nil)
    }

    func palette(for appearance: NSAppearance? = nil) -> ConsoleThemePalette {
        switch resolvedAppearanceStyle(for: appearance) {
        case .light:
            return Self.lightPalette
        case .dark:
            return Self.darkPalette
        }
    }

    private func resolvedAppearanceStyle(for appearance: NSAppearance?) -> AppearanceStyle {
        switch appearancePreference {
        case .light:
            return .light
        case .dark:
            return .dark
        case .system:
            let match = (appearance ?? NSApp.effectiveAppearance)
                .bestMatch(from: [.darkAqua, .aqua])
            return match == .darkAqua ? .dark : .light
        }
    }

    private enum AppearanceStyle {
        case light
        case dark
    }

    private static let darkPalette = ConsoleThemePalette(
        windowBackground: NSColor(hex: "#151B21"),
        sidebarBackground: NSColor(hex: "#0F141A"),
        panelBackground: NSColor(hex: "#1A2026"),
        cardBackground: NSColor(hex: "#1C2229"),
        elevatedBackground: NSColor(hex: "#38444F"),
        inputBackground: NSColor(hex: "#0F141A"),
        border: NSColor(hex: "#2B343D"),
        strongBorder: NSColor(hex: "#38444F"),
        textPrimary: NSColor(hex: "#ECEFF2"),
        textSecondary: NSColor(hex: "#D5D8DB"),
        textTertiary: NSColor(hex: "#8B9095"),
        primary: NSColor(hex: "#6C88EA"),
        primaryStrong: NSColor(hex: "#4A63C9"),
        success: NSColor(hex: "#00BA9D"),
        warning: NSColor(hex: "#5AC041"),
        error: NSColor(hex: "#D40924"),
        rolePM: NSColor(hex: "#6C88EA"),
        roleDeveloper: NSColor(hex: "#BB9AF7"),
        roleQA: NSColor(hex: "#5AC041"),
        human: NSColor(hex: "#D40924")
    )

    private static let lightPalette = ConsoleThemePalette(
        windowBackground: NSColor(hex: "#F7F5EF"),
        sidebarBackground: NSColor(hex: "#E6ECF2"),
        panelBackground: NSColor(hex: "#FDFCF8"),
        cardBackground: NSColor(hex: "#FDFCF8"),
        elevatedBackground: NSColor(hex: "#DDE6EE"),
        inputBackground: NSColor(hex: "#EEF2F7"),
        border: NSColor(hex: "#C9CED4"),
        strongBorder: NSColor(hex: "#D3D8DE"),
        textPrimary: NSColor(hex: "#1C2229"),
        textSecondary: NSColor(hex: "#282F35"),
        textTertiary: NSColor(hex: "#5D646C"),
        primary: NSColor(hex: "#3245B7"),
        primaryStrong: NSColor(hex: "#4761E4"),
        success: NSColor(hex: "#007A85"),
        warning: NSColor(hex: "#009C3F"),
        error: NSColor(hex: "#D40924"),
        rolePM: NSColor(hex: "#3245B7"),
        roleDeveloper: NSColor(hex: "#A632BF"),
        roleQA: NSColor(hex: "#009C3F"),
        human: NSColor(hex: "#D40924")
    )
}
