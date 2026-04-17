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

    if (noteCard.image_list && Array.isArray(noteCard.image_list)) {
      note.images = noteCard.image_list.map(extractImage);
    }

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
