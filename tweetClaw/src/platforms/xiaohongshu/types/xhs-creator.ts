/**
 * 小红书创作者中心 API 类型定义
 * 用于创作者数据分析相关接口
 */

/**
 * 每日数据点
 */
export interface XhsDailyDataPoint {
  date: number; // Unix 时间戳 (毫秒)
  count: number;
  set_date: boolean;
  set_count: boolean;
}

/**
 * 时间段统计汇总
 */
export interface XhsPeriodStats {
  view_count: number;
  view_time_avg: number; // 平均观看时长 (秒)
  home_view_count: number; // 首页曝光数
  like_count: number;
  collect_count: number;
  comment_count: number;
  danmaku_count: number; // 弹幕数 (视频笔记)
  share_count: number;
  rise_fans_count: number; // 涨粉数

  // 每日趋势列表
  view_list: XhsDailyDataPoint[];
  view_time_list: XhsDailyDataPoint[];
  home_view_list: XhsDailyDataPoint[];
  like_list: XhsDailyDataPoint[];
  collect_list: XhsDailyDataPoint[];
  comment_list: XhsDailyDataPoint[];
  danmaku_list: XhsDailyDataPoint[];
  share_list: XhsDailyDataPoint[];
  rise_fans_list: XhsDailyDataPoint[];

  // 增长率 (相比上一周期)
  view_count_rate: number;
  view_time_avg_rate: number;
  home_view_count_rate: number;
  like_count_rate: number;
  collect_count_rate: number;
  comment_count_rate: number;
  danmaku_count_rate: number;
  share_count_rate: number;
  rise_fans_count_rate: number;

  // AI 分析摘要
  summary: string;

  // 列表大小
  view_list_size: number;
  view_time_list_size: number;
  home_view_list_size: number;
  like_list_size: number;
  collect_list_size: number;
  comment_list_size: number;
  danmaku_list_size: number;
  share_list_size: number;
  rise_fans_list_size: number;

  // 迭代器 (与 list 相同数据，另一种格式)
  view_list_iterator: XhsDailyDataPoint[];
  view_time_list_iterator: XhsDailyDataPoint[];
  home_view_list_iterator: XhsDailyDataPoint[];
  like_list_iterator: XhsDailyDataPoint[];
  collect_list_iterator: XhsDailyDataPoint[];
  comment_list_iterator: XhsDailyDataPoint[];
  danmaku_list_iterator: XhsDailyDataPoint[];
  share_list_iterator: XhsDailyDataPoint[];
  rise_fans_list_iterator: XhsDailyDataPoint[];

  // 设置标志位
  set_view_count: boolean;
  set_view_time_avg: boolean;
  set_home_view_count: boolean;
  set_like_count: boolean;
  set_collect_count: boolean;
  set_comment_count: boolean;
  set_danmaku_count: boolean;
  set_share_count: boolean;
  set_rise_fans_count: boolean;
  set_view_list: boolean;
  set_view_time_list: boolean;
  set_home_view_list: boolean;
  set_like_list: boolean;
  set_collect_list: boolean;
  set_comment_list: boolean;
  set_danmaku_list: boolean;
  set_share_list: boolean;
  set_rise_fans_list: boolean;
  set_view_count_rate: boolean;
  set_view_time_avg_rate: boolean;
  set_home_view_count_rate: boolean;
  set_like_count_rate: boolean;
  set_collect_count_rate: boolean;
  set_comment_count_rate: boolean;
  set_danmaku_count_rate: boolean;
  set_share_count_rate: boolean;
  set_rise_fans_count_rate: boolean;
  set_summary: boolean;
}

/**
 * 笔记详情数据分析响应
 */
export interface XhsNoteDetailStats {
  seven: XhsPeriodStats; // 7天数据
  thirty: XhsPeriodStats; // 30天数据
}

/**
 * 创作者中心 API 响应包装
 */
export interface XhsCreatorApiResponse<T> {
  code: number;
  success: boolean;
  data: T;
  msg?: string;
  message?: string;
}

/**
 * 获取笔记详情统计的请求参数
 */
export interface XhsNoteDetailStatsParams {
  note_id: string;
}