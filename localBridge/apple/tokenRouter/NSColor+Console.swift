import AppKit

// MARK: - Color Constants
extension NSColor {
    private static var themePalette: ConsoleThemePalette {
        ThemeManager.shared.palette()
    }

    static var consoleZ950: NSColor { themePalette.windowBackground }
    static var consoleZ900: NSColor { themePalette.sidebarBackground }
    static var consoleZ800: NSColor { themePalette.border }
    static var consoleZ700: NSColor { themePalette.strongBorder }

    static var consoleText: NSColor { themePalette.textPrimary }
    static var consoleText2: NSColor { themePalette.textSecondary }
    static var consoleText3: NSColor { themePalette.textTertiary }

    static var consolePM: NSColor { themePalette.rolePM }
    static var consoleDev: NSColor { themePalette.roleDeveloper }
    static var consoleQA: NSColor { themePalette.roleQA }
    static var consoleHuman: NSColor { themePalette.human }

    static var consoleBlue: NSColor { themePalette.primary }
    static var consoleBlueDark: NSColor { themePalette.primaryStrong }
    static var consoleGreen: NSColor { themePalette.success }
    static var consoleYellow: NSColor { themePalette.warning }
    static var consoleRed: NSColor { themePalette.error }

    convenience init(hex: String) {
        var hexSanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        if hexSanitized.hasPrefix("#") {
            hexSanitized.remove(at: hexSanitized.startIndex)
        }
        var rgb: UInt64 = 0
        Scanner(string: hexSanitized).scanHexInt64(&rgb)
        let r = CGFloat((rgb & 0xFF0000) >> 16) / 255.0
        let g = CGFloat((rgb & 0x00FF00) >> 8) / 255.0
        let b = CGFloat(rgb & 0x0000FF) / 255.0
        self.init(red: r, green: g, blue: b, alpha: 1.0)
    }
}
