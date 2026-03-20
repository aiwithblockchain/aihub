import Foundation
import Network

class NetworkUtils {
    /// 获取所有本地 IPv4 地址（排除 127.0.0.1）
    static func getLocalIPAddresses() -> [String] {
        var addresses: [String] = []

        // 获取所有网络接口
        var ifaddr: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&ifaddr) == 0 else { return [] }
        guard let firstAddr = ifaddr else { return [] }

        defer { freeifaddrs(ifaddr) }

        // 遍历所有接口
        for ifptr in sequence(first: firstAddr, next: { $0.pointee.ifa_next }) {
            let interface = ifptr.pointee

            // 只处理 IPv4 地址
            let addrFamily = interface.ifa_addr.pointee.sa_family
            if addrFamily == UInt8(AF_INET) {
                // 获取接口名称
                let name = String(cString: interface.ifa_name)

                // 跳过回环接口
                if name == "lo0" {
                    continue
                }

                // 转换地址
                var hostname = [CChar](repeating: 0, count: Int(NI_MAXHOST))
                getnameinfo(interface.ifa_addr,
                           socklen_t(interface.ifa_addr.pointee.sa_len),
                           &hostname,
                           socklen_t(hostname.count),
                           nil,
                           socklen_t(0),
                           NI_NUMERICHOST)

                let address = String(cString: hostname)

                // 排除 127.0.0.1 和特殊地址
                // 198.18.0.0/15 是 iOS/macOS 的共享网络地址段
                if address != "127.0.0.1" &&
                   !address.isEmpty &&
                   !address.hasPrefix("198.18.") &&
                   !address.hasPrefix("169.254.") { // 也排除链路本地地址
                    addresses.append(address)
                }
            }
        }

        return addresses
    }
}
