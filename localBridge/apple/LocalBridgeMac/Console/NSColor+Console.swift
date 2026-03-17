import AppKit

// MARK: - Color Constants
extension NSColor {
    static let consoleZ950 = NSColor(hex: "#FFFFFF")  // 最浅背景 (Editor/Main)
    static let consoleZ900 = NSColor(hex: "#F3F3F3")  // 主背景 (Sidebar/Bars)
    static let consoleZ800 = NSColor(hex: "#E5E5E5")  // 次级背景/选中
    static let consoleZ700 = NSColor(hex: "#D4D4D4")  // 边框/分割线

    static let consoleText  = NSColor(hex: "#1E1E1E")  // 主文字 (深灰)
    static let consoleText2 = NSColor(hex: "#616161")  // 次级文字
    static let consoleText3 = NSColor(hex: "#767676")  // 第三级文字

    static let consolePM    = NSColor(hex: "#005FB8")  // VS Blue Accent
    static let consoleDev   = NSColor(hex: "#0550AE")  // Darker Blue
    static let consoleQA    = NSColor(hex: "#22863A")  // VS Green
    static let consoleHuman = NSColor(hex: "#E51400")  // VS Red/Human

    static let consoleBlue      = NSColor(hex: "#007ACC")  // VS Signature Blue
    static let consoleBlueDark  = NSColor(hex: "#005FB8")
    static let consoleGreen     = NSColor(hex: "#22863A")
    static let consoleYellow    = NSColor(hex: "#AD5D00")
    static let consoleRed       = NSColor(hex: "#E51400")

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
