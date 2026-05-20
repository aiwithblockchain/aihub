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
