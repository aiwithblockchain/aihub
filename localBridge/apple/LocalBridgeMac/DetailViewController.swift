import AppKit

final class DetailViewController: NSViewController {
    private let titleLabel = NSTextField(labelWithString: "LocalBridge")
    private let subtitleLabel = NSTextField(labelWithString: "选择左侧会话查看内容")
    private let previewLabel = NSTextField(wrappingLabelWithString: "")

    override func loadView() {
        view = NSView()
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        configureView()
        configureLayout()
    }

    func display(conversation: Conversation) {
        titleLabel.stringValue = conversation.title
        subtitleLabel.stringValue = conversation.subtitle
        previewLabel.stringValue = conversation.preview
    }
}

private extension DetailViewController {
    func configureView() {
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor.controlBackgroundColor.cgColor

        titleLabel.font = .systemFont(ofSize: 24, weight: .semibold)

        subtitleLabel.font = .systemFont(ofSize: 13, weight: .medium)
        subtitleLabel.textColor = .secondaryLabelColor

        previewLabel.font = .systemFont(ofSize: 15)
        previewLabel.maximumNumberOfLines = 0
        previewLabel.textColor = .labelColor
    }

    func configureLayout() {
        let contentCard = NSView()
        contentCard.translatesAutoresizingMaskIntoConstraints = false
        contentCard.wantsLayer = true
        contentCard.layer?.backgroundColor = NSColor.windowBackgroundColor.cgColor
        contentCard.layer?.cornerRadius = 18

        let stackView = NSStackView(views: [titleLabel, subtitleLabel, previewLabel])
        stackView.translatesAutoresizingMaskIntoConstraints = false
        stackView.orientation = .vertical
        stackView.alignment = .leading
        stackView.spacing = 14

        contentCard.addSubview(stackView)
        view.addSubview(contentCard)

        NSLayoutConstraint.activate([
            contentCard.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 28),
            contentCard.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -28),
            contentCard.topAnchor.constraint(equalTo: view.topAnchor, constant: 28),
            contentCard.bottomAnchor.constraint(lessThanOrEqualTo: view.bottomAnchor, constant: -28),

            stackView.leadingAnchor.constraint(equalTo: contentCard.leadingAnchor, constant: 24),
            stackView.trailingAnchor.constraint(equalTo: contentCard.trailingAnchor, constant: -24),
            stackView.topAnchor.constraint(equalTo: contentCard.topAnchor, constant: 24),
            stackView.bottomAnchor.constraint(equalTo: contentCard.bottomAnchor, constant: -24),
        ])
    }
}
