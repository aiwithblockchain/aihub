import AppKit

/// Design System V2: "The Precise Monolith"
/// 基于 UI 设计师提供的设计规范，实现深色主题的专业开发者工具界面
enum DSV2 {

    // MARK: - Surface Hierarchy (层次化表面)

    /// 终端/代码区域 - 最深层，用于最大化文本对比度
    static let surfaceContainerLowest = NSColor(hex: "#0E0E0E")

    /// 基础层 - 应用的绝对基础背景
    static let surface = NSColor(hex: "#131313")

    /// 侧边栏/导航区域 - 次要上下文
    static let surfaceContainerLow = NSColor(hex: "#1B1B1C")

    /// 活动面板/可操作元素
    static let surfaceContainerHigh = NSColor(hex: "#2A2A2A")

    /// Hover 状态的最高层
    static let surfaceContainerHighest = NSColor(hex: "#323232")

    /// 明亮表面（用于 focus 状态）
    static let surfaceBright = NSColor(hex: "#3A3A3A")
	
    // MARK: - Text Colors (文本颜色)

    /// 主要文本颜色 - 避免使用纯白以减少眼睛疲劳
    static let onSurface = NSColor(hex: "#E5E2E1")

    /// 次要文本颜色
    static let onSurfaceVariant = NSColor(hex: "#C9C5C4")

    /// 三级文本颜色
    static let onSurfaceTertiary = NSColor(hex: "#A0A0A0")

    // MARK: - Primary Colors (主色系)

    /// 主色 - 渐变起点
    static let primary = NSColor(hex: "#AAC7FF")

    /// 主色容器 - 渐变终点
    static let primaryContainer = NSColor(hex: "#3E90FF")

    /// 主色上的文本
    static let onPrimaryContainer = NSColor(hex: "#001D35")

    // MARK: - Semantic Colors (语义色)

    /// 成功/终端绿色 - 针对深色背景优化，对比度 ≥ 7:1
    static let tertiary = NSColor(hex: "#42E355")

    /// 终端成功消息固定色
    static let tertiaryFixed = NSColor(hex: "#42E355")

    /// 警告/信息蓝色
    static let secondary = NSColor(hex: "#68D3FF")

    /// 错误红色
    static let error = NSColor(hex: "#FFB4AB")

    // MARK: - Border & Outline (边框和轮廓)

    /// Ghost Border 基础色
    static let outlineVariant = NSColor(hex: "#4A4A4A")

    /// 表面着色（用于阴影）
    static let surfaceTint = NSColor(hex: "#AAC7FF")

    // MARK: - Spacing (间距系统)

    static let spacing2: CGFloat = 8    // 0.4rem → 8px
    static let spacing4: CGFloat = 16   // 0.9rem → 16px
    static let spacing6: CGFloat = 24   // 1.3rem → 24px
    static let spacing8: CGFloat = 32   // 1.8rem → 32px

    // MARK: - Corner Radius (圆角)

    static let radiusButton: CGFloat = 6    // 按钮
    static let radiusInput: CGFloat = 4     // 输入框
    static let radiusCard: CGFloat = 8      // 卡片
    static let radiusFull: CGFloat = 9999   // 全圆（Chips/Badges）

    // MARK: - Typography (字体)

    static let fontDisplayLg = NSFont.systemFont(ofSize: 32, weight: .bold)
    static let fontDisplayMd = NSFont.systemFont(ofSize: 28, weight: .bold)
    static let fontDisplaySm = NSFont.systemFont(ofSize: 24, weight: .bold)

    static let fontTitleLg = NSFont.systemFont(ofSize: 18, weight: .semibold)
    static let fontTitleMd = NSFont.systemFont(ofSize: 16, weight: .semibold)
    static let fontTitleSm = NSFont.systemFont(ofSize: 14, weight: .semibold)

    static let fontBodyLg = NSFont.systemFont(ofSize: 15, weight: .regular)
    static let fontBodyMd = NSFont.systemFont(ofSize: 13, weight: .regular)
    static let fontBodySm = NSFont.systemFont(ofSize: 12, weight: .regular)

    static let fontLabelLg = NSFont.systemFont(ofSize: 13, weight: .medium)
    static let fontLabelMd = NSFont.systemFont(ofSize: 12, weight: .medium)
    static let fontLabelSm = NSFont.systemFont(ofSize: 11, weight: .medium)

    /// 等宽字体 - 用于终端、日志、代码
    static let fontMonoLg = NSFont.monospacedSystemFont(ofSize: 13, weight: .regular)
    static let fontMonoMd = NSFont.monospacedSystemFont(ofSize: 12, weight: .regular)
    static let fontMonoSm = NSFont.monospacedSystemFont(ofSize: 11, weight: .regular)

    // MARK: - Component Factories (组件工厂)

    /// 创建渐变主按钮
    /// - Parameters:
    ///   - title: 按钮标题
    ///   - target: 目标对象
    ///   - action: 动作选择器
    /// - Returns: 配置好的渐变按钮
    static func makeGradientButton(title: String, target: AnyObject?, action: Selector) -> NSButton {
        let button = NSButton(title: title, target: target, action: action)
        button.wantsLayer = true
        button.isBordered = false
        button.bezelStyle = .rounded

        // 创建渐变层
        let gradientLayer = CAGradientLayer()
        gradientLayer.colors = [
            primary.cgColor,
            primaryContainer.cgColor
        ]
        // 135度角 = 从左上到右下
        gradientLayer.startPoint = CGPoint(x: 0, y: 0)
        gradientLayer.endPoint = CGPoint(x: 1, y: 1)
        gradientLayer.cornerRadius = radiusButton

        button.layer?.insertSublayer(gradientLayer, at: 0)

        // 文本样式
        let attributes: [NSAttributedString.Key: Any] = [
            .foregroundColor: onPrimaryContainer,
            .font: fontLabelMd
        ]
        button.attributedTitle = NSAttributedString(string: title, attributes: attributes)

        button.translatesAutoresizingMaskIntoConstraints = false

        // 更新渐变层大小
        DispatchQueue.main.async {
            gradientLayer.frame = button.bounds
        }

        return button
    }

    /// 创建次要按钮（Ghost Border 样式）
    static func makeSecondaryButton(title: String, target: AnyObject?, action: Selector) -> NSButton {
        let button = NSButton(title: title, target: target, action: action)
        button.wantsLayer = true
        button.isBordered = false
        button.bezelStyle = .rounded

        // Ghost Border
        button.layer?.borderWidth = 1
        button.layer?.borderColor = outlineVariant.withAlphaComponent(0.15).cgColor
        button.layer?.cornerRadius = radiusButton
        button.layer?.backgroundColor = NSColor.clear.cgColor

        // 文本样式
        let attributes: [NSAttributedString.Key: Any] = [
            .foregroundColor: onSurface,
            .font: fontLabelMd
        ]
        button.attributedTitle = NSAttributedString(string: title, attributes: attributes)

        button.translatesAutoresizingMaskIntoConstraints = false

        return button
    }

    /// 创建终端风格文本视图
    static func makeTerminalTextView() -> (scrollView: NSScrollView, textView: NSTextView) {
        let scrollView = NSTextView.scrollableTextView()
        guard let textView = scrollView.documentView as? NSTextView else {
            fatalError("Failed to create text view")
        }

        textView.isEditable = false
        textView.isSelectable = true
        textView.font = fontMonoMd
        textView.textColor = tertiary
        textView.backgroundColor = surfaceContainerLowest
        textView.textContainerInset = NSSize(width: spacing4, height: spacing4)

        scrollView.borderType = .noBorder
        scrollView.wantsLayer = true
        scrollView.layer?.cornerRadius = radiusCard
        scrollView.layer?.backgroundColor = surfaceContainerLowest.cgColor
        scrollView.translatesAutoresizingMaskIntoConstraints = false

        return (scrollView, textView)
    }

    /// 创建 Ghost Border 容器视图
    static func makeGhostBorderView() -> NSView {
        let view = NSView()
        view.wantsLayer = true
        view.layer?.borderWidth = 1
        view.layer?.borderColor = outlineVariant.withAlphaComponent(0.15).cgColor
        view.layer?.cornerRadius = radiusInput
        view.layer?.backgroundColor = surface.cgColor
        view.translatesAutoresizingMaskIntoConstraints = false
        return view
    }

    /// 创建玻璃效果卡片
    static func makeGlassCard() -> NSView {
        let card = NSView()
        card.wantsLayer = true
        card.layer?.backgroundColor = surfaceContainerHigh.cgColor
        card.layer?.cornerRadius = radiusCard

        // 不在"坐着"的组件上加阴影 - 仅浮动元素使用
        // 如果需要浮动效果，调用 addFloatingShadow(to:)

        card.translatesAutoresizingMaskIntoConstraints = false
        return card
    }

    /// 为浮动元素添加阴影（仅用于 modals/dropdowns）
    static func addFloatingShadow(to view: NSView) {
        guard let layer = view.layer else { return }

        // 双阶段阴影
        layer.shadowColor = surfaceTint.cgColor
        layer.shadowOpacity = 0.08
        layer.shadowOffset = CGSize(width: 0, height: 12)
        layer.shadowRadius = 24

        // 添加第二层阴影需要额外的 sublayer
        let innerShadow = CALayer()
        innerShadow.shadowColor = onSurface.cgColor
        innerShadow.shadowOpacity = 0.04
        innerShadow.shadowOffset = CGSize(width: 0, height: 4)
        innerShadow.shadowRadius = 6
        layer.addSublayer(innerShadow)
    }

    /// 创建 Chip/Badge
    static func makeChip(text: String) -> NSView {
        let label = NSTextField(labelWithString: text)
        label.font = fontLabelSm
        label.textColor = onSurface
        label.isBordered = false
        label.isEditable = false
        label.drawsBackground = true
        label.wantsLayer = true
        label.backgroundColor = outlineVariant.withAlphaComponent(0.2)
        label.layer?.cornerRadius = 12 // 足够大以形成全圆角
        label.alignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false

        // 添加内边距
        NSLayoutConstraint.activate([
            label.widthAnchor.constraint(greaterThanOrEqualToConstant: 60),
            label.heightAnchor.constraint(equalToConstant: 24)
        ])

        return label
    }

    /// 创建状态指示点
    static func makeStatusDot(isActive: Bool) -> NSView {
        let dot = NSView()
        dot.wantsLayer = true
        dot.layer?.backgroundColor = (isActive ? tertiary : onSurfaceTertiary).cgColor
        dot.layer?.cornerRadius = 4
        dot.translatesAutoresizingMaskIntoConstraints = false

        NSLayoutConstraint.activate([
            dot.widthAnchor.constraint(equalToConstant: 8),
            dot.heightAnchor.constraint(equalToConstant: 8)
        ])

        return dot
    }

    /// 创建方法标签（GET/POST）
    static func makeMethodTag(method: String) -> NSView {
        let label = NSTextField(labelWithString: method)
        label.font = fontLabelSm
        label.textColor = onSurface
        label.isBordered = false
        label.isEditable = false
        label.drawsBackground = true
        label.wantsLayer = true
        label.alignment = .center
        label.layer?.cornerRadius = radiusInput

        // 根据方法类型设置颜色
        switch method.uppercased() {
        case "GET":
            label.backgroundColor = tertiary
            label.textColor = NSColor.black
        case "POST":
            label.backgroundColor = secondary
            label.textColor = NSColor.black
        default:
            label.backgroundColor = outlineVariant.withAlphaComponent(0.2)
        }

        label.translatesAutoresizingMaskIntoConstraints = false

        NSLayoutConstraint.activate([
            label.widthAnchor.constraint(equalToConstant: 50),
            label.heightAnchor.constraint(equalToConstant: 20)
        ])

        return label
    }
}
