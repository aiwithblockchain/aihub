import AppKit

enum DS {
    // ── 间距 ─────────────────────────────────────
    static let spacingXS: CGFloat  = 4
    static let spacingS:  CGFloat  = 8
    static let spacingM:  CGFloat  = 16
    static let spacingL:  CGFloat  = 24
    static let spacingXL: CGFloat  = 40

    // ── 圆角 ─────────────────────────────────────
    static let radiusS:   CGFloat  = 6
    static let radiusM:   CGFloat  = 10
    static let radiusL:   CGFloat  = 14

    // ── 字体 ─────────────────────────────────────
    static let fontTitle   = NSFont.systemFont(ofSize: 20, weight: .bold)
    static let fontSection = NSFont.systemFont(ofSize: 12, weight: .semibold)
    static let fontBody    = NSFont.systemFont(ofSize: 13, weight: .regular)
    static let fontCaption = NSFont.systemFont(ofSize: 11, weight: .regular)
    static let fontMono    = NSFont.monospacedSystemFont(ofSize: 12, weight: .regular)

    // ── 颜色（全部使用语义色，自动适配 dark mode）────
    static let colorPrimary      = NSColor.controlAccentColor
    static let colorSuccess      = NSColor.systemGreen
    static let colorWarning      = NSColor.systemOrange
    static let colorDanger       = NSColor.systemRed
    static let colorSurface      = NSColor.controlBackgroundColor
    static let colorBackground   = NSColor.windowBackgroundColor
    static let colorBorder       = NSColor.separatorColor
    static let colorTextPrimary  = NSColor.labelColor
    static let colorTextSecond   = NSColor.secondaryLabelColor
    static let colorTextTertiary = NSColor.tertiaryLabelColor

    // ── 状态点颜色 ────────────────────────────────
    static let dotConnected  = NSColor.systemGreen
    static let dotConnecting = NSColor.systemOrange
    static let dotOffline    = NSColor.systemGray

    // ── 通用组件工厂 ────────────────────────────────
    @available(macOS 11.0, *)
    static func makeSectionHeader(_ title: String) -> NSView {
        let label = NSTextField(labelWithString: title.uppercased())
        label.font = DS.fontSection
        label.textColor = DS.colorTextTertiary
        label.translatesAutoresizingMaskIntoConstraints = false

        let line = NSBox()
        line.boxType = .separator
        line.translatesAutoresizingMaskIntoConstraints = false

        let container = NSView()
        container.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(label)
        container.addSubview(line)

        NSLayoutConstraint.activate([
            label.topAnchor.constraint(equalTo: container.topAnchor, constant: 8),
            label.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            line.topAnchor.constraint(equalTo: label.bottomAnchor, constant: 4),
            line.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            line.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            line.bottomAnchor.constraint(equalTo: container.bottomAnchor),
        ])
        return container
    }
}
