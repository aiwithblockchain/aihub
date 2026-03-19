import Foundation
import Security

enum KeychainError: Error {
    case itemNotFound
    case unexpectedData
    case unhandledError(OSStatus)
}

final class KeychainTokenStore: Sendable {
    private let service = "com.localbridge.mac.tokens"
    
    init() {}
    
    func save(key: String, value: String) throws {
        guard let data = value.data(using: .utf8) else {
            throw KeychainError.unexpectedData
        }
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecValueData as String: data
        ]
        
        let status = SecItemAdd(query as CFDictionary, nil)
        
        if status == errSecDuplicateItem {
            let updateQuery: [String: Any] = [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: service,
                kSecAttrAccount as String: key
            ]
            let attributesToUpdate: [String: Any] = [
                kSecValueData as String: data
            ]
            let updateStatus = SecItemUpdate(updateQuery as CFDictionary, attributesToUpdate as CFDictionary)
            if updateStatus != errSecSuccess {
                throw KeychainError.unhandledError(updateStatus)
            }
        } else if status != errSecSuccess {
            throw KeychainError.unhandledError(status)
        }
    }
    
    func load(key: String) throws -> String {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: kCFBooleanTrue!,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        
        var dataTypeRef: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &dataTypeRef)
        
        if status == errSecItemNotFound {
            throw KeychainError.itemNotFound
        } else if status != errSecSuccess {
            throw KeychainError.unhandledError(status)
        }
        
        guard let data = dataTypeRef as? Data,
              let value = String(data: data, encoding: .utf8) else {
            throw KeychainError.unexpectedData
        }
        
        return value
    }
    
    func delete(key: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]
        
        let status = SecItemDelete(query as CFDictionary)
        if status != errSecSuccess && status != errSecItemNotFound {
            throw KeychainError.unhandledError(status)
        }
    }
}

// MARK: - Provider Configuration Management

extension KeychainTokenStore {
    /// Keychain key for storing all provider configurations
    private static let providerConfigsKey = "provider_configs_list"

    /// 保存 Provider 配置
    func saveProviderConfig(_ config: ProviderConfig) throws {
        print("💾 [Keychain] 开始保存 Provider 配置: \(config.name)")
        var configs = try loadAllProviderConfigs()

        // 如果已存在相同 ID 的配置，则更新；否则添加
        if let index = configs.firstIndex(where: { $0.id == config.id }) {
            print("   ↻ 更新现有配置 (ID: \(config.id))")
            configs[index] = config
        } else {
            print("   + 添加新配置 (ID: \(config.id))")
            configs.append(config)
        }

        try saveAllProviderConfigs(configs)
        print("✅ [Keychain] 保存成功，当前共 \(configs.count) 个配置")
    }

    /// 加载所有 Provider 配置
    func loadAllProviderConfigs() throws -> [ProviderConfig] {
        do {
            let jsonString = try load(key: Self.providerConfigsKey)
            guard let data = jsonString.data(using: .utf8) else {
                throw KeychainError.unexpectedData
            }
            let configs = try JSONDecoder().decode([ProviderConfig].self, from: data)
            return configs
        } catch KeychainError.itemNotFound {
            // 如果没有配置，返回空数组
            return []
        }
    }

    /// 加载指定 ID 的 Provider 配置
    func loadProviderConfig(id: String) throws -> ProviderConfig? {
        let configs = try loadAllProviderConfigs()
        return configs.first { $0.id == id }
    }

    /// 删除指定 ID 的 Provider 配置
    func deleteProviderConfig(id: String) throws {
        var configs = try loadAllProviderConfigs()
        configs.removeAll { $0.id == id }
        try saveAllProviderConfigs(configs)
    }

    /// 保存所有 Provider 配置
    private func saveAllProviderConfigs(_ configs: [ProviderConfig]) throws {
        let data = try JSONEncoder().encode(configs)
        guard let jsonString = String(data: data, encoding: .utf8) else {
            throw KeychainError.unexpectedData
        }
        try save(key: Self.providerConfigsKey, value: jsonString)
    }

    /// 获取默认的 Provider 配置（第一个启用的配置）
    func getDefaultProviderConfig() throws -> ProviderConfig? {
        let configs = try loadAllProviderConfigs()
        return configs.first { $0.isEnabled }
    }
}

// MARK: - Legacy API Key Support (Deprecated)

extension KeychainTokenStore {
    @available(*, deprecated, message: "Use ProviderConfig instead")
    static let anthropicAPIKey = "anthropic_api_key"

    @available(*, deprecated, message: "Use ProviderConfig instead")
    static let openAIAPIKey    = "openai_api_key"

    @available(*, deprecated, message: "Use ProviderConfig instead")
    static let geminiAPIKey    = "gemini_api_key"
}
