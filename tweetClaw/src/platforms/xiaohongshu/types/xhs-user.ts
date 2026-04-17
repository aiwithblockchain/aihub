import { XhsUserBasic } from './xhs-common';

export interface XhsUserProfile extends XhsUserBasic {
  desc: string;
  gender: number;
  ip_location: string;
  follows: number;
  fans: number;
  interaction: number;
  notes_count: number;
  verified: boolean;
  verified_content?: string;
  red_official_verified: boolean;
}

export interface XhsUserStats {
  follows: number;
  fans: number;
  interaction: number;
  notes_count: number;
}
