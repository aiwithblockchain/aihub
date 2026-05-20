import { XhsImage, XhsVideo, XhsTag, XhsUserBasic, XhsInteractInfo } from './xhs-common';

export type XhsNoteType = 'normal' | 'video';

export interface XhsNote {
  note_id: string;
  title: string;
  desc: string;
  type: XhsNoteType;
  user: XhsUserBasic;
  images?: XhsImage[];
  video?: XhsVideo;
  tags: XhsTag[];
  interact_info: XhsInteractInfo;
  ip_location?: string;
  create_time: number;
  last_update_time: number;
}

export interface XhsNoteFeed {
  notes: XhsNote[];
  cursor: string;
  has_more: boolean;
}

export interface XhsNoteDetail extends XhsNote {
  comments?: XhsComment[];
}

export interface XhsComment {
  id: string;
  content: string;
  user: XhsUserBasic;
  create_time: number;
  like_count: number;
  sub_comment_count: number;
  sub_comments?: XhsComment[];
}
