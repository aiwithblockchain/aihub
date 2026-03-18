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
        windowBackground: NSColor(hex: "#1E1E1E"),
        sidebarBackground: NSColor(hex: "#232325"),
        panelBackground: NSColor(hex: "#252527"),
        cardBackground: NSColor(hex: "#2A2A2D"),
        elevatedBackground: NSColor(hex: "#313136"),
        inputBackground: NSColor(hex: "#252527"),
        border: NSColor(hex: "#38383D"),
        strongBorder: NSColor(hex: "#424248"),
        textPrimary: NSColor(hex: "#F3F3F3"),
        textSecondary: NSColor(hex: "#C7C7CC"),
        textTertiary: NSColor(hex: "#8E8E93"),
        primary: NSColor(hex: "#0A84FF"),
        primaryStrong: NSColor(hex: "#409CFF"),
        success: NSColor(hex: "#00BA9D"),
        warning: NSColor(hex: "#5AC041"),
        error: NSColor(hex: "#D40924"),
        rolePM: NSColor(hex: "#0A84FF"),
        roleDeveloper: NSColor(hex: "#BB9AF7"),
        roleQA: NSColor(hex: "#5AC041"),
        human: NSColor(hex: "#D40924")
    )

    private static let lightPalette = ConsoleThemePalette(
        windowBackground: NSColor(hex: "#F5F5F5"),
        sidebarBackground: NSColor(hex: "#EFEFF1"),
        panelBackground: NSColor(hex: "#F7F7F8"),
        cardBackground: NSColor(hex: "#FFFFFF"),
        elevatedBackground: NSColor(hex: "#E8E8EB"),
        inputBackground: NSColor(hex: "#FFFFFF"),
        border: NSColor(hex: "#D6D6DB"),
        strongBorder: NSColor(hex: "#C9C9CF"),
        textPrimary: NSColor(hex: "#1F1F24"),
        textSecondary: NSColor(hex: "#55555C"),
        textTertiary: NSColor(hex: "#7C7C84"),
        primary: NSColor(hex: "#007AFF"),
        primaryStrong: NSColor(hex: "#005ECF"),
        success: NSColor(hex: "#007A85"),
        warning: NSColor(hex: "#009C3F"),
        error: NSColor(hex: "#D40924"),
        rolePM: NSColor(hex: "#007AFF"),
        roleDeveloper: NSColor(hex: "#A632BF"),
        roleQA: NSColor(hex: "#009C3F"),
        human: NSColor(hex: "#D40924")
    )
}
