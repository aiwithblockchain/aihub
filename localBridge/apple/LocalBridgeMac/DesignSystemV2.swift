import AppKit

/// Design System V2: "The Precise Monolith"
/// 基于 UI 设计师提供的设计规范，实现深色主题的专业开发者工具界面
enum DSV2 {

    // MARK: - Surface Hierarchy (层次化表面)

    /// 页面级暖色背景
    static var pageBackground: NSColor {
        ThemeManager.shared.isDarkMode ? NSColor(hex: "#151515") : NSColor(hex: "#E1E2E0")
    }

    /// 终端/代码区域 - 最深层，用于最大化文本对比度
    static var surfaceContainerLowest: NSColor {
        ThemeManager.shared.isDarkMode ? NSColor(hex: "#0E0E0E") : NSColor(hex: "#F1F1EC")
    }

    /// 基础层 - 应用的绝对基础背景
    static var surface: NSColor {
        ThemeManager.shared.isDarkMode ? NSColor(hex: "#131313") : NSColor(hex: "#F7F7F3")
    }

    /// 侧边栏/导航区域 - 次要上下文
    static var surfaceContainerLow: NSColor {
        ThemeManager.shared.isDarkMode ? NSColor(hex: "#1E1E1E") : NSColor(hex: "#F4F3EE")
    }

    /// 活动面板/可操作元素
    static var surfaceContainerHigh: NSColor {
        ThemeManager.shared.isDarkMode ? NSColor(hex: "#2A2A2A") : NSColor(hex: "#FCFCF8")
    }

    /// Hover / Selected 的柔和高亮层
    static var surfaceContainerHighest: NSColor {
        ThemeManager.shared.isDarkMode ? NSColor(hex: "#323232") : NSColor(hex: "#FFF1EC")
    }

    /// 明亮表面（用于 focus 状态）
    static var surfaceBright: NSColor {
        ThemeManager.shared.isDarkMode ? NSColor(hex: "#3A3A3A") : NSColor(hex: "#FFFFFF")
    }

    static var cardBorder: NSColor {
        ThemeManager.shared.isDarkMode ? NSColor(hex: "#4A4A4A") : NSColor(hex: "#D0D0CB")
    }

    static var softAccentFill: NSColor {
        ThemeManager.shared.isDarkMode ? primary.withAlphaComponent(0.18) : NSColor(hex: "#FFF1EC")
    }

    static var divider: NSColor {
        ThemeManager.shared.isDarkMode ? NSColor(hex: "#343434") : NSColor(hex: "#D7D6D1")
    }

    static var subtleShadow: NSColor {
        ThemeManager.shared.isDarkMode ? NSColor.black.withAlphaComponent(0.24) : NSColor.black.withAlphaComponent(0.06)
    }

    // MARK: - Text Colors (文本颜色)

    /// 主要文本颜色 - 避免使用纯白以减少眼睛疲劳
    static var onSurface: NSColor {
        ThemeManager.shared.isDarkMode ? NSColor(hex: "#E5E2E1") : NSColor(hex: "#1F1F1F")
    }

    /// 次要文本颜色
    static var onSurfaceVariant: NSColor {
        ThemeManager.shared.isDarkMode ? NSColor(hex: "#C9C5C4") : NSColor(hex: "#5F5F5F")
    }

    /// 三级文本颜色
    static var onSurfaceTertiary: NSColor {
        ThemeManager.shared.isDarkMode ? NSColor(hex: "#A0A0A0") : NSColor(hex: "#8A8A83")
    }

    // MARK: - Primary Colors (主色系)

    /// 主色 - 极简暖橙强调色
    static var primary: NSColor {
        ThemeManager.shared.isDarkMode ? NSColor(hex: "#FF8A6B") : NSColor(hex: "#F5451E")
    }

    /// 主色容器 - hover / secondary CTA 背景
    static var primaryContainer: NSColor {
        ThemeManager.shared.isDarkMode ? NSColor(hex: "#B43E26") : NSColor(hex: "#FFE0D6")
    }

    /// 主色上的文本
    static var onPrimaryContainer: NSColor {
        ThemeManager.shared.isDarkMode ? NSColor(hex: "#FFF1EC") : NSColor(hex: "#7A210D")
    }

    static var primaryHover: NSColor {
        ThemeManager.shared.isDarkMode ? NSColor(hex: "#FF9B80") : NSColor(hex: "#DA3C17")
    }

    // MARK: - Semantic Colors (语义色)

    /// 成功/终端绿色 - 针对深色背景优化，对比度 ≥ 7:1
    static var tertiary: NSColor {
        ThemeManager.shared.isDarkMode ? NSColor(hex: "#42E355") : NSColor(hex: "#16A34A")
    }

    /// 终端成功消息固定色
    static var tertiaryFixed: NSColor {
        ThemeManager.shared.isDarkMode ? NSColor(hex: "#42E355") : NSColor(hex: "#16A34A")
    }

    /// 警告/信息蓝色
    static var secondary: NSColor {
        ThemeManager.shared.isDarkMode ? NSColor(hex: "#68D3FF") : NSColor(hex: "#0EA5E9")
    }

    /// 错误红色
    static var error: NSColor {
        ThemeManager.shared.isDarkMode ? NSColor(hex: "#FFB4AB") : NSColor(hex: "#DC2626")
    }

    // MARK: - Border & Outline (边框和轮廓)

    /// Ghost Border 基础色
    static var outlineVariant: NSColor {
        ThemeManager.shared.isDarkMode ? NSColor(hex: "#4A4A4A") : NSColor(hex: "#D4D4D4")
    }

    /// 表面着色（用于阴影）
    static var surfaceTint: NSColor {
        ThemeManager.shared.isDarkMode ? NSColor(hex: "#FF8A6B") : primary
    }

    // MARK: - Spacing (间距系统)

    static let spacing2: CGFloat = 8    // 0.4rem → 8px
    static let spacing4: CGFloat = 16   // 0.9rem → 16px
    static let spacing6: CGFloat = 24   // 1.3rem → 24px
    static let spacing8: CGFloat = 32   // 1.8rem → 32px
    static let spacing10: CGFloat = 40  // 更宽松的极简布局

    // MARK: - Corner Radius (圆角)

    static let radiusButton: CGFloat = 12   // 按钮
    static let radiusInput: CGFloat = 10    // 输入框
    static let radiusCard: CGFloat = 16     // 卡片
    static let radiusContainer: CGFloat = 24 // 大容器
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

        button.layer?.backgroundColor = primary.cgColor
        button.layer?.cornerRadius = radiusButton
        button.layer?.shadowColor = subtleShadow.cgColor
        button.layer?.shadowOpacity = ThemeManager.shared.isDarkMode ? 0.0 : 1.0
        button.layer?.shadowRadius = 10
        button.layer?.shadowOffset = CGSize(width: 0, height: 4)

        let attributes: [NSAttributedString.Key: Any] = [
            .foregroundColor: NSColor.white,
            .font: fontLabelMd
        ]
        button.attributedTitle = NSAttributedString(string: title, attributes: attributes)

        button.translatesAutoresizingMaskIntoConstraints = false
        button.heightAnchor.constraint(equalToConstant: 38).isActive = true

        return button
    }

    /// 创建次要按钮（Ghost Border 样式）
    static func makeSecondaryButton(title: String, target: AnyObject?, action: Selector) -> NSButton {
        let button = NSButton(title: title, target: target, action: action)
        button.wantsLayer = true
        button.isBordered = false
        button.bezelStyle = .rounded

        button.layer?.borderWidth = 1
        button.layer?.borderColor = cardBorder.cgColor
        button.layer?.cornerRadius = radiusButton
        button.layer?.backgroundColor = surfaceBright.cgColor

        let attributes: [NSAttributedString.Key: Any] = [
            .foregroundColor: onSurface,
            .font: fontLabelMd
        ]
        button.attributedTitle = NSAttributedString(string: title, attributes: attributes)

        button.translatesAutoresizingMaskIntoConstraints = false
        button.heightAnchor.constraint(equalToConstant: 38).isActive = true

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
        textView.textColor = onSurface
        textView.backgroundColor = surfaceContainerLowest
        textView.textContainerInset = NSSize(width: spacing4, height: spacing4)

        scrollView.borderType = .noBorder
        scrollView.wantsLayer = true
        scrollView.layer?.cornerRadius = radiusCard
        scrollView.layer?.backgroundColor = surfaceContainerLowest.cgColor
        scrollView.layer?.borderWidth = 1
        scrollView.layer?.borderColor = cardBorder.cgColor
        scrollView.translatesAutoresizingMaskIntoConstraints = false

        applyBrightScroller(to: scrollView)

        return (scrollView, textView)
    }

    /// 将亮色滚动条应用到指定的 NSScrollView
    static func applyBrightScroller(to scrollView: NSScrollView) {
        let scroller = BrightScroller()
        scrollView.verticalScroller = scroller
        scrollView.hasVerticalScroller = true
        scrollView.autohidesScrollers = false // 强制显示以增加可见性
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
        let label = NSTextField(labelWithString: method.uppercased())
        label.font = fontLabelSm
        label.isBordered = false
        label.isEditable = false
        label.drawsBackground = true
        label.wantsLayer = true
        label.alignment = .center
        label.layer?.cornerRadius = radiusFull
        label.layer?.masksToBounds = true

        switch method.uppercased() {
        case "GET":
            label.backgroundColor = softAccentFill
            label.textColor = primary
        case "POST":
            label.backgroundColor = primaryContainer
            label.textColor = onPrimaryContainer
        case "PUT", "PATCH":
            label.backgroundColor = surfaceContainerLow
            label.textColor = primary
        case "DELETE":
            label.backgroundColor = error.withAlphaComponent(0.12)
            label.textColor = error
        default:
            label.backgroundColor = surfaceContainerLow
            label.textColor = onSurfaceVariant
        }

        label.translatesAutoresizingMaskIntoConstraints = false

        NSLayoutConstraint.activate([
            label.widthAnchor.constraint(greaterThanOrEqualToConstant: 54),
            label.heightAnchor.constraint(equalToConstant: 22)
        ])

        return label
    }

    /// 创建分段控制器
    static func makeSegmentedControl(items: [String], target: AnyObject?, action: Selector) -> SegmentedControl {
        return SegmentedControl(items: items, target: target, action: action)
    }

    /// 创建实例选择器下拉菜单
    static func makeInstanceSelector(title: String, target: AnyObject?, action: Selector) -> InstanceSelector {
        return InstanceSelector(title: title, target: target, action: action)
    }
}

/// 实例选择器下拉组件
class InstanceSelector: NSView {
    private let titleLabel = NSTextField(labelWithString: "")
    private let idLabel = NSTextField(labelWithString: "")
    private let dropdownButton = NSButton()
    private var instances: [(id: String, name: String?, isTemporary: Bool)] = []
    private var selectedIndex: Int = 0
    private let target: AnyObject?
    private let action: Selector

    init(title: String, target: AnyObject?, action: Selector) {
        self.target = target
        self.action = action
        super.init(frame: .zero)
        setupUI(title: title)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func setupUI(title: String) {
        wantsLayer = true
        translatesAutoresizingMaskIntoConstraints = false

        titleLabel.stringValue = title.uppercased()
        titleLabel.font = DSV2.fontLabelSm
        titleLabel.textColor = DSV2.onSurfaceTertiary
        titleLabel.translatesAutoresizingMaskIntoConstraints = false

        idLabel.font = DSV2.fontMonoSm
        idLabel.textColor = DSV2.onSurface
        idLabel.translatesAutoresizingMaskIntoConstraints = false

        dropdownButton.title = ""
        dropdownButton.bezelStyle = .rounded
        dropdownButton.isBordered = false
        dropdownButton.wantsLayer = true
        dropdownButton.target = self
        dropdownButton.action = #selector(showDropdown)
        dropdownButton.layer?.backgroundColor = NSColor.clear.cgColor

        if #available(macOS 11.0, *) {
            dropdownButton.image = NSImage(systemSymbolName: "chevron.down", accessibilityDescription: nil)
            dropdownButton.imagePosition = .imageOnly
            dropdownButton.contentTintColor = DSV2.onSurfaceVariant
        }

        dropdownButton.translatesAutoresizingMaskIntoConstraints = false

        addSubview(titleLabel)
        addSubview(idLabel)
        addSubview(dropdownButton)

        NSLayoutConstraint.activate([
            titleLabel.topAnchor.constraint(equalTo: topAnchor),
            titleLabel.leadingAnchor.constraint(equalTo: leadingAnchor),

            dropdownButton.centerYAnchor.constraint(equalTo: titleLabel.centerYAnchor),
            dropdownButton.leadingAnchor.constraint(equalTo: titleLabel.trailingAnchor, constant: 4),
            dropdownButton.trailingAnchor.constraint(equalTo: trailingAnchor),
            dropdownButton.widthAnchor.constraint(equalToConstant: 20),
            dropdownButton.heightAnchor.constraint(equalToConstant: 20),

            idLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 2),
            idLabel.leadingAnchor.constraint(equalTo: leadingAnchor),
            idLabel.trailingAnchor.constraint(equalTo: trailingAnchor),
            idLabel.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
    }

    @objc private func showDropdown() {
        guard !instances.isEmpty else { return }

        let menu = NSMenu()
        for (index, instance) in instances.enumerated() {
            let displayName = instance.name ?? instance.id
            let title = instance.isTemporary ? "\(displayName) (legacy)" : displayName
            let item = NSMenuItem(title: title, action: #selector(selectInstance(_:)), keyEquivalent: "")
            item.target = self
            item.tag = index
            item.state = index == selectedIndex ? .on : .off
            menu.addItem(item)
        }

        let location = NSPoint(x: 0, y: bounds.height)
        menu.popUp(positioning: nil, at: location, in: self)
    }

    @objc private func selectInstance(_ sender: NSMenuItem) {
        selectedIndex = sender.tag
        updateDisplay()
        _ = target?.perform(action, with: self)
    }

    func setInstances(_ instances: [(id: String, name: String?, isTemporary: Bool)]) {
        self.instances = instances
        if !instances.isEmpty && selectedIndex >= instances.count {
            selectedIndex = 0
        }
        updateDisplay()
    }

    func getSelectedInstanceId() -> String? {
        guard !instances.isEmpty && selectedIndex < instances.count else { return nil }
        return instances[selectedIndex].id
    }

    private func updateDisplay() {
        if instances.isEmpty {
            idLabel.stringValue = "No instance available"
        } else {
            let instance = instances[selectedIndex]
            let displayName = instance.name ?? instance.id
            idLabel.stringValue = instance.isTemporary ? "\(displayName) (legacy)" : displayName
        }
    }
}

/// 自定义分段控制器
class SegmentedControl: NSView {
    private var buttons: [NSButton] = []
    private var selectedIndex: Int = 0
    private let target: AnyObject?
    private let action: Selector

    init(items: [String], target: AnyObject?, action: Selector) {
        self.target = target
        self.action = action
        super.init(frame: .zero)
        setupButtons(items: items)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func setupButtons(items: [String]) {
        let stackView = NSStackView()
        stackView.orientation = .horizontal
        stackView.spacing = 0
        stackView.distribution = .fillEqually
        stackView.translatesAutoresizingMaskIntoConstraints = false

        for (index, item) in items.enumerated() {
            let button = NSButton(title: item, target: self, action: #selector(buttonClicked(_:)))
            button.tag = index
            button.wantsLayer = true
            button.isBordered = false
            button.bezelStyle = .rounded

            let attributes: [NSAttributedString.Key: Any] = [
                .foregroundColor: DSV2.onSurface,
                .font: DSV2.fontLabelMd
            ]
            button.attributedTitle = NSAttributedString(string: item, attributes: attributes)

            button.layer?.backgroundColor = NSColor.clear.cgColor
            button.translatesAutoresizingMaskIntoConstraints = false
            button.heightAnchor.constraint(equalToConstant: 32).isActive = true

            // CRITICAL: Ensure button can receive mouse events
            button.layer?.masksToBounds = false

            buttons.append(button)
            stackView.addArrangedSubview(button)
        }

        addSubview(stackView)

        NSLayoutConstraint.activate([
            stackView.topAnchor.constraint(equalTo: topAnchor),
            stackView.leadingAnchor.constraint(equalTo: leadingAnchor),
            stackView.trailingAnchor.constraint(equalTo: trailingAnchor),
            stackView.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])

        // 默认选中第一个
        updateSelection(index: 0)
    }

    @objc private func buttonClicked(_ sender: NSButton) {
        updateSelection(index: sender.tag)
        _ = target?.perform(action, with: self)
    }

    private func updateSelection(index: Int) {
        selectedIndex = index

        for (i, button) in buttons.enumerated() {
            let attributes: [NSAttributedString.Key: Any] = [
                .foregroundColor: i == index ? DSV2.onSurface : DSV2.onSurfaceVariant,
                .font: DSV2.fontLabelMd
            ]
            button.attributedTitle = NSAttributedString(string: button.title, attributes: attributes)

            if i == index {
                button.layer?.backgroundColor = DSV2.surfaceContainerHigh.cgColor
                button.layer?.cornerRadius = DSV2.radiusInput
            } else {
                button.layer?.backgroundColor = NSColor.clear.cgColor
                button.layer?.cornerRadius = 0
            }

            // Ensure all buttons remain interactive
            button.isEnabled = true
        }
    }

    func indexOfSelectedItem() -> Int {
        return selectedIndex
    }

    func selectItem(at index: Int) {
        guard index >= 0 && index < buttons.count else { return }
        updateSelection(index: index)
    }

    func titleOfSelectedItem() -> String? {
        guard selectedIndex >= 0 && selectedIndex < buttons.count else { return nil }
        return buttons[selectedIndex].title
    }

    func updateTheme() {
        updateSelection(index: selectedIndex)
    }

    func updateItems(_ newItems: [String]) {
        guard newItems.count == buttons.count else {
            print("Warning: updateItems called with different number of items")
            return
        }

        for (index, button) in buttons.enumerated() {
            let attributes: [NSAttributedString.Key: Any] = [
                .foregroundColor: index == selectedIndex ? DSV2.onSurface : DSV2.onSurfaceVariant,
                .font: DSV2.fontLabelMd
            ]
            button.attributedTitle = NSAttributedString(string: newItems[index], attributes: attributes)
        }
    }
}

// MARK: - Global UI Component
open class PassthroughTextField: NSTextField {
    open override func hitTest(_ point: NSPoint) -> NSView? {
        return nil // 让点击事件直接透传应用到下层视图（如 TableRow）
    }
}

/// 一个点击穿透的通用视图，用于简单的颜色块或图标区域
open class PassthroughView: NSView {
    open override func hitTest(_ point: NSPoint) -> NSView? {
        return nil
    }
}

/// 一个点击穿透的图标视图
open class PassthroughImageView: NSImageView {
    open override func hitTest(_ point: NSPoint) -> NSView? {
        return nil
    }
}

/// 自定义亮色滚动条，提升在深色背景下的可见度
class BrightScroller: NSScroller {
    override func drawKnob() {
        // 只在有内容可滚动时绘制
        guard knobProportion > 0 else { return }
        
        let rect = rect(for: .knob)
        let path = NSBezierPath(roundedRect: rect.insetBy(dx: 2, dy: 0), xRadius: rect.width/2, yRadius: rect.width/2)
        
        // 使用主色调的高亮色
        DSV2.primary.set()
        path.fill()
    }
    
    override func drawKnobSlot(in slotRect: NSRect, highlight flag: Bool) {
        // 背景槽深色处理
        DSV2.surfaceContainerLowest.set()
        slotRect.fill()
        
        // 添加一个极细的边线
        DSV2.outlineVariant.withAlphaComponent(0.1).set()
        let line = NSBezierPath()
        line.move(to: NSPoint(x: slotRect.minX, y: slotRect.minY))
        line.line(to: NSPoint(x: slotRect.minX, y: slotRect.maxY))
        line.lineWidth = 1
        line.stroke()
    }
    
    // 强制使用系统风格但自定义绘制
    override class var isCompatibleWithOverlayScrollers: Bool {
        return false // 禁用 Overlay 风格以确保自定义绘制生效
    }
}
