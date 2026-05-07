package main

/*
#include <stdlib.h>
*/
import "C"
import (
	"encoding/json"
	"log"
	"strings"
	"sync"
	"unsafe"

	"github.com/hyperorchid/localbridge/pkg/bridge"
)

const maxLogLines = 2000

var logBuf struct {
	mu    sync.Mutex
	lines []string
}

var bridgeState struct {
	mu      sync.Mutex
	lastErr string
}

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
	log.SetFlags(log.LstdFlags | log.Lmicroseconds)
	log.SetOutput(bridgeLogWriter{})
}

func setLastErr(msg string) {
	bridgeState.mu.Lock()
	defer bridgeState.mu.Unlock()
	bridgeState.lastErr = msg
}

func getLastErr() string {
	bridgeState.mu.Lock()
	defer bridgeState.mu.Unlock()
	return bridgeState.lastErr
}

//export LocalBridgeStart
func LocalBridgeStart() C.int {
	if err := bridge.StartDefault(); err != nil {
		setLastErr(err.Error())
		return -1
	}
	setLastErr("")
	return 0
}

//export LocalBridgeStop
func LocalBridgeStop() {
	bridge.StopDefault()
}

//export LocalBridgeGetInstancesJSON
func LocalBridgeGetInstancesJSON() *C.char {
	instances := bridge.GetDefaultInstances()
	data, err := json.Marshal(instances)
	if err != nil {
		setLastErr(err.Error())
		return C.CString("[]")
	}
	return C.CString(string(data))
}

//export LocalBridgeGetLastErrorJSON
func LocalBridgeGetLastErrorJSON() *C.char {
	data, _ := json.Marshal(map[string]any{"error": getLastErr()})
	return C.CString(string(data))
}

//export LocalBridgeFreeString
func LocalBridgeFreeString(s *C.char) {
	C.free(unsafe.Pointer(s))
}

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

func main() {}
