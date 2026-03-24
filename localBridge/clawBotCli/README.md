# ClawBot CLI - REST API 测试工具

AI-Oriented 推特自动化测试工具集，用于测试 LocalBridge REST API。

## 安装

```bash
pip install -r requirements.txt
```

## 配置

默认配置：
- REST API 地址: `http://127.0.0.1:10088`
- 可在 `config.py` 中修改

## 使用方法

### 测试所有 API
```bash
python test_all.py
```

### 测试特定类别
```bash
# 测试状态查询 API
python tests/test_status.py

# 测试读取类 API
python tests/test_read_apis.py

# 测试写入类 API
python tests/test_write_apis.py

# 测试标签页控制
python tests/test_tab_control.py

# 测试搜索功能
python tests/test_search.py
```

### 单个 API 测试
```bash
# 查询 X 标签页状态
python -c "from utils.api_client import APIClient; print(APIClient().get_x_status())"

# 查询当前登录账号信息
python -c "from utils.api_client import APIClient; print(APIClient().get_basic_info())"
```

## 响应验证

所有测试脚本会验证：
1. HTTP 状态码是否为 200
2. 响应是否为有效的 JSON
3. 响应是否包含推特原始数据结构（如 `data`, `legacy`, `rest_id` 等字段）

## 注意事项

1. **需要运行 LocalBridgeMac 应用**：确保 LocalBridge 服务正在运行
2. **需要加载 tweetClaw 扩展**：确保浏览器已加载 tweetClaw 扩展并连接到 LocalBridge
3. **需要登录 X 账号**：某些 API 需要在浏览器中登录 X 账号
4. **响应为原始数据**：所有响应都是推特 GraphQL 原始响应，需要 AI 自行解析

## 目录结构

```
clawBotCli/
├── README.md              # 本文件
├── requirements.txt       # Python 依赖
├── config.py             # 配置文件
├── test_all.py           # 测试所有 API
├── tests/                # 测试脚本目录
│   ├── test_status.py
│   ├── test_read_apis.py
│   ├── test_write_apis.py
│   ├── test_tab_control.py
│   └── test_search.py
└── utils/                # 工具模块
    ├── api_client.py     # REST API 客户端
    └── response_parser.py # 响应验证工具
```

## 示例输出

```json
{
  "data": {
    "user": {
      "result": {
        "__typename": "User",
        "rest_id": "1234567890",
        "legacy": {
          "screen_name": "username",
          "followers_count": 1000,
          "friends_count": 500
        }
      }
    }
  }
}
```

## 故障排查

### 连接失败
- 检查 LocalBridgeMac 是否正在运行
- 检查端口配置是否正确（默认 10088）

### 503 错误
- 检查 tweetClaw 扩展是否已加载
- 检查扩展是否已连接到 LocalBridge（查看扩展 popup）

### 空响应或错误
- 检查是否已在浏览器中登录 X 账号
- 检查是否有打开的 X 标签页
