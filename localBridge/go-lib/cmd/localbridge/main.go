package main

/*
#include <stdlib.h>
*/
import "C"
import (
	"encoding/json"
	"unsafe"

	"github.com/hyperorchid/localbridge/pkg/bridge"
)

// LocalBridgeStart 启动桥接服务（tweetClawPort/aiClawPort 传 0 则读配置文件默认值）
//
//export LocalBridgeStart
func LocalBridgeStart(tweetClawPort C.int, aiClawPort C.int) C.int {
	if err := bridge.StartDefault(); err != nil {
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

func main() {} // CGo 要求 main 包必须有 main()，此处无实际逻辑
