import Foundation

/// Provider 配置模型
/// 支持直连模式和代理模式（如 CC Switch）
struct ProviderConfig: Codable, Sendable {
    /// Provider 唯一标识
    let id: String

    /// Provider 显示名称
    let name: String

    /// API 端点 URL（支持直连或代理）
    /// 例如：
    /// - 直连: "https://api.anthropic.com/v1"
    /// - CC Switch 代理: "http://localhost:8080/v1"
    let baseURL: String

    /// API Key
    /// 在代理模式下可以是任意值，由代理管理真实 Key
    let apiKey: String

    /// 可选的模型名称
    /// 例如: "claude-sonnet-4-20250514", "gpt-4", "gemini-pro"
    let model: String?

    /// Provider 类型标识
    /// 用于区分不同的 AI 服务商
    let providerType: ProviderType

    /// 创建时间
    let createdAt: Date

    /// 最后更新时间
    var updatedAt: Date

    /// 是否启用
    var isEnabled: Bool

    init(
        id: String = UUID().uuidString,
        name: String,
        baseURL: String,
        apiKey: String,
        model: String? = nil,
        providerType: ProviderType,
        createdAt: Date = Date(),
        updatedAt: Date = Date(),
        isEnabled: Bool = true
    ) {
        self.id = id
        self.name = name
        self.baseURL = baseURL
        self.apiKey = apiKey
        self.model = model
        self.providerType = providerType
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.isEnabled = isEnabled
    }
}

/// Provider 类型枚举
enum ProviderType: String, Codable, CaseIterable, Sendable {
    case anthropic = "anthropic"
    case openai = "openai"
    case gemini = "gemini"
    case custom = "custom"

    var displayName: String {
        switch self {
        case .anthropic: return "Anthropic (Claude)"
        case .openai: return "OpenAI (GPT)"
        case .gemini: return "Google (Gemini)"
        case .custom: return "自定义"
        }
    }

    var defaultBaseURL: String {
        switch self {
        case .anthropic: return "https://api.anthropic.com/v1"
        case .openai: return "https://api.openai.com/v1"
        case .gemini: return "https://generativelanguage.googleapis.com/v1"
        case .custom: return ""
        }
    }

    var defaultModel: String? {
        switch self {
        case .anthropic: return "claude-sonnet-4-20250514"
        case .openai: return "gpt-4"
        case .gemini: return "gemini-pro"
        case .custom: return nil
        }
    }
}

// MARK: - Convenience Extensions

extension ProviderConfig {
    /// 是否为代理模式（通过 localhost 判断）
    var isProxyMode: Bool {
        baseURL.contains("localhost") || baseURL.contains("127.0.0.1")
    }

    /// 获取完整的 API 端点 URL
    func endpoint(path: String) -> String {
        let base = baseURL.hasSuffix("/") ? String(baseURL.dropLast()) : baseURL
        let cleanPath = path.hasPrefix("/") ? path : "/\(path)"
        return base + cleanPath
    }

    /// 创建一个更新后的副本
    func updated(
        name: String? = nil,
        baseURL: String? = nil,
        apiKey: String? = nil,
        model: String? = nil,
        isEnabled: Bool? = nil
    ) -> ProviderConfig {
        ProviderConfig(
            id: self.id,
            name: name ?? self.name,
            baseURL: baseURL ?? self.baseURL,
            apiKey: apiKey ?? self.apiKey,
            model: model ?? self.model,
            providerType: self.providerType,
            createdAt: self.createdAt,
            updatedAt: Date(),
            isEnabled: isEnabled ?? self.isEnabled
        )
    }
}

// MARK: - Preset Configurations

extension ProviderConfig {
    /// 创建 Anthropic 直连配置
    static func anthropicDirect(apiKey: String, model: String? = nil) -> ProviderConfig {
        ProviderConfig(
            name: "Claude (直连)",
            baseURL: ProviderType.anthropic.defaultBaseURL,
            apiKey: apiKey,
            model: model ?? ProviderType.anthropic.defaultModel,
            providerType: .anthropic
        )
    }

    /// 创建 CC Switch 代理配置
    static func ccSwitchProxy(port: Int = 8080, model: String? = nil) -> ProviderConfig {
        ProviderConfig(
            name: "CC Switch 代理",
            baseURL: "http://localhost:\(port)/v1",
            apiKey: "managed-by-cc-switch",
            model: model,
            providerType: .custom
        )
    }

    /// 创建 OpenAI 直连配置
    static func openAIDirect(apiKey: String, model: String? = nil) -> ProviderConfig {
        ProviderConfig(
            name: "OpenAI (直连)",
            baseURL: ProviderType.openai.defaultBaseURL,
            apiKey: apiKey,
            model: model ?? ProviderType.openai.defaultModel,
            providerType: .openai
        )
    }
}
