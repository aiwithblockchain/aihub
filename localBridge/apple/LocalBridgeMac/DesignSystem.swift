import AppKit

enum DS {
    // ── 间距 ─────────────────────────────────────
    static let spacingXS: CGFloat  = 4
    static let spacingS:  CGFloat  = 8
    static let spacingM:  CGFloat  = 16
    static let spacingL:  CGFloat  = 24
    static let spacingXL: CGFloat  = 40

    // ── 圆角（按文档规范）─────────────────────────
    static let radiusButton: CGFloat = 6   // 按钮圆角
    static let radiusInput:  CGFloat = 4   // 输入框圆角
    static let radiusCard:   CGFloat = 8   // 卡片圆角
    static let radiusTag:    CGFloat = 4   // 标签圆角

    // 兼容旧代码
    static let radiusS:   CGFloat  = 6
    static let radiusM:   CGFloat  = 10
    static let radiusL:   CGFloat  = 14

    // ── 尺寸 ─────────────────────────────────────
    static let sidebarWidth: CGFloat = 220  // 左侧边栏固定宽度

    // ── 字体 ─────────────────────────────────────
    static let fontTitle   = NSFont.systemFont(ofSize: 20, weight: .bold)
    static let fontSection = NSFont.systemFont(ofSize: 12, weight: .semibold)
    static let fontBody    = NSFont.systemFont(ofSize: 13, weight: .regular)
    static let fontCaption = NSFont.systemFont(ofSize: 11, weight: .regular)
    static let fontSubtitle = NSFont.systemFont(ofSize: 11, weight: .regular)  // 副标题
    static let fontMono    = NSFont.monospacedSystemFont(ofSize: 12, weight: .regular)

    // ── 颜色（按文档规范）─────────────────────────
    // 主要颜色
    static let colorSidebarBg    = NSColor(hex: "#E8E8E8")  // 左侧边栏背景
    static let colorContentBg    = NSColor(hex: "#FFFFFF")  // 主内容区背景
    static let colorHighlight    = NSColor(hex: "#3B82F6")  // 选中项高亮蓝色
    static let colorPreviewBg    = NSColor(hex: "#1A1A1A")  // 预览区/代码区深色背景

    // 状态颜色
    static let colorOnline       = NSColor.systemGreen      // 在线状态绿点
    static let colorOffline      = NSColor.systemGray       // 离线状态灰点

    // 请求方法颜色
    static let colorGET          = NSColor.systemGreen      // GET 请求绿色
    static let colorPOST         = NSColor.systemOrange     // POST 请求橙色

    // 语义颜色（兼容旧代码）
    static let colorPrimary      = NSColor(hex: "#3B82F6")
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

    // 创建主按钮（蓝色背景）
    static func makePrimaryButton(title: String, target: AnyObject?, action: Selector) -> NSButton {
        let button = NSButton(title: title, target: target, action: action)
        button.bezelStyle = .rounded
        button.contentTintColor = colorHighlight
        button.translatesAutoresizingMaskIntoConstraints = false
        return button
    }

    // 创建次要按钮（白色背景带边框）
    static func makeSecondaryButton(title: String, target: AnyObject?, action: Selector) -> NSButton {
        let button = NSButton(title: title, target: target, action: action)
        button.bezelStyle = .rounded
        button.translatesAutoresizingMaskIntoConstraints = false
        return button
    }

    // 创建状态指示器（绿点/灰点）
    static func makeStatusDot(isActive: Bool) -> NSView {
        let dot = NSView()
        dot.wantsLayer = true
        dot.layer?.backgroundColor = (isActive ? colorOnline : colorOffline).cgColor
        dot.layer?.cornerRadius = 4
        dot.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            dot.widthAnchor.constraint(equalToConstant: 8),
            dot.heightAnchor.constraint(equalToConstant: 8)
        ])
        return dot
    }

    // 创建方法标签（GET/POST）
    static func makeMethodTag(method: String) -> NSView {
        let label = NSTextField(labelWithString: method)
        label.font = DS.fontCaption
        label.textColor = .white
        label.isBordered = false
        label.isEditable = false
        label.drawsBackground = true
        label.alignment = .center
        label.wantsLayer = true
        label.layer?.cornerRadius = radiusTag

        if method == "GET" {
            label.backgroundColor = colorGET
        } else if method == "POST" {
            label.backgroundColor = colorPOST
        }

        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }

    // 创建卡片容器
    static func makeCard() -> NSView {
        let card = NSView()
        card.wantsLayer = true
        card.layer?.backgroundColor = colorContentBg.cgColor
        card.layer?.cornerRadius = radiusCard
        card.layer?.shadowColor = NSColor.black.cgColor
        card.layer?.shadowOpacity = 0.1
        card.layer?.shadowOffset = CGSize(width: 0, height: 2)
        card.layer?.shadowRadius = 4
        card.translatesAutoresizingMaskIntoConstraints = false
        return card
    }
}

// NSColor 扩展：支持十六进制颜色
extension NSColor {
    convenience init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r, g, b: UInt64
        switch hex.count {
        case 6: // RGB (24-bit)
            (r, g, b) = ((int >> 16) & 0xFF, (int >> 8) & 0xFF, int & 0xFF)
        default:
            (r, g, b) = (0, 0, 0)
        }
        self.init(
            red: CGFloat(r) / 255,
            green: CGFloat(g) / 255,
            blue: CGFloat(b) / 255,
            alpha: 1
        )
    }
}
