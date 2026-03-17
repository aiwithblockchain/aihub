#!/usr/bin/env python3
"""
python3 test_api.py
LocalBridge REST API Test Suite
前提：LocalBridgeMac 已启动，tweetClaw 扩展已连接，X.com 已打开并登录
运行：python3 test_api.py
"""

import json
import time
import urllib.request
import urllib.error
from typing import Any, Dict, List, Optional

BASE_URL = "http://127.0.0.1:8769"
TIMEOUT = 15  # 秒

def http_get(path: str) -> Optional[Any]:
    """发送 GET 请求，返回解析后的 JSON 或 None"""
    url = f"{BASE_URL}{path}"
    try:
        with urllib.request.urlopen(url, timeout=TIMEOUT) as response:
            return json.loads(response.read().decode('utf-8'))
    except Exception as e:
        print(f"Error on GET {path}: {e}")
        return None

def http_post(path: str, body: dict) -> Optional[Any]:
    """发送 POST 请求，返回解析后的 JSON 或 None"""
    url = f"{BASE_URL}{path}"
    data = json.dumps(body).encode('utf-8')
    req = urllib.request.Request(url, data=data, method='POST')
    req.add_header('Content-Type', 'application/json')
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as response:
            return json.loads(response.read().decode('utf-8'))
    except Exception as e:
        # Some errors might still return valid JSON body (e.g. 400 Bad Request)
        if isinstance(e, urllib.error.HTTPError):
            try:
                return json.loads(e.read().decode('utf-8'))
            except:
                pass
        print(f"Error on POST {path}: {e}")
        return None

def check_keys(data: Any, required_keys: List[str]) -> tuple[bool, str]:
    """检查 JSON 对象中必填 key 是否存在，返回 (passed, error_msg)"""
    if data is None:
        return False, "No response data"
    if not isinstance(data, dict):
        return False, f"Expected dict, got {type(data).__name__}"
    for key in required_keys:
        if key not in data:
            return False, f"Missing key: {key}"
    return True, ""

def run_tests():
    passed = 0
    failed = 0
    opened_tab_id = None

    print("=" * 47)
    print("  LocalBridge REST API Test Suite")
    print(f"  Base URL: {BASE_URL}")
    print("=" * 47)

    # 1. GET /api/v1/x/status
    res1 = http_get("/api/v1/x/status")
    ok1, err1 = check_keys(res1, ["hasXTabs", "isLoggedIn", "tabs"])
    print(f"[1/11] GET /api/v1/x/status               ... {'PASS' if ok1 else 'FAIL'} {err1}")
    if ok1: passed += 1 
    else: failed += 1

    # 2. GET /api/v1/x/basic_info
    res2 = http_get("/api/v1/x/basic_info")
    ok2, err2 = check_keys(res2, ["isLoggedIn", "twitterId"])
    print(f"[2/11] GET /api/v1/x/basic_info           ... {'PASS' if ok2 else 'FAIL'} {err2}")
    if ok2: passed += 1
    else: failed += 1

    # 3. POST /tweetclaw/open-tab
    res3 = http_post("/tweetclaw/open-tab", {"path": "home"})
    ok3, err3 = check_keys(res3, ["success", "tabId"])
    if ok3:
        opened_tab_id = res3.get("tabId")
        print(f"[3/11] POST /tweetclaw/open-tab            ... PASS  (tabId={opened_tab_id})")
        passed += 1
    else:
        print(f"[3/11] POST /tweetclaw/open-tab            ... FAIL  {err3}")
        failed += 1

    # 4. POST /tweetclaw/navigate-tab
    res4 = http_post("/tweetclaw/navigate-tab", {"path": "home"})
    ok4, err4 = check_keys(res4, ["success", "tabId", "url"])
    print(f"[4/11] POST /tweetclaw/navigate-tab        ... {'PASS' if ok4 else 'FAIL'} {err4}")
    if ok4: passed += 1
    else: failed += 1

    # 5. POST /tweetclaw/close-tab
    if opened_tab_id:
        res5 = http_post("/tweetclaw/close-tab", {"tabId": opened_tab_id})
        ok5, err5 = check_keys(res5, ["success", "reason"])
        print(f"[5/11] POST /tweetclaw/close-tab           ... {'PASS' if ok5 else 'FAIL'} {err5}")
        if ok5: passed += 1
        else: failed += 1
    else:
        print("[5/11] POST /tweetclaw/close-tab           ... SKIP  (No tab opened in step 3)")

    # 6. POST /api/v1/x/likes
    # Use tweetId=20 (First tweet) to avoid noise
    res6 = http_post("/api/v1/x/likes", {"tweetId": "20"})
    ok6 = res6 is not None and "ok" in res6
    print(f"[6/11] POST /api/v1/x/likes               ... {'PASS' if ok6 else 'FAIL'}")
    if ok6: passed += 1
    else: failed += 1

    # 7. POST /api/v1/x/retweets
    res7 = http_post("/api/v1/x/retweets", {"tweetId": "20"})
    ok7 = res7 is not None and "ok" in res7
    print(f"[7/11] POST /api/v1/x/retweets            ... {'PASS' if ok7 else 'FAIL'}")
    if ok7: passed += 1
    else: failed += 1

    # 8. POST /api/v1/x/bookmarks
    res8 = http_post("/api/v1/x/bookmarks", {"tweetId": "20"})
    ok8 = res8 is not None and "ok" in res8
    print(f"[8/11] POST /api/v1/x/bookmarks           ... {'PASS' if ok8 else 'FAIL'}")
    if ok8: passed += 1
    else: failed += 1

    # 9. POST /api/v1/x/follows
    # Use userId=783214 (@twitter official)
    res9 = http_post("/api/v1/x/follows", {"userId": "783214"})
    ok9 = res9 is not None and "ok" in res9
    print(f"[9/11] POST /api/v1/x/follows             ... {'PASS' if ok9 else 'FAIL'}")
    if ok9: passed += 1
    else: failed += 1

    # 10. POST /api/v1/x/unfollows
    res10 = http_post("/api/v1/x/unfollows", {"userId": "783214"})
    ok10 = res10 is not None and "ok" in res10
    print(f"[10/11] POST /api/v1/x/unfollows          ... {'PASS' if ok10 else 'FAIL'}")
    if ok10: passed += 1
    else: failed += 1

    # 11. GET /api/v1/docs
    res11 = http_get("/api/v1/docs")
    ok11 = isinstance(res11, list) and len(res11) > 0
    print(f"[11/11] GET /api/v1/docs                  ... {'PASS' if ok11 else 'FAIL'} ({len(res11) if ok11 else 0} APIs documented)")
    if ok11: passed += 1
    else: failed += 1

    print("=" * 47)
    print(f"  Results: {passed} passed / {failed} failed")
    print("=" * 47)

    return failed == 0

if __name__ == "__main__":
    import sys
    success = run_tests()
    sys.exit(0 if success else 1)
