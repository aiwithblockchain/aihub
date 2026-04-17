# TASK-004: 小红书数据提取器

**优先级:** P1  
**预计时间:** 1天  
**依赖:** TASK-002, TASK-003

## 目标

实现小红书数据提取器,解析 API 响应并转换为标准化的数据结构。

## 实现内容

### 1. 创建数据提取器

**文件:** `src/platforms/xiaohongshu/xhs-extractor.ts`

```typescript
import {
  XhsNote,
  XhsNoteType,
  XhsUserProfile,
  XhsComment,
  XhsImage,
  XhsVideo,
  XhsTag,
  XhsUserBasic,
  XhsInteractInfo,
} from './types';

/**
 * 从 API 响应中提取笔记列表
 */
export function extractNotes(apiResponse: any): XhsNote[] {
  try {
    const items = apiResponse?.data?.items || [];
    return items
      .map((item: any) => extractNote(item))
      .filter((note: XhsNote | null) => note !== null);
  } catch (e) {
    console.error('[XhsExtractor] extractNotes failed:', e);
    return [];
  }
}

/**
 * 从单个 item 中提取笔记
 */
export function extractNote(item: any): XhsNote | null {
  try {
    const noteCard = item?.note_card || item;
    if (!noteCard?.note_id) return null;

    const note: XhsNote = {
      note_id: noteCard.note_id,
      title: noteCard.display_title || noteCard.title || '',
      desc: noteCard.desc || '',
      type: noteCard.type === 'video' ? 'video' : 'normal',
      user: extractUserBasic(noteCard.user),
      tags: extractTags(noteCard.tag_list),
      interact_info: extractInteractInfo(noteCard.interact_info),
      ip_location: noteCard.ip_location || '',
      create_time: noteCard.time || Date.now(),
      last_update_time: noteCard.last_update_time || noteCard.time || Date.now(),
    };

    // 提取图片
    if (noteCard.image_list && Array.isArray(noteCard.image_list)) {
      note.images = noteCard.image_list.map(extractImage);
    }

    // 提取视频
    if (noteCard.video) {
      note.video = extractVideo(noteCard.video);
    }

    return note;
  } catch (e) {
    console.error('[XhsExtractor] extractNote failed:', e);
    return null;
  }
}

/**
 * 提取用户基本信息
 */
export function extractUserBasic(userData: any): XhsUserBasic {
  return {
    user_id: userData?.user_id || userData?.id || '',
    nickname: userData?.nickname || userData?.nick_name || '',
    avatar: userData?.avatar || userData?.image || '',
  };
}

/**
 * 提取用户完整资料
 */
export function extractUserProfile(apiResponse: any): XhsUserProfile | null {
  try {
    const userData = apiResponse?.data?.user || apiResponse?.data;
    if (!userData?.user_id) return null;

    return {
      user_id: userData.user_id,
      nickname: userData.nickname || userData.nick_name || '',
      avatar: userData.avatar || userData.image || '',
      desc: userData.desc || userData.description || '',
      gender: userData.gender || 0,
      ip_location: userData.ip_location || '',
      follows: parseInt(userData.follows || '0'),
      fans: parseInt(userData.fans || '0'),
      interaction: parseInt(userData.interaction || '0'),
      notes_count: parseInt(userData.notes_count || '0'),
      verified: userData.verified || false,
      verified_content: userData.verified_content || '',
      red_official_verified: userData.red_official_verified || false,
    };
  } catch (e) {
    console.error('[XhsExtractor] extractUserProfile failed:', e);
    return null;
  }
}

/**
 * 提取图片信息
 */
function extractImage(imageData: any): XhsImage {
  return {
    url: imageData?.url || imageData?.url_default || '',
    url_default: imageData?.url_default || '',
    url_pre: imageData?.url_pre || imageData?.url || '',
    width: imageData?.width || 0,
    height: imageData?.height || 0,
    file_id: imageData?.file_id || imageData?.trace_id || '',
  };
}

/**
 * 提取视频信息
 */
function extractVideo(videoData: any): XhsVideo {
  const cover = videoData?.cover || videoData?.first_frame_url || {};
  return {
    url: videoData?.url || videoData?.media?.stream?.h264?.[0]?.master_url || '',
    url_default: videoData?.url_default || '',
    duration: videoData?.duration || 0,
    width: videoData?.width || 0,
    height: videoData?.height || 0,
    cover: extractImage(cover),
  };
}

/**
 * 提取标签列表
 */
function extractTags(tagList: any[]): XhsTag[] {
  if (!Array.isArray(tagList)) return [];
  return tagList.map((tag: any) => ({
    id: tag?.id || '',
    name: tag?.name || '',
    type: tag?.type || '',
  }));
}

/**
 * 提取互动信息
 */
function extractInteractInfo(interactData: any): XhsInteractInfo {
  return {
    liked: interactData?.liked || false,
    liked_count: String(interactData?.liked_count || '0'),
    collected: interactData?.collected || false,
    collected_count: String(interactData?.collected_count || '0'),
    comment_count: String(interactData?.comment_count || '0'),
    share_count: String(interactData?.share_count || '0'),
  };
}

/**
 * 提取评论列表
 */
export function extractComments(apiResponse: any): XhsComment[] {
  try {
    const comments = apiResponse?.data?.comments || [];
    return comments.map((comment: any) => extractComment(comment));
  } catch (e) {
    console.error('[XhsExtractor] extractComments failed:', e);
    return [];
  }
}

/**
 * 提取单条评论
 */
function extractComment(commentData: any): XhsComment {
  return {
    id: commentData?.id || '',
    content: commentData?.content || '',
    user: extractUserBasic(commentData?.user),
    create_time: commentData?.create_time || Date.now(),
    like_count: commentData?.like_count || 0,
    sub_comment_count: commentData?.sub_comment_count || 0,
    sub_comments: commentData?.sub_comments?.map(extractComment) || [],
  };
}
```

### 2. 添加单元测试

**文件:** `src/platforms/xiaohongshu/__tests__/xhs-extractor.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  extractNote,
  extractNotes,
  extractUserProfile,
  extractUserBasic,
} from '../xhs-extractor';

describe('xhs-extractor', () => {
  describe('extractUserBasic', () => {
    it('should extract basic user info', () => {
      const userData = {
        user_id: '123',
        nickname: '测试用户',
        avatar: 'https://example.com/avatar.jpg',
      };

      const result = extractUserBasic(userData);

      expect(result).toEqual({
        user_id: '123',
        nickname: '测试用户',
        avatar: 'https://example.com/avatar.jpg',
      });
    });

    it('should handle missing fields', () => {
      const result = extractUserBasic({});
      expect(result.user_id).toBe('');
      expect(result.nickname).toBe('');
      expect(result.avatar).toBe('');
    });
  });

  describe('extractNote', () => {
    it('should extract normal note', () => {
      const item = {
        note_card: {
          note_id: 'note123',
          title: '测试笔记',
          desc: '这是一条测试笔记',
          type: 'normal',
          user: {
            user_id: 'user123',
            nickname: '测试用户',
            avatar: 'https://example.com/avatar.jpg',
          },
          interact_info: {
            liked: false,
            liked_count: '100',
            collected: false,
            collected_count: '50',
            comment_count: '20',
            share_count: '10',
          },
          tag_list: [
            { id: 'tag1', name: '美食', type: 'topic' },
          ],
          time: 1640000000000,
        },
      };

      const result = extractNote(item);

      expect(result).not.toBeNull();
      expect(result?.note_id).toBe('note123');
      expect(result?.title).toBe('测试笔记');
      expect(result?.type).toBe('normal');
      expect(result?.user.user_id).toBe('user123');
      expect(result?.tags).toHaveLength(1);
    });

    it('should return null for invalid data', () => {
      expect(extractNote({})).toBeNull();
      expect(extractNote(null)).toBeNull();
    });
  });

  describe('extractNotes', () => {
    it('should extract multiple notes', () => {
      const apiResponse = {
        data: {
          items: [
            {
              note_card: {
                note_id: 'note1',
                title: '笔记1',
                desc: '描述1',
                type: 'normal',
                user: { user_id: 'user1', nickname: '用户1', avatar: '' },
                interact_info: {},
                tag_list: [],
                time: Date.now(),
              },
            },
            {
              note_card: {
                note_id: 'note2',
                title: '笔记2',
                desc: '描述2',
                type: 'video',
                user: { user_id: 'user2', nickname: '用户2', avatar: '' },
                interact_info: {},
                tag_list: [],
                time: Date.now(),
              },
            },
          ],
        },
      };

      const result = extractNotes(apiResponse);

      expect(result).toHaveLength(2);
      expect(result[0].note_id).toBe('note1');
      expect(result[1].note_id).toBe('note2');
      expect(result[1].type).toBe('video');
    });

    it('should handle empty response', () => {
      expect(extractNotes({})).toEqual([]);
      expect(extractNotes({ data: {} })).toEqual([]);
      expect(extractNotes({ data: { items: [] } })).toEqual([]);
    });
  });

  describe('extractUserProfile', () => {
    it('should extract complete user profile', () => {
      const apiResponse = {
        data: {
          user: {
            user_id: 'user123',
            nickname: '测试用户',
            avatar: 'https://example.com/avatar.jpg',
            desc: '这是个人简介',
            gender: 1,
            ip_location: '北京',
            follows: '100',
            fans: '1000',
            interaction: '5000',
            notes_count: '50',
            verified: true,
            verified_content: '认证信息',
          },
        },
      };

      const result = extractUserProfile(apiResponse);

      expect(result).not.toBeNull();
      expect(result?.user_id).toBe('user123');
      expect(result?.nickname).toBe('测试用户');
      expect(result?.fans).toBe(1000);
      expect(result?.verified).toBe(true);
    });
  });
});
```

## 验收标准

- [ ] `xhs-extractor.ts` 实现完成
- [ ] 所有提取函数都有错误处理
- [ ] 单元测试覆盖率 > 80%
- [ ] 所有测试通过 (`npm test`)
- [ ] TypeScript 编译无错误
- [ ] 能正确处理缺失字段和异常数据

## 测试方法

```bash
# 运行单元测试
npm test -- xhs-extractor

# 运行测试覆盖率
npm test -- --coverage xhs-extractor

# TypeScript 编译检查
npm run build:d
```

## 注意事项

- 小红书 API 响应结构可能变化,提取器要健壮
- 使用 `String()` 转换大数字,避免精度问题
- 所有提取函数都要有 try-catch 错误处理
- 返回 null 或空数组而不是抛出异常
- 字段缺失时使用合理的默认值
