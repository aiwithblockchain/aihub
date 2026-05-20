.PHONY: clean test build build-macos build-rust-static build-all verify

# 运行所有单元测试
test:
	@echo "🧪 Running tests..."
	go test -v -race -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html
	@echo "✅ Tests passed. Coverage report: coverage.html"

# 清理编译输出
clean:
	@echo "🧹 Cleaning..."
	rm -rf lib/
	rm -f coverage.out coverage.html
	@echo "✅ Cleaned"

# 构建 macOS framework
build-macos:
	@echo "🏗️  Building macOS framework..."
	@mkdir -p lib
	@chmod +x scripts/build-macos-framework.sh
	@./scripts/build-macos-framework.sh

# 构建 Rust 可链接静态库
build-rust-static:
	@echo "🏗️  Building Rust static libraries..."
	@mkdir -p lib
	@chmod +x scripts/build-rust-static.sh
	@./scripts/build-rust-static.sh
	@echo "✅ Built universal archive: lib/libLocalBridgeCore.a"

# 全量编译和测试
build-all: clean test build-macos build-rust-static
	@echo ""
	@echo "✨ Build complete!"
	@ls -lh lib/

# 验证编译（不运行测试）
verify:
	@echo "🔍 Verifying build..."
	go build -v ./...
	@echo "✅ Build verification passed"

.DEFAULT_GOAL := help

help:
	@echo "LocalBridge Go Library - Makefile Commands"
	@echo ""
	@echo "Available targets:"
	@echo "  make test              - Run all unit tests with coverage"
	@echo "  make clean             - Clean build artifacts"
	@echo "  make build-macos       - Build macOS framework"
	@echo "  make build-rust-static - Build Rust static libraries"
	@echo "  make build-all         - Clean, test, and build all"
	@echo "  make verify            - Quick build verification"
	@echo "  make help              - Show this help message"
