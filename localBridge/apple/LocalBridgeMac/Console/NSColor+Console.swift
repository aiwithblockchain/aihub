import AppKit

// MARK: - Color Constants
extension NSColor {
    static let consoleZ950 = NSColor(hex: "#09090B")  // 最深背景
    static let consoleZ900 = NSColor(hex: "#18181B")  // 主背景
    static let consoleZ800 = NSColor(hex: "#27272A")  // 次级背景
    static let consoleZ700 = NSColor(hex: "#3F3F46")  // 边框 hover

    static let consoleText  = NSColor(hex: "#FAFAFA")  // 主文字
    static let consoleText2 = NSColor(hex: "#A1A1AA")  // 次级文字
    static let consoleText3 = NSColor(hex: "#71717A")  // 第三级文字

    static let consolePM    = NSColor(hex: "#A855F7")  // 项目经理 紫
    static let consoleDev   = NSColor(hex: "#3B82F6")  // 开发 蓝
    static let consoleQA    = NSColor(hex: "#22C55E")  // 验收 绿
    static let consoleHuman = NSColor(hex: "#F97316")  // 人类 橙

    static let consoleBlue      = NSColor(hex: "#3B82F6")
    static let consoleBlueDark  = NSColor(hex: "#2563EB")
    static let consoleGreen     = NSColor(hex: "#22C55E")
    static let consoleYellow    = NSColor(hex: "#FACC15")
    static let consoleRed       = NSColor(hex: "#EF4444")

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
