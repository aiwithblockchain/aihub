import AppKit

// MARK: - Color Constants
extension NSColor {
    static let consoleZ950 = NSColor(hex: "#0D0B10")  // 最深背景 (Main Surface)
    static let consoleZ900 = NSColor(hex: "#16161E")  // 侧边栏背景
    static let consoleZ800 = NSColor(hex: "#1F1F2E")  // 选中状态/悬停
    static let consoleZ700 = NSColor(hex: "#2D2D3D")  // 边框/分割线

    static let consoleText  = NSColor(hex: "#E0E0E6")  // 主文字
    static let consoleText2 = NSColor(hex: "#9E9EAF")  // 次级文字
    static let consoleText3 = NSColor(hex: "#6E6E80")  // 第三级文字

    static let consolePM    = NSColor(hex: "#7AA2F7")  // Blue Accent
    static let consoleDev   = NSColor(hex: "#BB9AF7")  // Purple Accent
    static let consoleQA    = NSColor(hex: "#9ECE6A")  // Green Accent
    static let consoleHuman = NSColor(hex: "#F7768E")  // Red Accent

    static let consoleBlue      = NSColor(hex: "#7AA2F7")  // Primary Blue
    static let consoleBlueDark  = NSColor(hex: "#3D59A1")
    static let consoleGreen     = NSColor(hex: "#9ECE6A")
    static let consoleYellow    = NSColor(hex: "#E0AF68")
    static let consoleRed       = NSColor(hex: "#F7768E")

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
