import AppKit

// MARK: - Common UI Components

// MARK: ConsoleTextField

final class ConsoleTextField: NSTextField {
    override init(frame: NSRect) {
        super.init(frame: frame)
        applyStyle()
    }
    required init?(coder: NSCoder) { fatalError() }

    private func applyStyle() {
        wantsLayer = true
        layer?.cornerRadius = 6
        layer?.backgroundColor = NSColor.consoleZ900.cgColor
        layer?.borderColor    = NSColor.consoleZ700.cgColor
        layer?.borderWidth    = 1
        textColor    = .white
        isBezeled    = false
        focusRingType = .none
    }

    override var placeholderString: String? {
        didSet {
            if let v = placeholderString {
                (cell as? NSTextFieldCell)?.placeholderAttributedString = NSAttributedString(
                    string: v,
                    attributes: [
                        .foregroundColor: NSColor.consoleText3,
                        .font: NSFont.systemFont(ofSize: 12)
                    ]
                )
            }
        }
    }
}

// MARK: ConsoleSendButton

final class ConsoleSendButton: NSButton {
    init() {
        super.init(frame: .zero)
        image = NSImage(systemSymbolName: "paperplane.fill", accessibilityDescription: "发送")
        contentTintColor = .white
        isBordered   = false
        wantsLayer   = true
        layer?.cornerRadius       = 6
        layer?.backgroundColor    = NSColor.consoleBlueDark.cgColor
    }
    required init?(coder: NSCoder) { fatalError() }
}

// MARK: ConsoleStatusDot

final class ConsoleStatusDot: NSView {
    private let dot = NSView()

    init(status: AIAgentStatus) {
        super.init(frame: .zero)
        dot.wantsLayer = true
        dot.layer?.cornerRadius  = 4
        dot.layer?.backgroundColor = status.color.cgColor
        dot.translatesAutoresizingMaskIntoConstraints = false
        addSubview(dot)
        NSLayoutConstraint.activate([
            dot.centerXAnchor.constraint(equalTo: centerXAnchor),
            dot.centerYAnchor.constraint(equalTo: centerYAnchor),
            dot.widthAnchor.constraint(equalToConstant: 8),
            dot.heightAnchor.constraint(equalToConstant: 8)
        ])

        if status.hasPulse {
            let anim = CABasicAnimation(keyPath: "opacity")
            anim.fromValue   = 1.0
            anim.toValue     = 0.3
            anim.duration    = 1.0
            anim.autoreverses = true
            anim.repeatCount  = .infinity
            dot.layer?.add(anim, forKey: "pulse")
        }
    }
    required init?(coder: NSCoder) { fatalError() }
}

// MARK: ConsoleProgressBar

final class ConsoleProgressBar: NSView {
    private let fill = NSView()
    private var progressConstraint: NSLayoutConstraint?

    var progress: Double = 0 {
        didSet { updateFill() }
    }

    override init(frame: NSRect) {
        super.init(frame: frame)
        wantsLayer = true
        layer?.cornerRadius       = 4
        layer?.backgroundColor    = NSColor.consoleZ800.cgColor

        fill.wantsLayer = true
        fill.layer?.cornerRadius  = 4
        fill.translatesAutoresizingMaskIntoConstraints = false
        addSubview(fill)

        let grad = CAGradientLayer()
        grad.colors      = [NSColor.consoleBlue.cgColor, NSColor(hex: "#06B6D4").cgColor]
        grad.startPoint  = CGPoint(x: 0, y: 0.5)
        grad.endPoint    = CGPoint(x: 1, y: 0.5)
        grad.cornerRadius = 4
        fill.layer?.addSublayer(grad)

        NSLayoutConstraint.activate([
            fill.topAnchor.constraint(equalTo: topAnchor),
            fill.leadingAnchor.constraint(equalTo: leadingAnchor),
            fill.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
        progressConstraint = fill.widthAnchor.constraint(equalTo: widthAnchor, multiplier: 0)
        progressConstraint?.isActive = true
    }
    required init?(coder: NSCoder) { fatalError() }

    override func layout() {
        super.layout()
        fill.layer?.sublayers?.first?.frame = fill.bounds
    }

    private func updateFill() {
        progressConstraint?.isActive = false
        progressConstraint = fill.widthAnchor.constraint(
            equalTo: widthAnchor,
            multiplier: CGFloat(max(0, min(1, progress)))
        )
        progressConstraint?.isActive = true
        needsLayout = true
    }
}

// MARK: ConsoleRoleBadge

final class ConsoleRoleBadge: NSView {
    init(role: AIRole) {
        super.init(frame: .zero)
        wantsLayer = true
        layer?.cornerRadius       = 4
        layer?.backgroundColor    = role.color.withAlphaComponent(0.2).cgColor
        layer?.borderColor        = role.color.withAlphaComponent(0.3).cgColor
        layer?.borderWidth        = 1

        let label = NSTextField(labelWithString: role.label)
        label.font      = .systemFont(ofSize: 11)
        label.textColor = role.color
        label.translatesAutoresizingMaskIntoConstraints = false
        addSubview(label)

        NSLayoutConstraint.activate([
            label.topAnchor.constraint(equalTo: topAnchor, constant: 2),
            label.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -2),
            label.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 6),
            label.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -6)
        ])
    }
    required init?(coder: NSCoder) { fatalError() }
}

// MARK: ConsoleAICard

final class ConsoleAICard: NSView {
    var isSelected: Bool = false {
        didSet {
            layer?.backgroundColor = isSelected ? NSColor.consoleZ800.cgColor : NSColor.clear.cgColor
            layer?.borderColor     = isSelected
                ? NSColor.consoleBlue.withAlphaComponent(0.5).cgColor
                : NSColor.consoleZ800.cgColor
        }
    }
    var onTap: (() -> Void)?

    init(agent: AIAgent) {
        super.init(frame: .zero)
        wantsLayer = true
        layer?.cornerRadius  = 8
        layer?.borderColor   = NSColor.consoleZ800.cgColor
        layer?.borderWidth   = 1

        let iconBox = NSView()
        iconBox.wantsLayer = true
        iconBox.layer?.cornerRadius    = 8
        iconBox.layer?.backgroundColor = NSColor.consoleBlue.withAlphaComponent(0.2).cgColor
        iconBox.layer?.borderColor     = NSColor.consoleBlue.withAlphaComponent(0.3).cgColor
        iconBox.layer?.borderWidth     = 1
        iconBox.translatesAutoresizingMaskIntoConstraints = false
        addSubview(iconBox)

        let icon = NSImageView()
        icon.image = NSImage(systemSymbolName: "brain", accessibilityDescription: nil)
        icon.contentTintColor = NSColor(hex: "#60A5FA")
        icon.translatesAutoresizingMaskIntoConstraints = false
        iconBox.addSubview(icon)

        let name = NSTextField(labelWithString: agent.name)
        name.font      = .systemFont(ofSize: 14, weight: .medium)
        name.textColor = .consoleText
        name.translatesAutoresizingMaskIntoConstraints = false
        addSubview(name)

        let dot = ConsoleStatusDot(status: agent.status)
        dot.translatesAutoresizingMaskIntoConstraints = false
        addSubview(dot)

        let roleTag = ConsoleRoleBadge(role: agent.role)
        roleTag.translatesAutoresizingMaskIntoConstraints = false
        addSubview(roleTag)

        NSLayoutConstraint.activate([
            iconBox.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),
            iconBox.centerYAnchor.constraint(equalTo: centerYAnchor),
            iconBox.widthAnchor.constraint(equalToConstant: 40),
            iconBox.heightAnchor.constraint(equalToConstant: 40),
            icon.centerXAnchor.constraint(equalTo: iconBox.centerXAnchor),
            icon.centerYAnchor.constraint(equalTo: iconBox.centerYAnchor),

            name.topAnchor.constraint(equalTo: iconBox.topAnchor),
            name.leadingAnchor.constraint(equalTo: iconBox.trailingAnchor, constant: 12),

            dot.centerYAnchor.constraint(equalTo: name.centerYAnchor),
            dot.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),

            roleTag.bottomAnchor.constraint(equalTo: iconBox.bottomAnchor),
            roleTag.leadingAnchor.constraint(equalTo: iconBox.trailingAnchor, constant: 12)
        ])
    }
    required init?(coder: NSCoder) { fatalError() }

    override func mouseDown(with event: NSEvent) {
        onTap?()
    }
}
