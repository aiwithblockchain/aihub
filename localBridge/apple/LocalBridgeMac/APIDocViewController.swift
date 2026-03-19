import AppKit

final class APIDocViewController: NSViewController {

    private let splitView = NSSplitView()
    private let apiListScrollView = NSScrollView()
    private let apiListStackView = NSStackView()
    private let codePreviewScrollView = NSScrollView()
    private var codePreviewTextView: NSTextView!

    private let apiEndpoints: [(method: String, path: String, description: String, code: String)] = [
        ("GET", "/api/status", "查询扩展状态", """
        // 查询扩展状态
        fetch('http://localhost:8080/api/status')
          .then(res => res.json())
          .then(data => console.log(data));
        """),
        ("POST", "/api/tweet/create", "发布推文", """
        // 发布推文
        fetch('http://localhost:8080/api/tweet/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: 'Hello World!'
          })
        });
        """),
        ("GET", "/api/tweet/:id", "获取推文详情", """
        // 获取推文详情
        const tweetId = '1234567890';
        fetch(`http://localhost:8080/api/tweet/${tweetId}`)
          .then(res => res.json())
          .then(data => console.log(data));
        """),
        ("POST", "/api/tweet/like", "点赞推文", """
        // 点赞推文
        fetch('http://localhost:8080/api/tweet/like', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tweetId: '1234567890'
          })
        });
        """),
        ("GET", "/api/ai/tabs", "查询 AI 平台标签页", """
        // 查询 AI 平台标签页
        fetch('http://localhost:8080/api/ai/tabs')
          .then(res => res.json())
          .then(data => console.log(data));
        """),
        ("POST", "/api/ai/message", "发送 AI 消息", """
        // 发送 AI 消息
        fetch('http://localhost:8080/api/ai/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform: 'chatgpt',
            message: 'Hello AI!'
          })
        });
        """)
    ]

    override func loadView() {
        view = NSView()
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        selectFirstAPI()
    }

    private func setupUI() {
        view.wantsLayer = true
        view.layer?.backgroundColor = DS.colorContentBg.cgColor

        // 配置分割视图
        splitView.isVertical = true
        splitView.dividerStyle = .thin
        splitView.translatesAutoresizingMaskIntoConstraints = false

        // 左侧 API 列表
        setupAPIList()

        // 右侧代码预览
        setupCodePreview()

        splitView.addArrangedSubview(apiListScrollView)
        splitView.addArrangedSubview(codePreviewScrollView)

        view.addSubview(splitView)

        NSLayoutConstraint.activate([
            splitView.topAnchor.constraint(equalTo: view.topAnchor),
            splitView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            splitView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            splitView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])

        // 设置分割比例
        splitView.setPosition(300, ofDividerAt: 0)
    }

    private func setupAPIList() {
        apiListStackView.orientation = .vertical
        apiListStackView.alignment = .leading
        apiListStackView.spacing = DS.spacingS
        apiListStackView.edgeInsets = NSEdgeInsets(top: DS.spacingM, left: DS.spacingM, bottom: DS.spacingM, right: DS.spacingM)

        // 添加标题
        let titleLabel = NSTextField(labelWithString: "API 端点")
        titleLabel.font = DS.fontTitle
        titleLabel.textColor = DS.colorTextPrimary
        apiListStackView.addArrangedSubview(titleLabel)

        // 添加分隔线
        let separator = NSBox()
        separator.boxType = .separator
        separator.translatesAutoresizingMaskIntoConstraints = false
        apiListStackView.addArrangedSubview(separator)
        NSLayoutConstraint.activate([
            separator.widthAnchor.constraint(equalTo: apiListStackView.widthAnchor, constant: -2 * DS.spacingM)
        ])

        // 添加 API 卡片
        for (index, endpoint) in apiEndpoints.enumerated() {
            let card = createAPICard(method: endpoint.method, path: endpoint.path, description: endpoint.description, index: index)
            apiListStackView.addArrangedSubview(card)
        }

        apiListScrollView.documentView = apiListStackView
        apiListScrollView.hasVerticalScroller = true
        apiListScrollView.drawsBackground = false
        apiListScrollView.translatesAutoresizingMaskIntoConstraints = false
    }

    private func createAPICard(method: String, path: String, description: String, index: Int) -> NSView {
        let card = NSButton()
        card.isBordered = false
        card.wantsLayer = true
        card.layer?.backgroundColor = DS.colorContentBg.cgColor
        card.layer?.cornerRadius = DS.radiusCard
        card.layer?.borderWidth = 1
        card.layer?.borderColor = DS.colorBorder.cgColor
        card.translatesAutoresizingMaskIntoConstraints = false
        card.tag = index
        card.target = self
        card.action = #selector(apiCardClicked(_:))

        // 方法标签
        let methodLabel = NSTextField(labelWithString: method)
        methodLabel.font = DS.fontCaption
        methodLabel.textColor = .white
        methodLabel.alignment = .center
        methodLabel.isBordered = false
        methodLabel.isEditable = false
        methodLabel.drawsBackground = true
        methodLabel.wantsLayer = true
        methodLabel.layer?.cornerRadius = DS.radiusTag

        if method == "GET" {
            methodLabel.backgroundColor = DS.colorGET
        } else if method == "POST" {
            methodLabel.backgroundColor = DS.colorPOST
        }

        methodLabel.translatesAutoresizingMaskIntoConstraints = false

        // 路径标签
        let pathLabel = NSTextField(labelWithString: path)
        pathLabel.font = DS.fontBody
        pathLabel.textColor = DS.colorTextPrimary
        pathLabel.isBordered = false
        pathLabel.isEditable = false
        pathLabel.drawsBackground = false
        pathLabel.translatesAutoresizingMaskIntoConstraints = false

        // 描述标签
        let descLabel = NSTextField(labelWithString: description)
        descLabel.font = DS.fontCaption
        descLabel.textColor = DS.colorTextSecond
        descLabel.isBordered = false
        descLabel.isEditable = false
        descLabel.drawsBackground = false
        descLabel.translatesAutoresizingMaskIntoConstraints = false

        card.addSubview(methodLabel)
        card.addSubview(pathLabel)
        card.addSubview(descLabel)

        NSLayoutConstraint.activate([
            card.widthAnchor.constraint(equalToConstant: 268),
            card.heightAnchor.constraint(equalToConstant: 80),

            methodLabel.topAnchor.constraint(equalTo: card.topAnchor, constant: DS.spacingS),
            methodLabel.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: DS.spacingS),
            methodLabel.widthAnchor.constraint(equalToConstant: 50),
            methodLabel.heightAnchor.constraint(equalToConstant: 18),

            pathLabel.topAnchor.constraint(equalTo: methodLabel.bottomAnchor, constant: DS.spacingS),
            pathLabel.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: DS.spacingS),
            pathLabel.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -DS.spacingS),

            descLabel.topAnchor.constraint(equalTo: pathLabel.bottomAnchor, constant: 4),
            descLabel.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: DS.spacingS),
            descLabel.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -DS.spacingS)
        ])

        return card
    }

    private func setupCodePreview() {
        codePreviewScrollView = NSTextView.scrollableTextView()
        codePreviewTextView = codePreviewScrollView.documentView as? NSTextView

        codePreviewTextView.isEditable = false
        codePreviewTextView.isSelectable = true
        codePreviewTextView.font = DS.fontMono
        codePreviewTextView.textColor = NSColor(red: 0.0, green: 0.9, blue: 0.4, alpha: 1.0)
        codePreviewTextView.backgroundColor = DS.colorPreviewBg
        codePreviewTextView.textContainerInset = NSSize(width: DS.spacingL, height: DS.spacingL)

        codePreviewScrollView.borderType = .noBorder
        codePreviewScrollView.translatesAutoresizingMaskIntoConstraints = false
    }

    @objc private func apiCardClicked(_ sender: NSButton) {
        let index = sender.tag
        guard apiEndpoints.indices.contains(index) else { return }

        let endpoint = apiEndpoints[index]
        codePreviewTextView.string = endpoint.code

        // 高亮选中的卡片
        for case let card as NSButton in apiListStackView.arrangedSubviews where card.tag >= 0 {
            if card.tag == index {
                card.layer?.backgroundColor = DS.colorHighlight.withAlphaComponent(0.1).cgColor
                card.layer?.borderColor = DS.colorHighlight.cgColor
                card.layer?.borderWidth = 2
            } else {
                card.layer?.backgroundColor = DS.colorContentBg.cgColor
                card.layer?.borderColor = DS.colorBorder.cgColor
                card.layer?.borderWidth = 1
            }
        }
    }

    private func selectFirstAPI() {
        if !apiEndpoints.isEmpty {
            codePreviewTextView.string = apiEndpoints[0].code

            // 高亮第一个卡片
            if let firstCard = apiListStackView.arrangedSubviews.first(where: { ($0 as? NSButton)?.tag == 0 }) as? NSButton {
                firstCard.layer?.backgroundColor = DS.colorHighlight.withAlphaComponent(0.1).cgColor
                firstCard.layer?.borderColor = DS.colorHighlight.cgColor
                firstCard.layer?.borderWidth = 2
            }
        }
    }
}
