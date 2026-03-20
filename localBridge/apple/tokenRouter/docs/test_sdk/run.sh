#!/bin/bash

# 从 Claude Code 环境中读取配置
# 注意：这个脚本需要在 Claude Code 的 Bash 工具中运行才能获取到环境变量

if [ -z "$ANTHROPIC_AUTH_TOKEN" ]; then
    echo "错误: ANTHROPIC_AUTH_TOKEN 未设置"
    echo "请通过 Claude Code 的 Bash 工具运行此脚本，或手动设置环境变量"
    exit 1
fi

# 将 ANTHROPIC_AUTH_TOKEN 设置为 ANTHROPIC_API_KEY（SDK 需要这个变量名）
export ANTHROPIC_API_KEY="$ANTHROPIC_AUTH_TOKEN"

# 运行程序
npm start "$@"
