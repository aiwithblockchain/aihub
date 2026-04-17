# TASK-009: 文档和发布准备

**优先级:** P3  
**预计时间:** 0.5天  
**依赖:** TASK-008

## 目标

完善文档,准备发布小红书集成版本。

## 实现内容

### 1. 更新 README

**文件:** `README.md` (扩展)

添加小红书支持说明:

```markdown
# TweetClaw

Powerful agentic tool for X and Xiaohongshu web session binding.

## Supported Platforms

- **X (Twitter)** - Full support for tweets, profiles, timelines, and interactions
- **Xiaohongshu (小红书)** - Support for notes, user profiles, and interactions

## Features

### X (Twitter)
- Capture tweets and timelines
- User profile extraction
- Like, retweet, bookmark operations
- Reply and post tweets

### Xiaohongshu (小红书)
- Capture notes (图文/视频)
- User profile extraction
- Like, collect, follow operations
- Comment on notes

## Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Build the extension: `npm run build:r`
4. Load in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist/` directory

## Usage

### For X (Twitter)
Visit https://x.com/ and the extension will automatically capture data.

### For Xiaohongshu (小红书)
Visit https://www.xiaohongshu.com/ and the extension will automatically capture data.

## Development

```bash
# Development build
npm run build:d

# Production build
npm run build:r

# Run tests
npm test
```

## Architecture

See [docs/xiaohongshu-integration-plan.md](docs/xiaohongshu-integration-plan.md) for details on the Xiaohongshu integration.

## License

[Your License]
```

### 2. 创建使用文档

**文件:** `docs/xiaohongshu-usage.md`

```markdown
# 小红书集成使用指南

## 功能概览

TweetClaw 现在支持小红书平台,提供以下功能:

1. **数据捕获** - 自动捕获浏览的笔记和用户资料
2. **互动操作** - 通过 API 执行点赞、收藏、关注等操作
3. **数据存储** - 将捕获的数据存储在本地

## 快速开始

### 1. 安装扩展

按照 README 中的说明安装扩展。

### 2. 登录小红书

在浏览器中访问 https://www.xiaohongshu.com/ 并登录你的账号。

### 3. 开始使用

扩展会自动开始工作:
- 浏览首页时自动捕获笔记
- 点击笔记查看详情时捕获完整内容
- 访问用户主页时捕获用户资料

## 数据捕获

### 查看捕获的数据

打开 Chrome 开发者工具,在 Background 控制台执行:

```javascript
// 查看所有小红书数据
chrome.storage.local.get(null, (items) => {
  const xhsKeys = Object.keys(items).filter(k => k.startsWith('xhs_'));
  console.log('XHS data:', xhsKeys.length, 'items');
  xhsKeys.forEach(key => {
    console.log(key, items[key]);
  });
});

// 查看信息流缓存
chrome.storage.local.get(['xhs_feed_cache'], (result) => {
  console.log('Feed:', result.xhs_feed_cache);
});

// 查看特定笔记
chrome.storage.local.get(['xhs_note_笔记ID'], (result) => {
  console.log('Note:', result['xhs_note_笔记ID']);
});
```

### 数据结构

#### 笔记数据
```typescript
{
  note_id: string;
  title: string;
  desc: string;
  type: 'normal' | 'video';
  user: { user_id, nickname, avatar };
  images?: [...];
  video?: {...};
  tags: [...];
  interact_info: {
    liked_count, collected_count, comment_count, share_count
  };
}
```

#### 用户数据
```typescript
{
  user_id: string;
  nickname: string;
  avatar: string;
  desc: string;
  fans: number;
  follows: number;
  notes_count: number;
  verified: boolean;
}
```

## API 操作

### 执行操作

在当前小红书标签页的 Content Script 上下文中执行:

```javascript
// 点赞笔记
chrome.tabs.query({active: true}, (tabs) => {
  chrome.tabs.sendMessage(tabs[0].id, {
    type: 'XHS_EXECUTE_ACTION',
    action: 'like',
    note_id: '笔记ID'
  }, (response) => {
    console.log('Response:', response);
  });
});

// 收藏笔记
chrome.tabs.sendMessage(tabs[0].id, {
  type: 'XHS_EXECUTE_ACTION',
  action: 'collect',
  note_id: '笔记ID'
}, callback);

// 关注用户
chrome.tabs.sendMessage(tabs[0].id, {
  type: 'XHS_EXECUTE_ACTION',
  action: 'follow',
  user_id: '用户ID'
}, callback);

// 发布评论
chrome.tabs.sendMessage(tabs[0].id, {
  type: 'XHS_EXECUTE_ACTION',
  action: 'comment',
  note_id: '笔记ID',
  content: '评论内容'
}, callback);
```

### 获取数据

```javascript
// 获取笔记详情
chrome.tabs.sendMessage(tabs[0].id, {
  type: 'XHS_FETCH_NOTE',
  note_id: '笔记ID'
}, (response) => {
  if (response.success) {
    console.log('Note:', response.data);
  }
});

// 获取用户资料
chrome.tabs.sendMessage(tabs[0].id, {
  type: 'XHS_FETCH_USER',
  user_id: '用户ID'
}, callback);
```

## 故障排查

### 扩展未工作

1. 检查扩展是否已加载: `chrome://extensions/`
2. 检查控制台是否有错误
3. 确认已登录小红书账号

### 数据未捕获

1. 打开页面控制台,应该看到 "[XhsClaw-Page] System initialized."
2. 检查是否有 API 拦截日志
3. 刷新页面重试

### 操作失败

1. 检查认证信息是否过期
2. 确认笔记 ID 或用户 ID 正确
3. 查看错误响应信息

### 清除缓存

```javascript
chrome.storage.local.get(null, (items) => {
  const xhsKeys = Object.keys(items).filter(k => k.startsWith('xhs_'));
  chrome.storage.local.remove(xhsKeys, () => {
    console.log('Cleared', xhsKeys.length, 'items');
  });
});
```

## 注意事项

1. **频率限制** - 小红书有 API 频率限制,避免短时间内大量操作
2. **账号安全** - 不要使用主账号进行测试
3. **数据隐私** - 捕获的数据仅存储在本地
4. **反爬虫** - 小红书有反爬虫机制,异常行为可能导致账号受限

## 高级用法

### 批量操作

```javascript
// 批量点赞(注意频率限制)
const noteIds = ['id1', 'id2', 'id3'];
for (const noteId of noteIds) {
  await new Promise(resolve => {
    chrome.tabs.sendMessage(tabs[0].id, {
      type: 'XHS_EXECUTE_ACTION',
      action: 'like',
      note_id: noteId
    }, resolve);
  });
  await new Promise(r => setTimeout(r, 2000)); // 延迟 2 秒
}
```

### 数据导出

```javascript
chrome.storage.local.get(null, (items) => {
  const xhsData = {};
  Object.keys(items)
    .filter(k => k.startsWith('xhs_'))
    .forEach(k => xhsData[k] = items[k]);
  
  const blob = new Blob([JSON.stringify(xhsData, null, 2)], 
    { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  // 下载文件
  chrome.downloads.download({
    url: url,
    filename: 'xhs-data.json'
  });
});
```

## 反馈与支持

如有问题或建议,请在 GitHub 提交 Issue。
```

### 3. 创建 CHANGELOG

**文件:** `CHANGELOG.md` (更新)

```markdown
# Changelog

## [0.6.0] - 2026-04-17

### Added
- **Xiaohongshu (小红书) Platform Support**
  - Note content capture (text, images, videos)
  - User profile extraction
  - Interaction operations (like, collect, follow, comment)
  - Multi-platform architecture with platform detector
  - Dedicated injection and content scripts for Xiaohongshu

### Changed
- Extended route parser to support Xiaohongshu routes
- Updated manifest to include Xiaohongshu permissions
- Refactored background script for multi-platform support

### Technical
- Added TypeScript types for Xiaohongshu data structures
- Implemented data extractors for notes and user profiles
- Created API client for Xiaohongshu operations
- Added comprehensive test coverage

## [0.5.1] - Previous version
...
```

### 4. 创建发布检查清单

**文件:** `docs/release-checklist.md`

```markdown
# Release Checklist - v0.6.0

## Pre-release

- [ ] All tasks (TASK-001 to TASK-008) completed
- [ ] All tests passing (`npm test`)
- [ ] Production build successful (`npm run build:r`)
- [ ] Manual testing completed (see TASK-008)
- [ ] No console errors in production build
- [ ] Documentation updated

## Code Quality

- [ ] TypeScript compilation with no errors
- [ ] No ESLint warnings
- [ ] Code reviewed
- [ ] Test coverage > 80%

## Documentation

- [ ] README updated with Xiaohongshu info
- [ ] Usage guide created
- [ ] CHANGELOG updated
- [ ] API documentation complete

## Testing

- [ ] Twitter functionality still works
- [ ] Xiaohongshu data capture works
- [ ] Xiaohongshu operations work
- [ ] Error handling tested
- [ ] Performance acceptable

## Release

- [ ] Version bumped to 0.6.0 in package.json
- [ ] Version bumped to 0.6.0 in manifest.json
- [ ] Git tag created: `git tag v0.6.0`
- [ ] Changes committed
- [ ] Pushed to repository

## Post-release

- [ ] Release notes published
- [ ] Users notified
- [ ] Monitor for issues
```

## 验收标准

- [ ] README 更新完成
- [ ] 使用文档创建完成
- [ ] CHANGELOG 更新完成
- [ ] 发布检查清单创建完成
- [ ] 所有文档清晰易懂
- [ ] 版本号统一为 0.6.0

## 测试方法

```bash
# 检查文档
cat README.md
cat docs/xiaohongshu-usage.md
cat CHANGELOG.md
cat docs/release-checklist.md

# 验证版本号
grep version package.json
grep version public/manifest.json  # 或实际的 manifest 位置
```

## 注意事项

- 文档应该面向最终用户,清晰易懂
- 示例代码应该可以直接运行
- 故障排查部分应该覆盖常见问题
- 发布前确保所有检查项都完成
