import AppKit

private enum SharedToastPresenter {
    static let identifier = NSUserInterfaceItemIdentifier("shared-toast-view")
}

enum ToastStyle {
    case success
    case warning
    case error

    var backgroundColor: NSColor {
        switch self {
        case .success:
            return DSV2.tertiary
        case .warning:
            return DSV2.secondary
        case .error:
            return DSV2.error
        }
    }

    var textColor: NSColor {
        .white
    }

    var symbolName: String {
        switch self {
        case .success:
            return "checkmark.circle.fill"
        case .warning:
            return "exclamationmark.triangle.fill"
        case .error:
            return "xmark.octagon.fill"
        }
    }
}

extension NSViewController {
    func showToast(_ message: String, style: ToastStyle = .success, duration: TimeInterval = 2.0) {
        view.subviews
            .filter { $0.identifier == SharedToastPresenter.identifier }
            .forEach { $0.removeFromSuperview() }

        let container = NSView()
        container.identifier = SharedToastPresenter.identifier
        container.wantsLayer = true
        container.layer?.backgroundColor = style.backgroundColor.cgColor
        container.layer?.cornerRadius = 12
        container.layer?.shadowColor = NSColor.black.cgColor
        container.layer?.shadowOpacity = 0.3
        container.layer?.shadowRadius = 10
        container.layer?.shadowOffset = CGSize(width: 0, height: 4)
        container.translatesAutoresizingMaskIntoConstraints = false

        let iconView = NSImageView()
        if #available(macOS 11.0, *) {
            iconView.image = NSImage(systemSymbolName: style.symbolName, accessibilityDescription: message)
            iconView.symbolConfiguration = NSImage.SymbolConfiguration(pointSize: 14, weight: .semibold)
            iconView.contentTintColor = style.textColor
        }
        iconView.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(iconView)

        let label = NSTextField(labelWithString: message)
        label.font = NSFont.systemFont(ofSize: 13, weight: .medium)
        label.textColor = style.textColor
        label.alignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(label)

        view.addSubview(container)

        NSLayoutConstraint.activate([
            iconView.centerYAnchor.constraint(equalTo: container.centerYAnchor),
            iconView.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 14),
            iconView.widthAnchor.constraint(equalToConstant: 16),
            iconView.heightAnchor.constraint(equalToConstant: 16),

            label.centerYAnchor.constraint(equalTo: container.centerYAnchor),
            label.leadingAnchor.constraint(equalTo: iconView.trailingAnchor, constant: 8),
            label.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -16),
            container.heightAnchor.constraint(equalToConstant: 36),
            container.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            container.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -40)
        ])

        container.alphaValue = 0

        NSAnimationContext.runAnimationGroup { context in
            context.duration = 0.3
            context.timingFunction = CAMediaTimingFunction(name: .easeOut)
            container.animator().alphaValue = 1
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + duration) { [weak container] in
            guard let container else { return }
            NSAnimationContext.runAnimationGroup({ context in
                context.duration = 0.3
                context.timingFunction = CAMediaTimingFunction(name: .easeIn)
                container.animator().alphaValue = 0
            }) {
                container.removeFromSuperview()
            }
        }
    }
}
