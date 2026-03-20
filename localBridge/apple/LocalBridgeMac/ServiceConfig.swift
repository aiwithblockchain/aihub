import Foundation

struct ListenAddress: Codable, Equatable {
    var ip: String
    var port: Int
    var enabled: Bool
}

struct ServiceConfig: Codable, Equatable {
    var addresses: [ListenAddress]
}

struct BridgeConfig: Codable, Equatable {
    var tweetClawWS: ServiceConfig
    var aiClawWS: ServiceConfig
    var restAPI: ServiceConfig
}

extension BridgeConfig {
    static func defaultConfig() -> BridgeConfig {
        return BridgeConfig(
            tweetClawWS: ServiceConfig(addresses: [
                ListenAddress(ip: "127.0.0.1", port: 10086, enabled: true)
            ]),
            aiClawWS: ServiceConfig(addresses: [
                ListenAddress(ip: "127.0.0.1", port: 10087, enabled: true)
            ]),
            restAPI: ServiceConfig(addresses: [
                ListenAddress(ip: "127.0.0.1", port: 10088, enabled: true)
            ])
        )
    }

    static func load() -> BridgeConfig {
        let defaults = UserDefaults.standard

        // 尝试从新格式加载
        if let data = defaults.data(forKey: "bridgeConfig"),
           let config = try? JSONDecoder().decode(BridgeConfig.self, from: data) {
            return config
        }

        // 兼容旧格式：从单独的端口配置迁移
        let tweetClawPort = defaults.integer(forKey: "tweetClawPort")
        let aiClawPort = defaults.integer(forKey: "aiClawPort")
        let restApiPort = defaults.integer(forKey: "restApiPort")

        if tweetClawPort > 0 || aiClawPort > 0 || restApiPort > 0 {
            return BridgeConfig(
                tweetClawWS: ServiceConfig(addresses: [
                    ListenAddress(ip: "127.0.0.1", port: tweetClawPort > 0 ? tweetClawPort : 10086, enabled: true)
                ]),
                aiClawWS: ServiceConfig(addresses: [
                    ListenAddress(ip: "127.0.0.1", port: aiClawPort > 0 ? aiClawPort : 10087, enabled: true)
                ]),
                restAPI: ServiceConfig(addresses: [
                    ListenAddress(ip: "127.0.0.1", port: restApiPort > 0 ? restApiPort : 10088, enabled: true)
                ])
            )
        }

        return defaultConfig()
    }

    func save() {
        let defaults = UserDefaults.standard
        if let data = try? JSONEncoder().encode(self) {
            defaults.set(data, forKey: "bridgeConfig")
            defaults.synchronize()
        }
    }
}
