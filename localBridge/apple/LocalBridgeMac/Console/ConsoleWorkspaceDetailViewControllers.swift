import AppKit

// MARK: - PM Workspace

final class PMWorkspaceViewController: NSViewController, NSSplitViewDelegate {
    private let splitView  = NSSplitView()
    private let taskListVC = PMTaskListViewController()
    private var chatVC: ConsoleChatViewController?

    override func loadView() {
        view = NSView()
        view.translatesAutoresizingMaskIntoConstraints = false
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        let pmAgent = MockData.agents.first(where: { $0.role == .pm }) ?? MockData.agents[0]
        chatVC = ConsoleChatViewController(agent: pmAgent)

        splitView.isVertical   = true
        splitView.dividerStyle = .thin
        splitView.delegate     = self
        splitView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(splitView)

        addChild(taskListVC)
        addChild(chatVC!)
        taskListVC.view.translatesAutoresizingMaskIntoConstraints = false
        chatVC!.view.translatesAutoresizingMaskIntoConstraints    = false
        splitView.addArrangedSubview(taskListVC.view)
        splitView.addArrangedSubview(chatVC!.view)

        NSLayoutConstraint.activate([
            splitView.topAnchor.constraint(equalTo: view.topAnchor),
            splitView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            splitView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            splitView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])

        // 初始宽度 240（可拖动）
        DispatchQueue.main.async { [weak self] in
            self?.splitView.setPosition(240, ofDividerAt: 0)
        }
    }

    // MARK: NSSplitViewDelegate — 控制任务列表拖动范围

    func splitView(_ splitView: NSSplitView, constrainMinCoordinate proposedMin: CGFloat, ofSubviewAt index: Int) -> CGFloat {
        return 160   // 任务列表最小 160
    }

    func splitView(_ splitView: NSSplitView, constrainMaxCoordinate proposedMax: CGFloat, ofSubviewAt index: Int) -> CGFloat {
        return min(splitView.frame.width * 0.45, 380)  // 任务列表最大 45% 或 380
    }

    func splitView(_ splitView: NSSplitView, effectiveRect proposedEffectiveRect: NSRect,
                   forDrawnRect drawnRect: NSRect, ofDividerAt dividerIndex: Int) -> NSRect {
        return proposedEffectiveRect.insetBy(dx: -3, dy: 0)
    }
}

// MARK: PM Task List

final class PMTaskListViewController: NSViewController {
    override func loadView() {
        view = NSView()
        view.translatesAutoresizingMaskIntoConstraints = false
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor.consoleZ950.cgColor
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        let title = NSTextField(labelWithString: "任务总览")
        title.font      = .systemFont(ofSize: 14, weight: .semibold)
        title.textColor = .consoleText
        title.translatesAutoresizingMaskIntoConstraints = false

        let subtitle = NSTextField(labelWithString: "共 \(MockData.tasks.count) 个任务")
        subtitle.font      = .systemFont(ofSize: 12)
        subtitle.textColor = .consoleText2
        subtitle.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(title)
        view.addSubview(subtitle)

        let border = NSView()
        border.wantsLayer = true
        border.layer?.backgroundColor = NSColor.consoleZ800.cgColor
        border.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(border)

        let scroll = NSScrollView()
        scroll.drawsBackground = false
        scroll.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scroll)

        let stack = NSStackView()
        stack.orientation = .vertical
        stack.spacing     = 10
        stack.edgeInsets  = NSEdgeInsets(top: 12, left: 12, bottom: 12, right: 12)
        stack.translatesAutoresizingMaskIntoConstraints = false
        scroll.documentView = stack

        NSLayoutConstraint.activate([
            title.topAnchor.constraint(equalTo: view.topAnchor, constant: 14),
            title.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 14),
            subtitle.topAnchor.constraint(equalTo: title.bottomAnchor, constant: 2),
            subtitle.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 14),
            border.topAnchor.constraint(equalTo: view.topAnchor, constant: 56),
            border.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            border.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            border.heightAnchor.constraint(equalToConstant: 1),
            scroll.topAnchor.constraint(equalTo: border.bottomAnchor),
            scroll.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scroll.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            stack.topAnchor.constraint(equalTo: scroll.contentView.topAnchor),
            stack.leadingAnchor.constraint(equalTo: scroll.contentView.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: scroll.contentView.trailingAnchor)
        ])

        for task in MockData.tasks {
            let card = makeTaskCard(task)
            card.translatesAutoresizingMaskIntoConstraints = false
            stack.addArrangedSubview(card)
        }
    }

    private func makeTaskCard(_ task: AITask) -> NSView {
        let card = NSView()
        card.wantsLayer = true
        card.layer?.cornerRadius    = 8
        card.layer?.backgroundColor = NSColor.consoleZ900.withAlphaComponent(0.5).cgColor
        card.layer?.borderColor     = NSColor.consoleZ800.cgColor
        card.layer?.borderWidth     = 1
        card.heightAnchor.constraint(equalToConstant: 88).isActive = true

        let title = NSTextField(labelWithString: task.title)
        title.font                 = .systemFont(ofSize: 13, weight: .semibold)
        title.textColor            = .consoleText
        title.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(title)

        let desc = NSTextField(labelWithString: task.description)
        desc.font                 = .systemFont(ofSize: 11)
        desc.textColor            = .consoleText2
        desc.maximumNumberOfLines = 2
        desc.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(desc)

        NSLayoutConstraint.activate([
            title.topAnchor.constraint(equalTo: card.topAnchor, constant: 10),
            title.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 12),
            title.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -12),
            desc.topAnchor.constraint(equalTo: title.bottomAnchor, constant: 4),
            desc.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 12),
            desc.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -12)
        ])
        return card
    }
}

// MARK: - Dev Workspace

final class DevWorkspaceViewController: NSViewController {
    private let segmentedControl = NSSegmentedControl()
    private let containerView    = NSView()
    private var currentVC: NSViewController?

    override func loadView() {
        view = NSView()
        view.translatesAutoresizingMaskIntoConstraints = false
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor.consoleZ950.cgColor
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        setupHeader()
        setupTabs()
        switchToTab(0)
    }

    private func setupHeader() {
        let header = makeRoleHeader(emoji: "💻", name: "Claude 3.5", subtitle: "开发团队 · claude-3.5-sonnet",
                                    gradColors: [NSColor.consoleBlue, NSColor(hex: "#06B6D4")])
        view.addSubview(header)
        NSLayoutConstraint.activate([
            header.topAnchor.constraint(equalTo: view.topAnchor),
            header.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            header.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            header.heightAnchor.constraint(equalToConstant: 60)
        ])
    }

    private func setupTabs() {
        segmentedControl.segmentCount    = 3
        segmentedControl.setLabel("对话",    forSegment: 0)
        segmentedControl.setLabel("代码预览", forSegment: 1)
        segmentedControl.setLabel("任务",    forSegment: 2)
        segmentedControl.selectedSegment = 0
        segmentedControl.target = self
        segmentedControl.action = #selector(tabChanged(_:))
        segmentedControl.translatesAutoresizingMaskIntoConstraints = false

        let bar = makeTabBar(containing: segmentedControl)
        view.addSubview(bar)
        containerView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(containerView)

        NSLayoutConstraint.activate([
            bar.topAnchor.constraint(equalTo: view.topAnchor, constant: 60),
            bar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            bar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            bar.heightAnchor.constraint(equalToConstant: 40),
            containerView.topAnchor.constraint(equalTo: bar.bottomAnchor),
            containerView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            containerView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            containerView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }

    @objc private func tabChanged(_ sender: NSSegmentedControl) { switchToTab(sender.selectedSegment) }

    private func switchToTab(_ index: Int) {
        currentVC?.view.removeFromSuperview()
        currentVC?.removeFromParent()

        let vc: NSViewController
        switch index {
        case 1:  vc = DevCodePreviewController()
        case 2:  vc = DevTaskListController()
        default:
            let devAgent = MockData.agents.first(where: { $0.role == .developer }) ?? MockData.agents[1]
            vc = ConsoleChatViewController(agent: devAgent)
        }

        addChild(vc)
        vc.view.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(vc.view)
        NSLayoutConstraint.activate([
            vc.view.topAnchor.constraint(equalTo: containerView.topAnchor),
            vc.view.leadingAnchor.constraint(equalTo: containerView.leadingAnchor),
            vc.view.trailingAnchor.constraint(equalTo: containerView.trailingAnchor),
            vc.view.bottomAnchor.constraint(equalTo: containerView.bottomAnchor)
        ])
        currentVC = vc
    }
}

// MARK: Dev Code Preview

final class DevCodePreviewController: NSViewController {
    override func loadView() {
        let v = NSView()
        let editor = NSView()
        editor.wantsLayer = true
        editor.layer?.cornerRadius    = 8
        editor.layer?.backgroundColor = NSColor.consoleZ950.cgColor
        editor.translatesAutoresizingMaskIntoConstraints = false
        v.addSubview(editor)

        let filename = NSTextField(labelWithString: "LoginForm.swift")
        filename.font      = .systemFont(ofSize: 12)
        filename.textColor = .consoleText2
        filename.translatesAutoresizingMaskIntoConstraints = false
        editor.addSubview(filename)

        let code = NSTextField(labelWithString: "import AppKit\n\nclass LoginForm: NSView {\n    override init(frame: NSRect) {\n        super.init(frame: frame)\n        setupUI()\n    }\n    \n    func setupUI() {\n        let btn = NSButton()\n        btn.title = \"Login\"\n        addSubview(btn)\n    }\n}")
        code.font      = NSFont.monospacedSystemFont(ofSize: 13, weight: .regular)
        code.textColor = NSColor(hex: "#D4D4D8")
        code.translatesAutoresizingMaskIntoConstraints = false
        editor.addSubview(code)

        NSLayoutConstraint.activate([
            editor.topAnchor.constraint(equalTo: v.topAnchor, constant: 20),
            editor.leadingAnchor.constraint(equalTo: v.leadingAnchor, constant: 20),
            editor.trailingAnchor.constraint(equalTo: v.trailingAnchor, constant: -20),
            editor.bottomAnchor.constraint(equalTo: v.bottomAnchor, constant: -20),
            filename.topAnchor.constraint(equalTo: editor.topAnchor, constant: 12),
            filename.leadingAnchor.constraint(equalTo: editor.leadingAnchor, constant: 16),
            code.topAnchor.constraint(equalTo: filename.bottomAnchor, constant: 16),
            code.leadingAnchor.constraint(equalTo: editor.leadingAnchor, constant: 16)
        ])
        view = v
    }
}

// MARK: Dev Task List

final class DevTaskListController: NSViewController {
    override func loadView() {
        let v = NSView()
        let stack = NSStackView()
        stack.orientation = .vertical
        stack.spacing     = 12
        stack.edgeInsets  = NSEdgeInsets(top: 20, left: 20, bottom: 20, right: 20)
        stack.translatesAutoresizingMaskIntoConstraints = false
        v.addSubview(stack)

        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: v.topAnchor),
            stack.leadingAnchor.constraint(equalTo: v.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: v.trailingAnchor)
        ])

        for task in MockData.tasks {
            let card = NSView()
            card.wantsLayer = true
            card.layer?.cornerRadius    = 8
            card.layer?.backgroundColor = NSColor.consoleZ900.cgColor
            card.heightAnchor.constraint(equalToConstant: 80).isActive = true

            let name = NSTextField(labelWithString: task.title)
            name.font      = .systemFont(ofSize: 14, weight: .semibold)
            name.textColor = .consoleText
            name.translatesAutoresizingMaskIntoConstraints = false
            card.addSubview(name)

            let progress = ConsoleProgressBar()
            progress.progress = task.progress
            progress.translatesAutoresizingMaskIntoConstraints = false
            card.addSubview(progress)

            NSLayoutConstraint.activate([
                name.topAnchor.constraint(equalTo: card.topAnchor, constant: 12),
                name.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 12),
                progress.topAnchor.constraint(equalTo: name.bottomAnchor, constant: 12),
                progress.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 12),
                progress.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -12),
                progress.heightAnchor.constraint(equalToConstant: 8)
            ])
            stack.addArrangedSubview(card)
        }
        view = v
    }
}

// MARK: - QA Workspace

final class QAWorkspaceViewController: NSViewController {
    private let segmentedControl = NSSegmentedControl()
    private let containerView    = NSView()
    private var currentVC: NSViewController?

    override func loadView() {
        view = NSView()
        view.translatesAutoresizingMaskIntoConstraints = false
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor.consoleZ950.cgColor
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        setupHeader()
        setupTabs()
        switchToTab(0)
    }

    private func setupHeader() {
        let header = makeRoleHeader(emoji: "🧪", name: "QA Bot", subtitle: "验收团队 · claude-3-haiku",
                                    gradColors: [NSColor.consoleGreen, NSColor(hex: "#4ADE80")])
        view.addSubview(header)
        NSLayoutConstraint.activate([
            header.topAnchor.constraint(equalTo: view.topAnchor),
            header.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            header.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            header.heightAnchor.constraint(equalToConstant: 60)
        ])
    }

    private func setupTabs() {
        segmentedControl.segmentCount    = 3
        segmentedControl.setLabel("对话",   forSegment: 0)
        segmentedControl.setLabel("测试结果", forSegment: 1)
        segmentedControl.setLabel("测试报告", forSegment: 2)
        segmentedControl.selectedSegment = 0
        segmentedControl.target = self
        segmentedControl.action = #selector(tabChanged(_:))
        segmentedControl.translatesAutoresizingMaskIntoConstraints = false

        let bar = makeTabBar(containing: segmentedControl)
        view.addSubview(bar)
        containerView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(containerView)

        NSLayoutConstraint.activate([
            bar.topAnchor.constraint(equalTo: view.topAnchor, constant: 60),
            bar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            bar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            bar.heightAnchor.constraint(equalToConstant: 40),
            containerView.topAnchor.constraint(equalTo: bar.bottomAnchor),
            containerView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            containerView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            containerView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }

    @objc private func tabChanged(_ sender: NSSegmentedControl) { switchToTab(sender.selectedSegment) }

    private func switchToTab(_ index: Int) {
        currentVC?.view.removeFromSuperview()
        currentVC?.removeFromParent()

        let vc: NSViewController
        switch index {
        case 1:  vc = QATestResultsController()
        case 2:  vc = QATestReportController()
        default:
            let qaAgent = MockData.agents.first(where: { $0.role == .qa }) ?? MockData.agents[3]
            vc = ConsoleChatViewController(agent: qaAgent)
        }

        addChild(vc)
        vc.view.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(vc.view)
        NSLayoutConstraint.activate([
            vc.view.topAnchor.constraint(equalTo: containerView.topAnchor),
            vc.view.leadingAnchor.constraint(equalTo: containerView.leadingAnchor),
            vc.view.trailingAnchor.constraint(equalTo: containerView.trailingAnchor),
            vc.view.bottomAnchor.constraint(equalTo: containerView.bottomAnchor)
        ])
        currentVC = vc
    }
}

// MARK: QA Test Results

final class QATestResultsController: NSViewController {
    override func loadView() {
        let v = NSView()
        let scroll = NSScrollView()
        scroll.drawsBackground = false
        scroll.translatesAutoresizingMaskIntoConstraints = false
        v.addSubview(scroll)

        let stack = NSStackView()
        stack.orientation = .vertical
        stack.spacing     = 10
        stack.edgeInsets  = NSEdgeInsets(top: 20, left: 20, bottom: 20, right: 20)
        stack.translatesAutoresizingMaskIntoConstraints = false
        scroll.documentView = stack

        NSLayoutConstraint.activate([
            scroll.topAnchor.constraint(equalTo: v.topAnchor),
            scroll.leadingAnchor.constraint(equalTo: v.leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo: v.trailingAnchor),
            scroll.bottomAnchor.constraint(equalTo: v.bottomAnchor),
            stack.widthAnchor.constraint(equalTo: scroll.widthAnchor)
        ])

        let results: [(String, Bool, String)] = [
            ("用户登录 API 测试", true,  "0.23s"),
            ("数据库迁移脚本验证", false, "1.45s"),
            ("前端主页渲染测试",  true,  "0.89s")
        ]

        for (name, success, time) in results {
            let row = NSView()
            row.wantsLayer = true
            row.layer?.cornerRadius    = 8
            row.layer?.backgroundColor = success
                ? NSColor.consoleGreen.withAlphaComponent(0.1).cgColor
                : NSColor.consoleRed.withAlphaComponent(0.1).cgColor
            row.heightAnchor.constraint(equalToConstant: 44).isActive = true

            let icon = NSTextField(labelWithString: success ? "✓" : "✗")
            icon.textColor = success ? .consoleGreen : .consoleRed
            icon.font      = .systemFont(ofSize: 16, weight: .bold)
            icon.translatesAutoresizingMaskIntoConstraints = false
            row.addSubview(icon)

            let lbl = NSTextField(labelWithString: name)
            lbl.textColor = .consoleText
            lbl.translatesAutoresizingMaskIntoConstraints = false
            row.addSubview(lbl)

            let t = NSTextField(labelWithString: time)
            t.textColor = .consoleText3
            t.font      = .systemFont(ofSize: 11)
            t.translatesAutoresizingMaskIntoConstraints = false
            row.addSubview(t)

            NSLayoutConstraint.activate([
                icon.leadingAnchor.constraint(equalTo: row.leadingAnchor, constant: 12),
                icon.centerYAnchor.constraint(equalTo: row.centerYAnchor),
                lbl.leadingAnchor.constraint(equalTo: icon.trailingAnchor, constant: 12),
                lbl.centerYAnchor.constraint(equalTo: row.centerYAnchor),
                t.trailingAnchor.constraint(equalTo: row.trailingAnchor, constant: -12),
                t.centerYAnchor.constraint(equalTo: row.centerYAnchor)
            ])
            stack.addArrangedSubview(row)
        }
        view = v
    }
}

// MARK: QA Test Report

final class QATestReportController: NSViewController {
    override func loadView() {
        let v = NSView()
        v.translatesAutoresizingMaskIntoConstraints = false

        let stack = NSStackView()
        stack.orientation = .vertical
        stack.spacing     = 20
        stack.edgeInsets  = NSEdgeInsets(top: 24, left: 24, bottom: 24, right: 24)
        stack.translatesAutoresizingMaskIntoConstraints = false
        v.addSubview(stack)

        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: v.topAnchor),
            stack.leadingAnchor.constraint(equalTo: v.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: v.trailingAnchor)
        ])

        let stats = NSStackView()
        stats.distribution = .fillEqually
        stats.spacing      = 16
        stats.addArrangedSubview(makeStat(num: "42", label: "通过", color: .consoleGreen))
        stats.addArrangedSubview(makeStat(num: "3",  label: "警告", color: .consoleYellow))
        stats.addArrangedSubview(makeStat(num: "1",  label: "失败", color: .consoleRed))
        stack.addArrangedSubview(stats)

        let coverageTitle = NSTextField(labelWithString: "代码覆盖率")
        coverageTitle.font = .systemFont(ofSize: 14, weight: .semibold)
        stack.addArrangedSubview(coverageTitle)

        stack.addArrangedSubview(makeCoverageRow(label: "语句", val: 0.85, color: .consoleGreen))
        stack.addArrangedSubview(makeCoverageRow(label: "分支", val: 0.72, color: .consoleYellow))
        stack.addArrangedSubview(makeCoverageRow(label: "函数", val: 0.91, color: .consoleGreen))

        view = v
    }

    private func makeStat(num: String, label: String, color: NSColor) -> NSView {
        let box = NSView()
        box.wantsLayer = true
        box.layer?.cornerRadius    = 8
        box.layer?.backgroundColor = color.withAlphaComponent(0.1).cgColor
        box.layer?.borderColor     = color.withAlphaComponent(0.3).cgColor
        box.layer?.borderWidth     = 1
        box.heightAnchor.constraint(equalToConstant: 80).isActive = true

        let n = NSTextField(labelWithString: num)
        n.font      = .systemFont(ofSize: 24, weight: .bold)
        n.textColor = color
        n.translatesAutoresizingMaskIntoConstraints = false
        box.addSubview(n)

        let l = NSTextField(labelWithString: label)
        l.font      = .systemFont(ofSize: 12)
        l.textColor = .consoleText3
        l.translatesAutoresizingMaskIntoConstraints = false
        box.addSubview(l)

        NSLayoutConstraint.activate([
            n.centerXAnchor.constraint(equalTo: box.centerXAnchor),
            n.topAnchor.constraint(equalTo: box.topAnchor, constant: 12),
            l.centerXAnchor.constraint(equalTo: box.centerXAnchor),
            l.bottomAnchor.constraint(equalTo: box.bottomAnchor, constant: -12)
        ])
        return box
    }

    private func makeCoverageRow(label: String, val: Double, color: NSColor) -> NSView {
        let row = NSView()
        row.heightAnchor.constraint(equalToConstant: 32).isActive = true

        let l = NSTextField(labelWithString: label)
        l.font      = .systemFont(ofSize: 12)
        l.textColor = .consoleText2
        l.translatesAutoresizingMaskIntoConstraints = false
        row.addSubview(l)

        let bar = ConsoleProgressBar()
        bar.progress = val
        bar.translatesAutoresizingMaskIntoConstraints = false
        row.addSubview(bar)

        let p = NSTextField(labelWithString: "\(Int(val * 100))%")
        p.font      = .systemFont(ofSize: 12)
        p.textColor = color
        p.translatesAutoresizingMaskIntoConstraints = false
        row.addSubview(p)

        NSLayoutConstraint.activate([
            l.leadingAnchor.constraint(equalTo: row.leadingAnchor),
            l.centerYAnchor.constraint(equalTo: row.centerYAnchor),
            bar.leadingAnchor.constraint(equalTo: row.leadingAnchor, constant: 80),
            bar.trailingAnchor.constraint(equalTo: row.trailingAnchor, constant: -40),
            bar.centerYAnchor.constraint(equalTo: row.centerYAnchor),
            bar.heightAnchor.constraint(equalToConstant: 8),
            p.trailingAnchor.constraint(equalTo: row.trailingAnchor),
            p.centerYAnchor.constraint(equalTo: row.centerYAnchor)
        ])
        return row
    }
}

// MARK: - Message Flow

final class MessageFlowViewController: NSViewController {
    override func loadView() {
        view = NSView()
        view.translatesAutoresizingMaskIntoConstraints = false
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor.consoleZ950.cgColor
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        let title = NSTextField(labelWithString: "全局消息流")
        title.font      = .systemFont(ofSize: 18, weight: .bold)
        title.textColor = .consoleText
        title.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(title)

        let scroll = NSScrollView()
        scroll.drawsBackground = false
        scroll.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scroll)

        let stack = NSStackView()
        stack.orientation = .vertical
        stack.spacing     = 20
        stack.edgeInsets  = NSEdgeInsets(top: 20, left: 40, bottom: 20, right: 40)
        stack.translatesAutoresizingMaskIntoConstraints = false
        scroll.documentView = stack

        NSLayoutConstraint.activate([
            title.topAnchor.constraint(equalTo: view.topAnchor, constant: 20),
            title.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            scroll.topAnchor.constraint(equalTo: title.bottomAnchor, constant: 20),
            scroll.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scroll.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            stack.widthAnchor.constraint(equalTo: scroll.widthAnchor)
        ])

        for agent in MockData.agents {
            for msg in agent.messages where msg.sender == .ai {
                stack.addArrangedSubview(makeTimelineItem(for: agent, msg: msg))
            }
        }
    }

    private func makeTimelineItem(for agent: AIAgent, msg: AIMessage) -> NSView {
        let v = NSView()
        let bubble = NSView()
        bubble.wantsLayer = true
        bubble.layer?.cornerRadius    = 8
        bubble.layer?.backgroundColor = NSColor.consoleZ900.withAlphaComponent(0.5).cgColor
        bubble.layer?.borderColor     = NSColor.consoleZ800.cgColor
        bubble.layer?.borderWidth     = 1
        bubble.translatesAutoresizingMaskIntoConstraints = false
        v.addSubview(bubble)

        let name = NSTextField(labelWithString: agent.name)
        name.font      = .systemFont(ofSize: 13, weight: .semibold)
        name.textColor = agent.role.color
        name.translatesAutoresizingMaskIntoConstraints = false
        v.addSubview(name)

        let content = NSTextField(labelWithString: msg.content)
        content.font                 = .systemFont(ofSize: 13)
        content.textColor            = .consoleText2
        content.maximumNumberOfLines = 0
        content.translatesAutoresizingMaskIntoConstraints = false
        bubble.addSubview(content)

        NSLayoutConstraint.activate([
            name.topAnchor.constraint(equalTo: v.topAnchor),
            name.leadingAnchor.constraint(equalTo: v.leadingAnchor),
            bubble.topAnchor.constraint(equalTo: name.bottomAnchor, constant: 8),
            bubble.leadingAnchor.constraint(equalTo: v.leadingAnchor),
            bubble.trailingAnchor.constraint(equalTo: v.trailingAnchor),
            bubble.bottomAnchor.constraint(equalTo: v.bottomAnchor),
            content.topAnchor.constraint(equalTo: bubble.topAnchor, constant: 12),
            content.leadingAnchor.constraint(equalTo: bubble.leadingAnchor, constant: 12),
            content.trailingAnchor.constraint(equalTo: bubble.trailingAnchor, constant: -12),
            content.bottomAnchor.constraint(equalTo: bubble.bottomAnchor, constant: -12)
        ])
        return v
    }
}

// MARK: - AI Config

final class AIConfigViewController: NSViewController {
    private let listStack = NSStackView()
    private let rightArea = NSView()
    private var selectedAgentId: String?

    override func loadView() {
        view = NSView()
        view.translatesAutoresizingMaskIntoConstraints = false
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor.consoleZ950.cgColor
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        let split = NSSplitView()
        split.isVertical   = true
        split.dividerStyle = .thin
        split.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(split)

        let left = NSView()
        rightArea.translatesAutoresizingMaskIntoConstraints = false
        split.addArrangedSubview(left)
        split.addArrangedSubview(rightArea)

        NSLayoutConstraint.activate([
            split.topAnchor.constraint(equalTo: view.topAnchor),
            split.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            split.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            split.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            left.widthAnchor.constraint(equalToConstant: 280)
        ])

        let title = NSTextField(labelWithString: "AI 配置中心")
        title.font = .systemFont(ofSize: 14, weight: .semibold)
        title.translatesAutoresizingMaskIntoConstraints = false
        left.addSubview(title)

        let scroll = NSScrollView()
        scroll.drawsBackground = false
        scroll.translatesAutoresizingMaskIntoConstraints = false
        left.addSubview(scroll)

        listStack.orientation = .vertical
        listStack.spacing     = 8
        listStack.edgeInsets  = NSEdgeInsets(top: 0, left: 12, bottom: 16, right: 12)
        listStack.translatesAutoresizingMaskIntoConstraints = false
        scroll.documentView = listStack

        NSLayoutConstraint.activate([
            title.topAnchor.constraint(equalTo: left.topAnchor, constant: 16),
            title.leadingAnchor.constraint(equalTo: left.leadingAnchor, constant: 14),
            scroll.topAnchor.constraint(equalTo: left.topAnchor, constant: 52),
            scroll.leadingAnchor.constraint(equalTo: left.leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo: left.trailingAnchor),
            scroll.bottomAnchor.constraint(equalTo: left.bottomAnchor),
            listStack.widthAnchor.constraint(equalTo: scroll.widthAnchor)
        ])

        updateList()
        showEmptyState()
    }

    private func updateList() {
        listStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
        for agent in MockData.agents {
            let card = ConsoleAICard(agent: agent)
            card.isSelected = agent.id == selectedAgentId
            card.heightAnchor.constraint(equalToConstant: 68).isActive = true
            card.onTap = { [weak self] in
                self?.selectedAgentId = agent.id
                self?.updateList()
                self?.showForm(for: agent)
            }
            listStack.addArrangedSubview(card)
        }
    }

    private func showEmptyState() {
        rightArea.subviews.forEach { $0.removeFromSuperview() }
        let l = NSTextField(labelWithString: "选择一个 AI 进行配置")
        l.textColor = .consoleText3
        l.translatesAutoresizingMaskIntoConstraints = false
        rightArea.addSubview(l)
        NSLayoutConstraint.activate([
            l.centerXAnchor.constraint(equalTo: rightArea.centerXAnchor),
            l.centerYAnchor.constraint(equalTo: rightArea.centerYAnchor)
        ])
    }

    private func showForm(for agent: AIAgent) {
        rightArea.subviews.forEach { $0.removeFromSuperview() }

        let header = NSView()
        header.translatesAutoresizingMaskIntoConstraints = false
        rightArea.addSubview(header)

        let headerTitle = NSTextField(labelWithString: "配置 \(agent.name)")
        headerTitle.font = .systemFont(ofSize: 14, weight: .semibold)
        headerTitle.translatesAutoresizingMaskIntoConstraints = false
        header.addSubview(headerTitle)

        let border = NSView()
        border.wantsLayer = true
        border.layer?.backgroundColor = NSColor.consoleZ800.cgColor
        border.translatesAutoresizingMaskIntoConstraints = false
        rightArea.addSubview(border)

        let form = NSStackView()
        form.orientation = .vertical
        form.spacing     = 24
        form.edgeInsets  = NSEdgeInsets(top: 24, left: 24, bottom: 24, right: 24)
        form.translatesAutoresizingMaskIntoConstraints = false
        rightArea.addSubview(form)

        form.addArrangedSubview(makeFormSection(title: "基本信息", fields: [("名称", agent.name), ("角色", agent.role.label)]))

        switch agent.type {
        case .web: form.addArrangedSubview(makeFormSection(title: "Web 配置",  fields: [("网页 URL", agent.url ?? "")]))
        case .api: form.addArrangedSubview(makeFormSection(title: "API 配置",  fields: [("API 端点", agent.apiEndpoint ?? ""), ("模型", agent.model ?? "")]))
        case .cli: form.addArrangedSubview(makeFormSection(title: "CLI 配置",  fields: [("命令",    agent.command ?? "")]))
        }

        let saveBtn = NSButton(title: "保存配置", target: self, action: #selector(saveTapped))
        saveBtn.translatesAutoresizingMaskIntoConstraints = false
        saveBtn.bezelStyle = .rounded
        form.addArrangedSubview(saveBtn)

        NSLayoutConstraint.activate([
            header.topAnchor.constraint(equalTo: rightArea.topAnchor),
            header.leadingAnchor.constraint(equalTo: rightArea.leadingAnchor),
            header.trailingAnchor.constraint(equalTo: rightArea.trailingAnchor),
            header.heightAnchor.constraint(equalToConstant: 56),
            headerTitle.centerYAnchor.constraint(equalTo: header.centerYAnchor),
            headerTitle.leadingAnchor.constraint(equalTo: header.leadingAnchor, constant: 16),
            border.topAnchor.constraint(equalTo: header.bottomAnchor),
            border.leadingAnchor.constraint(equalTo: rightArea.leadingAnchor),
            border.trailingAnchor.constraint(equalTo: rightArea.trailingAnchor),
            border.heightAnchor.constraint(equalToConstant: 1),
            form.topAnchor.constraint(equalTo: border.bottomAnchor),
            form.leadingAnchor.constraint(equalTo: rightArea.leadingAnchor),
            form.trailingAnchor.constraint(equalTo: rightArea.trailingAnchor)
        ])
    }

    private func makeFormSection(title: String, fields: [(String, String)]) -> NSView {
        let card = NSView()
        card.wantsLayer = true
        card.layer?.cornerRadius    = 8
        card.layer?.backgroundColor = NSColor.consoleZ900.withAlphaComponent(0.5).cgColor
        card.layer?.borderColor     = NSColor.consoleZ800.cgColor
        card.layer?.borderWidth     = 1

        let stack = NSStackView()
        stack.orientation = .vertical
        stack.spacing     = 12
        stack.edgeInsets  = NSEdgeInsets(top: 16, left: 16, bottom: 16, right: 16)
        stack.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(stack)

        let t = NSTextField(labelWithString: title)
        t.font      = .systemFont(ofSize: 12, weight: .bold)
        t.textColor = .consoleBlue
        stack.addArrangedSubview(t)

        for (label, val) in fields {
            let l = NSTextField(labelWithString: label)
            l.font      = .systemFont(ofSize: 11)
            l.textColor = .consoleText2
            stack.addArrangedSubview(l)

            let f = ConsoleTextField()
            f.stringValue = val
            f.heightAnchor.constraint(equalToConstant: 32).isActive = true
            stack.addArrangedSubview(f)
        }

        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: card.topAnchor),
            stack.leadingAnchor.constraint(equalTo: card.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: card.trailingAnchor),
            stack.bottomAnchor.constraint(equalTo: card.bottomAnchor)
        ])
        return card
    }

    @objc private func saveTapped() {
        let alert = NSAlert()
        alert.messageText    = "保存成功"
        alert.informativeText = "AI 配置已更新。"
        alert.addButton(withTitle: "确定")
        alert.runModal()
    }
}

// MARK: - Shared Helpers

/// 创建通用角色 Header 视图（高度由外部约束指定）
func makeRoleHeader(emoji: String, name: String, subtitle: String, gradColors: [NSColor]) -> NSView {
    let header = NSView()
    header.translatesAutoresizingMaskIntoConstraints = false
    header.wantsLayer = true
    header.layer?.backgroundColor = NSColor.consoleZ950.cgColor

    // 底部分割线
    let border = NSView()
    border.wantsLayer = true
    border.layer?.backgroundColor = NSColor.consoleZ800.cgColor
    border.translatesAutoresizingMaskIntoConstraints = false
    header.addSubview(border)

    let avatar = NSView()
    avatar.wantsLayer = true
    avatar.layer?.cornerRadius = 7
    avatar.translatesAutoresizingMaskIntoConstraints = false
    let grad = CAGradientLayer()
    grad.colors      = gradColors.map { $0.withAlphaComponent(0.25).cgColor }
    grad.frame        = CGRect(x: 0, y: 0, width: 36, height: 36)
    grad.cornerRadius = 7
    avatar.layer?.addSublayer(grad)

    let emojiLbl = NSTextField(labelWithString: emoji)
    emojiLbl.font = .systemFont(ofSize: 18)
    emojiLbl.translatesAutoresizingMaskIntoConstraints = false
    avatar.addSubview(emojiLbl)
    header.addSubview(avatar)

    let nameLbl = NSTextField(labelWithString: name)
    nameLbl.font      = .systemFont(ofSize: 13, weight: .semibold)
    nameLbl.textColor = .consoleText
    nameLbl.translatesAutoresizingMaskIntoConstraints = false
    header.addSubview(nameLbl)

    let sub = NSTextField(labelWithString: subtitle)
    sub.font      = .systemFont(ofSize: 11)
    sub.textColor = .consoleText2
    sub.translatesAutoresizingMaskIntoConstraints = false
    header.addSubview(sub)

    NSLayoutConstraint.activate([
        border.bottomAnchor.constraint(equalTo: header.bottomAnchor),
        border.leadingAnchor.constraint(equalTo: header.leadingAnchor),
        border.trailingAnchor.constraint(equalTo: header.trailingAnchor),
        border.heightAnchor.constraint(equalToConstant: 1),

        avatar.centerYAnchor.constraint(equalTo: header.centerYAnchor),
        avatar.leadingAnchor.constraint(equalTo: header.leadingAnchor, constant: 14),
        avatar.widthAnchor.constraint(equalToConstant: 36),
        avatar.heightAnchor.constraint(equalToConstant: 36),
        emojiLbl.centerXAnchor.constraint(equalTo: avatar.centerXAnchor),
        emojiLbl.centerYAnchor.constraint(equalTo: avatar.centerYAnchor),
        nameLbl.topAnchor.constraint(equalTo: avatar.topAnchor, constant: 2),
        nameLbl.leadingAnchor.constraint(equalTo: avatar.trailingAnchor, constant: 10),
        sub.bottomAnchor.constraint(equalTo: avatar.bottomAnchor, constant: -1),
        sub.leadingAnchor.constraint(equalTo: avatar.trailingAnchor, constant: 10)
    ])
    return header
}

/// 创建包含 segmentedControl 的标签栏
func makeTabBar(containing control: NSSegmentedControl) -> NSView {
    let bar = NSView()
    bar.wantsLayer = true
    bar.layer?.backgroundColor = NSColor.consoleZ900.withAlphaComponent(0.8).cgColor
    bar.translatesAutoresizingMaskIntoConstraints = false

    let border = NSView()
    border.wantsLayer = true
    border.layer?.backgroundColor = NSColor.consoleZ800.cgColor
    border.translatesAutoresizingMaskIntoConstraints = false
    bar.addSubview(border)
    bar.addSubview(control)

    NSLayoutConstraint.activate([
        control.centerYAnchor.constraint(equalTo: bar.centerYAnchor),
        control.leadingAnchor.constraint(equalTo: bar.leadingAnchor, constant: 14),
        border.bottomAnchor.constraint(equalTo: bar.bottomAnchor),
        border.leadingAnchor.constraint(equalTo: bar.leadingAnchor),
        border.trailingAnchor.constraint(equalTo: bar.trailingAnchor),
        border.heightAnchor.constraint(equalToConstant: 1)
    ])
    return bar
}
