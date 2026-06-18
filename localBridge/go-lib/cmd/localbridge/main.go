package main

/*
#include <stdlib.h>
*/
import "C"
import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"unsafe"

	"github.com/hyperorchid/localbridge/pkg/bridge"
	"github.com/hyperorchid/localbridge/pkg/restapi"
)

// ─── 内存日志环形缓冲 ─────────────────────────────────────────────────────────

const maxLogLines = 2000

var logBuf struct {
	mu    sync.Mutex
	lines []string
}

// bridgeLogWriter 实现 io.Writer，接管 Go 标准 log 输出
type bridgeLogWriter struct{}

func (bridgeLogWriter) Write(p []byte) (int, error) {
	line := strings.TrimRight(string(p), "\n")
	logBuf.mu.Lock()
	logBuf.lines = append(logBuf.lines, line)
	if len(logBuf.lines) > maxLogLines {
		logBuf.lines = logBuf.lines[len(logBuf.lines)-maxLogLines:]
	}
	logBuf.mu.Unlock()
	return len(p), nil
}

func init() {
	// 保留时间戳，重定向所有 log.Printf 到内存缓冲
	log.SetFlags(log.LstdFlags | log.Lmicroseconds)
	log.SetOutput(bridgeLogWriter{})
}

// apiDocsCandidates 返回 localbridge 专属的 api_docs.json 候选路径（按优先级排列）
func apiDocsCandidates() []string {
	execPath, err := os.Executable()
	var bundlePath string
	if err == nil && strings.Contains(execPath, ".app/Contents/MacOS/") {
		bundlePath = strings.Replace(
			execPath,
			"/Contents/MacOS/"+filepath.Base(execPath),
			"/Contents/Resources/api_docs.json",
			1,
		)
	}
	return []string{
		bundlePath,
		"api_docs.json",
		"LocalBridgeMac/api_docs.json",
		os.ExpandEnv("$HOME/aiwithblockchain/aihub/localBridge/apple/LocalBridgeMac/api_docs.json"),
	}
}

// registerLocalBridgeRoutes 注册 localbridge 专属路由
func registerLocalBridgeRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/v1/x/docs", restapi.NewAPIDocsHandler(apiDocsCandidates()))
}

// LocalBridgeStartWithConfig 使用 JSON 配置字符串启动桥接服务
//
//export LocalBridgeStartWithConfig
func LocalBridgeStartWithConfig(configJSON *C.char) C.int {
	configJSONStr := C.GoString(configJSON)
	line := fmt.Sprintf("[LocalBridge] Received config JSON: %s", configJSONStr)
	bridgeLogWriter{}.Write([]byte(line))
	if err := bridge.StartWithConfigJSON(configJSONStr, registerLocalBridgeRoutes); err != nil {
		return -1
	}
	return 0
}

// LocalBridgeStop 停止全部服务并释放资源
//
//export LocalBridgeStop
func LocalBridgeStop() {
	bridge.StopDefault()
}

// LocalBridgeGetInstancesJSON 返回在线实例 JSON 数组字符串
// 调用方使用完毕后 **必须** 调用 LocalBridgeFreeString 释放内存，防止泄漏
//
//export LocalBridgeGetInstancesJSON
func LocalBridgeGetInstancesJSON() *C.char {
	instances := bridge.GetDefaultInstances()
	data, err := json.Marshal(instances)
	if err != nil {
		log.Printf("[Bridge] LocalBridgeGetInstancesJSON marshal failed: %v", err)
		return C.CString("[]")
	}
	return C.CString(string(data))
}

// LocalBridgeFreeString 释放由 Go 分配的 C 字符串
//
//export LocalBridgeFreeString
func LocalBridgeFreeString(s *C.char) {
	C.free(unsafe.Pointer(s))
}

// LocalBridgeGetLogsJSON 返回当前全量日志的 JSON 数组字符串（最多 2000 条）
// 调用方使用完毕后 **必须** 调用 LocalBridgeFreeString 释放内存
//
//export LocalBridgeGetLogsJSON
func LocalBridgeGetLogsJSON() *C.char {
	logBuf.mu.Lock()
	snapshot := make([]string, len(logBuf.lines))
	copy(snapshot, logBuf.lines)
	logBuf.mu.Unlock()

	data, err := json.Marshal(snapshot)
	if err != nil {
		return C.CString("[]")
	}
	return C.CString(string(data))
}

func main() {} // CGo 要求 main 包必须有 main()，此处无实际逻辑
