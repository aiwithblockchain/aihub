import AppKit

final class APIDocViewController: NSViewController {

    private let splitView = NSSplitView()
    private let apiListScrollView = NSScrollView()
    private let apiListStackView = NSStackView()
    private let codePreviewScrollView = NSScrollView()
    private var codePreviewTextView: NSTextView!

    // API 文档数据
    private var apiEndpoints: [[String: Any]] = []
    private var aiAPIEndpoints: [[String: Any]] = []

    override func loadView() {
        view = NSView()
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        // 加载 API 文档
        loadAPIDocumentation()

        setupUI()
        selectFirstAPI()

        // 注册主题变化通知
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleThemeChange),
            name: ThemeManager.themeDidChangeNotification,
            object: nil
        )

        // 注册语言变更通知
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleLanguageChange),
            name: LanguageManager.languageDidChangeNotification,
            object: nil
        )
    }

    @objc private func handleThemeChange() {
        view.needsDisplay = true
    }

    @objc private func handleLanguageChange() {
        reloadAPIDocumentation()
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    /// 根据当前语言获取本地化字段值
    private func getLocalizedField(_ dict: [String: Any], key: String) -> String {
        let lang = LanguageManager.shared.currentLanguage

        // 如果是中文,优先使用中文字段
        if lang == .chinese {
            if let zhValue = dict["\(key)_zh"] as? String, !zhValue.isEmpty {
                return zhValue
            }
        }

        // Fallback到英文字段
        return dict[key] as? String ?? ""
    }

    /// 加载 API 文档
    private func loadAPIDocumentation() {
        // 加载 X API 文档
        if let xAPIPath = Bundle.main.path(forResource: "api_docs", ofType: "json"),
           let xAPIData = try? Data(contentsOf: URL(fileURLWithPath: xAPIPath)),
           let xAPIs = try? JSONSerialization.jsonObject(with: xAPIData) as? [[String: Any]] {
            apiEndpoints = xAPIs
        }

        // 加载 AI API 文档
        if let aiAPIPath = Bundle.main.path(forResource: "ai_claw_api_docs", ofType: "json"),
           let aiAPIData = try? Data(contentsOf: URL(fileURLWithPath: aiAPIPath)),
           let aiAPIs = try? JSONSerialization.jsonObject(with: aiAPIData) as? [[String: Any]] {
            aiAPIEndpoints = aiAPIs
        }
    }

    /// 重新加载 API 文档
    private func reloadAPIDocumentation() {
        // 清空现有视图
        apiListStackView.arrangedSubviews.forEach { $0.removeFromSuperview() }

        // 重新加载
        loadAPIDocumentation()
        setupAPIList()
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

        // 添加 X API 标题
        let xTitleLabel = NSTextField(labelWithString: "X (Twitter) API")
        xTitleLabel.font = DS.fontTitle
        xTitleLabel.textColor = DS.colorTextPrimary
        apiListStackView.addArrangedSubview(xTitleLabel)

        // 添加分隔线
        let separator1 = NSBox()
        separator1.boxType = .separator
        separator1.translatesAutoresizingMaskIntoConstraints = false
        apiListStackView.addArrangedSubview(separator1)
        NSLayoutConstraint.activate([
            separator1.widthAnchor.constraint(equalTo: apiListStackView.widthAnchor, constant: -2 * DS.spacingM)
        ])

        // 添加 X API 卡片
        for (index, endpoint) in apiEndpoints.enumerated() {
            let card = createAPICard(endpoint: endpoint, index: index)
            apiListStackView.addArrangedSubview(card)
        }

        // 添加 AI API 标题
        let aiTitleLabel = NSTextField(labelWithString: "AI Platform API")
        aiTitleLabel.font = DS.fontTitle
        aiTitleLabel.textColor = DS.colorTextPrimary
        apiListStackView.addArrangedSubview(aiTitleLabel)

        // 添加分隔线
        let separator2 = NSBox()
        separator2.boxType = .separator
        separator2.translatesAutoresizingMaskIntoConstraints = false
        apiListStackView.addArrangedSubview(separator2)
        NSLayoutConstraint.activate([
            separator2.widthAnchor.constraint(equalTo: apiListStackView.widthAnchor, constant: -2 * DS.spacingM)
        ])

        // 添加 AI API 卡片
        let xAPICount = apiEndpoints.count
        for (index, endpoint) in aiAPIEndpoints.enumerated() {
            let card = createAPICard(endpoint: endpoint, index: xAPICount + index)
            apiListStackView.addArrangedSubview(card)
        }

        apiListScrollView.documentView = apiListStackView
        apiListScrollView.hasVerticalScroller = true
        apiListScrollView.drawsBackground = false
        apiListScrollView.translatesAutoresizingMaskIntoConstraints = false
    }

    private func createAPICard(endpoint: [String: Any], index: Int) -> NSView {
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

        let method = endpoint["method"] as? String ?? "GET"
        let path = endpoint["path"] as? String ?? ""
        let name = getLocalizedField(endpoint, key: "name")

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
        } else if method == "DELETE" {
            methodLabel.backgroundColor = NSColor(red: 0.9, green: 0.3, blue: 0.3, alpha: 1.0)
        }

        methodLabel.translatesAutoresizingMaskIntoConstraints = false

        // 路径标签
        let pathLabel = NSTextField(labelWithString: path)
        pathLabel.font = DS.fontCaption
        pathLabel.textColor = DS.colorTextSecond
        pathLabel.isBordered = false
        pathLabel.isEditable = false
        pathLabel.drawsBackground = false
        pathLabel.translatesAutoresizingMaskIntoConstraints = false

        // 名称标签
        let nameLabel = NSTextField(labelWithString: name)
        nameLabel.font = DS.fontBody
        nameLabel.textColor = DS.colorTextPrimary
        nameLabel.isBordered = false
        nameLabel.isEditable = false
        nameLabel.drawsBackground = false
        nameLabel.translatesAutoresizingMaskIntoConstraints = false

        card.addSubview(methodLabel)
        card.addSubview(pathLabel)
        card.addSubview(nameLabel)

        NSLayoutConstraint.activate([
            card.widthAnchor.constraint(equalToConstant: 268),
            card.heightAnchor.constraint(equalToConstant: 80),

            methodLabel.topAnchor.constraint(equalTo: card.topAnchor, constant: DS.spacingS),
            methodLabel.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: DS.spacingS),
            methodLabel.widthAnchor.constraint(equalToConstant: 50),
            methodLabel.heightAnchor.constraint(equalToConstant: 18),

            pathLabel.topAnchor.constraint(equalTo: methodLabel.bottomAnchor, constant: 4),
            pathLabel.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: DS.spacingS),
            pathLabel.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -DS.spacingS),

            nameLabel.topAnchor.constraint(equalTo: pathLabel.bottomAnchor, constant: 4),
            nameLabel.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: DS.spacingS),
            nameLabel.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -DS.spacingS)
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

        let allEndpoints = apiEndpoints + aiAPIEndpoints
        guard allEndpoints.indices.contains(index) else { return }

        let endpoint = allEndpoints[index]

        // 构建详细信息文本
        let name = getLocalizedField(endpoint, key: "name")
        let summary = getLocalizedField(endpoint, key: "summary")
        let description = getLocalizedField(endpoint, key: "description")
        let method = endpoint["method"] as? String ?? ""
        let path = endpoint["path"] as? String ?? ""
        let curl = endpoint["curl"] as? String ?? ""

        var detailText = """
        \(name)

        \(summary)

        Method: \(method)
        Path: \(path)

        Description:
        \(description)

        Example:
        \(curl)
        """

        if let requestBody = endpoint["request_body"] as? String {
            detailText += "\n\nRequest Body:\n\(requestBody)"
        }

        codePreviewTextView.string = detailText

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
        let allEndpoints = apiEndpoints + aiAPIEndpoints
        if !allEndpoints.isEmpty {
            let endpoint = allEndpoints[0]

            let name = getLocalizedField(endpoint, key: "name")
            let summary = getLocalizedField(endpoint, key: "summary")
            let description = getLocalizedField(endpoint, key: "description")
            let method = endpoint["method"] as? String ?? ""
            let path = endpoint["path"] as? String ?? ""
            let curl = endpoint["curl"] as? String ?? ""

            codePreviewTextView.string = """
            \(name)

            \(summary)

            Method: \(method)
            Path: \(path)

            Description:
            \(description)

            Example:
            \(curl)
            """

            // 高亮第一个卡片
            if let firstCard = apiListStackView.arrangedSubviews.first(where: { ($0 as? NSButton)?.tag == 0 }) as? NSButton {
                firstCard.layer?.backgroundColor = DS.colorHighlight.withAlphaComponent(0.1).cgColor
                firstCard.layer?.borderColor = DS.colorHighlight.cgColor
                firstCard.layer?.borderWidth = 2
            }
        }
    }
}
