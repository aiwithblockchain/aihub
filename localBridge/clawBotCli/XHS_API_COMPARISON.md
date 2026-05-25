# XHS API 实现对比：tweetClaw vs Spider_XHS

本文档对比 tweetClaw 中已实现的 XHS API 与 Spider_XHS 的实现，确保参数和请求体结构完全对齐。

---

## API 对比清单

### 1. 获取账号信息 (Account Info)

**Spider_XHS 实现** (`xhs_pc_apis.py:141-157`):
```python
api = "/api/sns/web/v1/user/selfinfo"
method = 'GET'
# 无请求体
```

**tweetClaw 实现** (`xhs-main-entrance.ts:558-560`):
```typescript
async function fetchCurrentUser(): Promise<any> {
  return signedFetch('/api/sns/web/v2/user/me', 'GET');
}
```

**问题**: ❌ **API 端点不一致**
- Spider_XHS 使用: `/api/sns/web/v1/user/selfinfo`
- tweetClaw 使用: `/api/sns/web/v2/user/me`

**建议**: 需要确认哪个端点是正确的，或者两个都支持。

---

### 2. 获取首页 Feed (Homefeed)

**Spider_XHS 实现** (`xhs_pc_apis.py:46-84`):
```python
api = "/api/sns/web/v1/homefeed"
method = 'POST'
data = {
    "cursor_score": cursor_score,
    "num": 20,
    "refresh_type": refresh_type,  # 1=首次, 3=刷新
    "note_index": note_index,      # 0=首次, 20=刷新
    "unread_begin_note_id": "",
    "unread_end_note_id": "",
    "unread_note_count": 0,
    "category": category,          # 频道名称
    "search_key": "",
    "need_num": 10,
    "image_formats": ["jpg", "webp", "avif"],
    "need_filter_image": False
}
```

**tweetClaw 实现** (`xhs-main-entrance.ts:566-583`):
```typescript
async function fetchHomefeed(cursorScore: string = ''): Promise<any> {
  const isFirstPage = !cursorScore.trim();
  const body = {
    cursor_score: cursorScore,
    num: 35,                        // ⚠️ Spider_XHS 用 20
    refresh_type: isFirstPage ? 1 : 3,
    note_index: isFirstPage ? 0 : 35,  // ⚠️ Spider_XHS 用 20
    unread_begin_note_id: '',
    unread_end_note_id: '',
    unread_note_count: 0,
    category: 'homefeed_recommend',
    search_key: '',
    need_num: 10,
    image_formats: ['jpg', 'webp', 'avif'],
    need_filter_image: false,
  };
  return signedFetch('/api/sns/web/v1/homefeed', 'POST', JSON.stringify(body));
}
```

**问题**: ⚠️ **参数值不一致**
- `num`: tweetClaw 用 35，Spider_XHS 用 20
- `note_index`: tweetClaw 用 35，Spider_XHS 用 20

**建议**: 统一使用 Spider_XHS 的值（20），或者将其作为可配置参数。

---

### 3. 获取笔记详情 (Feed/Note Detail)

**Spider_XHS 实现**: ❌ **未找到对应实现**

**tweetClaw 实现** (`xhs-main-entrance.ts:585-592`):
```typescript
async function fetchFeed(noteId: string): Promise<any> {
  const body = {
    source_note_id: noteId,
    image_formats: ['jpg', 'webp', 'avif'],
    extra: { need_body_topic: 1 },
  };
  return signedFetch('/api/sns/web/v1/feed', 'POST', JSON.stringify(body));
}
```

**问题**: ⚠️ **Spider_XHS 中没有对应实现，无法验证**

**建议**: 保持当前实现，但需要实际测试验证。

---

### 4. 搜索笔记 (Search Notes)

**Spider_XHS 实现** (`xhs_pc_apis.py:476-530`):
```python
api = "/api/sns/web/v1/search/notes"
method = 'POST'
data = {
    "keyword": query,
    "page": page,
    "page_size": 20,
    "search_id": search_id or generate_search_id(),  # ✅ 必须生成
    "sort": "general",
    "note_type": 0,
    "ext_flags": [],                                  # ✅ 必须包含
    "filters": [                                      # ✅ 必须包含
        {"tags": [sort_type], "type": "sort_type"},
        {"tags": [filter_note_type], "type": "filter_note_type"},
        {"tags": [filter_note_time], "type": "filter_note_time"},
        {"tags": [filter_note_range], "type": "filter_note_range"},
        {"tags": [filter_pos_distance], "type": "filter_pos_distance"}
    ]
}
```

**tweetClaw 实现** (`xhs-main-entrance.ts:594-618`):
```typescript
async function searchNotes(keyword: string, cursor: string = '', pageSize: number = 20): Promise<any> {
  const timestamp = Date.now();
  const random = Math.ceil(0x7ffffffe * Math.random());
  const searchId = ((timestamp << 64) + random).toString(36);  // ✅ 已修复

  const body: any = {
    keyword,
    page: 1,
    page_size: pageSize,
    search_id: searchId,                              // ✅ 已修复
    sort: 'general',
    note_type: 0,
    ext_flags: [],                                    // ✅ 已修复
    filters: [                                        // ✅ 已修复
      { tags: ['general'], type: 'sort_type' },
      { tags: ['不限'], type: 'filter_note_type' },
      { tags: ['不限'], type: 'filter_note_time' },
      { tags: ['不限'], type: 'filter_note_range' },
      { tags: ['不限'], type: 'filter_pos_distance' }
    ]
  };
  if (cursor) body.cursor = cursor;
  return signedFetch('/api/sns/web/v1/search/notes', 'POST', JSON.stringify(body));
}
```

**问题**: ⚠️ **search_id 生成算法可能不正确**
- Spider_XHS 使用复杂的 base36 编码: `_int_to_base36((timestamp_ms << 64) + random_part)`
- tweetClaw 使用简化版本: `((timestamp << 64) + random).toString(36)`
- JavaScript 的位运算限制在 32 位，`<< 64` 会溢出

**建议**: 修复 search_id 生成算法。

---

### 5. 获取用户笔记 (User Notes)

**Spider_XHS 实现** (`xhs_pc_apis.py:178-205`):
```python
api = "/api/sns/web/v1/user_posted"
method = 'GET'
params = {
    "num": "30",
    "cursor": cursor,
    "user_id": user_id,
    "image_formats": "jpg,webp,avif",
    "xsec_token": xsec_token,      # ⚠️ 可选参数
    "xsec_source": xsec_source,    # ⚠️ 可选参数
}
```

**tweetClaw 实现** (`xhs-main-entrance.ts:620-628`):
```typescript
async function fetchUserNotes(userId: string, cursor: string = ''): Promise<any> {
  const params = new URLSearchParams({
    user_id: userId,
    cursor,
    num: '30',
    image_formats: 'jpg,webp,avif',
  });
  return signedFetch(`/api/sns/web/v1/user_posted?${params}`, 'GET');
}
```

**问题**: ⚠️ **缺少可选参数**
- 缺少 `xsec_token` 和 `xsec_source` 参数

**建议**: 添加可选参数支持，或者确认这些参数是否必需。

---

### 6. 获取笔记评论 (Note Comments)

**Spider_XHS 实现**: ❌ **未找到对应实现**

**tweetClaw 实现** (`xhs-main-entrance.ts:630-638`):
```typescript
async function fetchComments(noteId: string, cursor: string = ''): Promise<any> {
  const params = new URLSearchParams({
    note_id: noteId,
    cursor,
    top_comment_id: '',
    image_formats: 'jpg,webp,avif',
  });
  return signedFetch(`/api/sns/web/v2/comment/page?${params}`, 'GET');
}
```

**问题**: ⚠️ **Spider_XHS 中没有对应实现，无法验证**
- 从浏览器日志看到返回 461 错误（反爬虫）

**建议**: 保持当前实现，但需要处理 461 错误。

---

### 7. 获取用户信息 (User Info)

**Spider_XHS 实现** (`xhs_pc_apis.py:118-139`):
```python
api = "/api/sns/web/v1/user/otherinfo"
method = 'GET'
params = {
    "target_user_id": user_id
}
```

**tweetClaw 实现** (`xhs-main-entrance.ts:640-645`):
```typescript
async function fetchUserInfo(userId: string): Promise<any> {
  const params = new URLSearchParams({
    target_user_id: userId,
  });
  return signedFetch(`/api/sns/web/v1/user/otherinfo?${params}`, 'GET');
}
```

**问题**: ✅ **完全一致**

---

### 8. 搜索话题 (Search Topics)

**Spider_XHS 实现**: ❌ **未找到对应实现**

**tweetClaw 实现** (`xhs-main-entrance.ts:647-651`):
```typescript
async function searchTopics(keyword: string): Promise<any> {
  const params = new URLSearchParams({
    keyword,
    suggest_topic_request: JSON.stringify({ title: keyword, desc: '' }),
  });
  return signedFetch(`/web_api/sns/v1/search/topic?${params}`, 'GET');
}
```

**问题**: ❌ **API 返回 404 错误**
- 从浏览器日志看到: `GET .../web_api/sns/v1/search/topic... 404 (Not Found)`
- 端点可能不存在或 URL 错误

**建议**: 需要找到正确的话题搜索端点。

---

### 9. 获取通知 (Notifications)

**Spider_XHS 实现**: ❌ **未找到对应实现**

**tweetClaw 实现** (`xhs-main-entrance.ts:642-651`):
```typescript
async function fetchNotifications(type: 'mentions' | 'likes', cursor: string = ''): Promise<any> {
  const endpoint = type === 'mentions'
    ? '/api/sns/web/v1/you/mentions'
    : '/api/sns/web/v1/you/likes';
  const params = new URLSearchParams({
    cursor,
    num: '20',
  });
  return signedFetch(`${endpoint}?${params}`, 'GET');
}
```

**问题**: ⚠️ **Spider_XHS 中没有对应实现，无法验证**

**建议**: 保持当前实现，需要实际测试验证。

---

### 10. 获取已发布笔记 (Published Notes)

**Spider_XHS 实现**: ❌ **未找到对应实现**

**tweetClaw 实现** (`xhs-main-entrance.ts:653-660`):
```typescript
async function fetchPublishedNotes(cursor: string = ''): Promise<any> {
  const params = new URLSearchParams({
    cursor,
    num: '30',
    image_formats: 'jpg,webp,avif',
  });
  return signedCreatorFetch(`/api/galaxy/creator/note/user/posted?${params}`, 'GET');
}
```

**问题**: ⚠️ **使用了不同的端点和签名方法**
- 使用 `signedCreatorFetch` 而不是 `signedFetch`
- 端点是 `/api/galaxy/creator/...` 而不是 `/api/sns/web/...`
- 从测试结果看返回 "Failed to fetch" 错误

**建议**: 需要确认正确的端点和签名方法。

---

## 关键问题总结

### 🔴 高优先级问题

1. **搜索笔记 search_id 生成算法错误**
   - JavaScript 位运算限制导致 `<< 64` 溢出
   - 需要修复为正确的算法

2. **搜索话题 API 404 错误**
   - 端点 `/web_api/sns/v1/search/topic` 不存在
   - 需要找到正确的端点

3. **账号信息 API 端点不一致**
   - Spider_XHS: `/api/sns/web/v1/user/selfinfo`
   - tweetClaw: `/api/sns/web/v2/user/me`
   - 需要确认正确的端点

### ⚠️ 中优先级问题

4. **首页 Feed 参数值不一致**
   - `num` 和 `note_index` 的值不同
   - 建议统一为 Spider_XHS 的值

5. **用户笔记缺少可选参数**
   - 缺少 `xsec_token` 和 `xsec_source`
   - 需要确认是否必需

6. **评论 API 返回 461 错误**
   - XHS 反爬虫机制
   - 需要处理或绕过

### ℹ️ 低优先级问题

7. **多个 API 在 Spider_XHS 中没有对应实现**
   - 笔记详情、评论、通知、已发布笔记
   - 无法通过对比验证，需要实际测试

---

## 修复建议

### 立即修复

1. **修复 searchNotes 的 search_id 生成**
2. **找到正确的搜索话题端点**
3. **统一账号信息 API 端点**

### 后续优化

4. 统一首页 Feed 的参数值
5. 添加用户笔记的可选参数
6. 处理评论 API 的 461 错误
7. 测试验证 Spider_XHS 中没有的 API

---

## 下一步行动

1. 修复 `searchNotes` 函数的 `search_id` 生成算法
2. 在 Spider_XHS 中搜索话题相关的实现
3. 确认账号信息 API 的正确端点
4. 重新编译并测试所有 API
