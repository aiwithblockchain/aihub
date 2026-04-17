export interface XhsImage {
  url: string;
  url_default: string;
  url_pre: string;
  width: number;
  height: number;
  file_id?: string;
}

export interface XhsVideo {
  url: string;
  url_default: string;
  duration: number;
  width: number;
  height: number;
  cover: XhsImage;
}

export interface XhsTag {
  id: string;
  name: string;
  type: string;
}

export interface XhsUserBasic {
  user_id: string;
  nickname: string;
  avatar: string;
}

export interface XhsInteractInfo {
  liked: boolean;
  liked_count: string;
  collected: boolean;
  collected_count: string;
  comment_count: string;
  share_count: string;
}

export type XhsAction =
  | 'like'
  | 'unlike'
  | 'collect'
  | 'uncollect'
  | 'follow'
  | 'unfollow'
  | 'comment';

export interface XhsActionRequest {
  action: XhsAction;
  note_id?: string;
  user_id?: string;
  content?: string;
}
