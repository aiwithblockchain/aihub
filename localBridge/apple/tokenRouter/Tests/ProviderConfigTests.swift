import Foundation

/// 简单的测试脚本，验证 ProviderConfig 和 KeychainTokenStore 功能
/// 运行方式：在 Xcode 中添加此文件到项目，或创建命令行工具目标

func testProviderConfigAndKeychain() {
    print("=== 开始测试 Provider 配置系统 ===\n")

    let keychain = KeychainTokenStore()

    // 测试 1: 创建 Provider 配置
    print("测试 1: 创建 Provider 配置")
    let anthropicConfig = ProviderConfig.anthropicDirect(
        apiKey: "sk-ant-test-key-12345",
        model: "claude-sonnet-4-20250514"
    )
    print("✅ 创建成功: \(anthropicConfig.name)")
    print("   - Base URL: \(anthropicConfig.baseURL)")
    print("   - Model: \(anthropicConfig.model ?? "nil")")
    print("   - 代理模式: \(anthropicConfig.isProxyMode ? "是" : "否")\n")

    // 测试 2: 保存到 Keychain
    print("测试 2: 保存配置到 Keychain")
    do {
        try keychain.saveProviderConfig(anthropicConfig)
        print("✅ 保存成功\n")
    } catch {
        print("❌ 保存失败: \(error)\n")
        return
    }

    // 测试 3: 从 Keychain 读取
    print("测试 3: 从 Keychain 读取配置")
    do {
        let configs = try keychain.loadAllProviderConfigs()
        print("✅ 读取成功，共 \(configs.count) 个配置")
        for config in configs {
            print("   - \(config.name) (\(config.providerType.displayName))")
        }
        print()
    } catch {
        print("❌ 读取失败: \(error)\n")
        return
    }

    // 测试 4: 创建 CC Switch 代理配置
    print("测试 4: 创建 CC Switch 代理配置")
    let ccSwitchConfig = ProviderConfig.ccSwitchProxy(port: 8080, model: "claude-3-5-sonnet-20241022")
    print("✅ 创建成功: \(ccSwitchConfig.name)")
    print("   - Base URL: \(ccSwitchConfig.baseURL)")
    print("   - API Key: \(ccSwitchConfig.apiKey)")
    print("   - 代理模式: \(ccSwitchConfig.isProxyMode ? "是" : "否")\n")

    // 测试 5: 保存第二个配置
    print("测试 5: 保存 CC Switch 配置")
    do {
        try keychain.saveProviderConfig(ccSwitchConfig)
        print("✅ 保存成功\n")
    } catch {
        print("❌ 保存失败: \(error)\n")
        return
    }

    // 测试 6: 读取所有配置
    print("测试 6: 读取所有配置")
    do {
        let configs = try keychain.loadAllProviderConfigs()
        print("✅ 读取成功，共 \(configs.count) 个配置:")
        for (index, config) in configs.enumerated() {
            print("   \(index + 1). \(config.name)")
            print("      - Type: \(config.providerType.displayName)")
            print("      - Base URL: \(config.baseURL)")
            print("      - Model: \(config.model ?? "未指定")")
            print("      - 代理模式: \(config.isProxyMode ? "是" : "否")")
            print("      - 启用: \(config.isEnabled ? "是" : "否")")
        }
        print()
    } catch {
        print("❌ 读取失败: \(error)\n")
        return
    }

    // 测试 7: 获取默认配置
    print("测试 7: 获取默认配置")
    do {
        if let defaultConfig = try keychain.getDefaultProviderConfig() {
            print("✅ 默认配置: \(defaultConfig.name)\n")
        } else {
            print("⚠️  没有启用的配置\n")
        }
    } catch {
        print("❌ 获取失败: \(error)\n")
        return
    }

    // 测试 8: 测试 endpoint 方法
    print("测试 8: 测试 endpoint 方法")
    let endpoint1 = anthropicConfig.endpoint(path: "/messages")
    let endpoint2 = ccSwitchConfig.endpoint(path: "messages")
    print("✅ Anthropic endpoint: \(endpoint1)")
    print("✅ CC Switch endpoint: \(endpoint2)\n")

    // 测试 9: 更新配置
    print("测试 9: 更新配置")
    let updatedConfig = anthropicConfig.updated(
        name: "Claude (直连 - 已更新)",
        model: "claude-opus-4-20250514"
    )
    do {
        try keychain.saveProviderConfig(updatedConfig)
        print("✅ 更新成功\n")
    } catch {
        print("❌ 更新失败: \(error)\n")
        return
    }

    // 测试 10: 删除配置
    print("测试 10: 删除配置")
    do {
        try keychain.deleteProviderConfig(id: ccSwitchConfig.id)
        print("✅ 删除成功: \(ccSwitchConfig.name)\n")

        let remainingConfigs = try keychain.loadAllProviderConfigs()
        print("   剩余配置数: \(remainingConfigs.count)\n")
    } catch {
        print("❌ 删除失败: \(error)\n")
        return
    }

    // 清理：删除所有测试配置
    print("清理: 删除所有测试配置")
    do {
        let allConfigs = try keychain.loadAllProviderConfigs()
        for config in allConfigs {
            try keychain.deleteProviderConfig(id: config.id)
        }
        print("✅ 清理完成\n")
    } catch {
        print("❌ 清理失败: \(error)\n")
    }

    print("=== 所有测试完成 ===")
}

// 如果作为独立脚本运行
#if DEBUG
// 在 Xcode 中可以通过添加一个测试目标来运行此函数
// 或者在 main.swift 中调用: testProviderConfigAndKeychain()
#endif
