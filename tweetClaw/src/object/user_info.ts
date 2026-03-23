/* ====================== 1. 接口定义 ====================== */
export interface IUserCore {
    userName: string;
    displayName: string;
    userId: string;
    internalId: string;
    createdAt: string;
    avatar: string;
}

export interface IScaleMetrics {
    followersCount: number;
    friendsCount: number;
    listedCount: number;
    followerRatio: number;
}

export interface IActivityMetrics {
    statusesCount: number;
    favouritesCount: number;
    mediaCount: number;
    creatorSubscriptionsCount: number;
    avgTweetsPerDay: number;
}

export interface ITrustMetrics {
    isBlueVerified: boolean;
    canHighlightTweets: boolean;
    hasAffiliateLabel: boolean;
    isSuperFollowEligible: boolean;
}

export interface IBrandMetrics {
    hasProfileBanner: boolean;
    hasProfessionalType: boolean;
    hasHiddenSubscriptions: boolean;
    hasDescription: boolean;
}

export interface IGrowthMetrics {
    accountAgeDays: number;
}

export interface IUserScoreData
    extends IUserCore,
    IScaleMetrics,
    IActivityMetrics,
    ITrustMetrics,
    IBrandMetrics,
    IGrowthMetrics {
}

/* ====================== 2. 主类 ====================== */
export class UserProfile implements IUserScoreData {
    /* ---------- 基础信息 ---------- */
    userName: string = '';
    displayName: string = '';
    userId: string = '';
    internalId: string = '';
    createdAt: string = '';
    avatar: string = '';
    isFollowing: boolean = false;

    /* ---------- 规模 ---------- */
    followersCount: number = 0;
    friendsCount: number = 0;
    listedCount: number = 0;
    followerRatio: number = 0;

    /* ---------- 活跃 ---------- */
    statusesCount: number = 0;
    favouritesCount: number = 0;
    mediaCount: number = 0;
    creatorSubscriptionsCount: number = 0;
    avgTweetsPerDay: number = 0;

    /* ---------- 信任 ---------- */
    isBlueVerified: boolean = false;
    canHighlightTweets: boolean = false;
    hasAffiliateLabel: boolean = false;
    isSuperFollowEligible: boolean = false;

    /* ---------- 品牌 ---------- */
    hasProfileBanner: boolean = false;
    hasProfessionalType: boolean = false;
    hasHiddenSubscriptions: boolean = false;
    hasDescription: boolean = false;

    /* ---------- 成长 ---------- */
    accountAgeDays: number = 0;

    public isValid: boolean = false;

    /* ====================== 构造函数 ====================== */
    constructor(rawTwitterJson: any) {
        try {
            this.fillFromApi(rawTwitterJson);
            this.isValid = true;
        } catch (e) {
            this.isValid = false;
            console.log("[UserProfile] Silently handled invalid payload.", {
                dataKeys: Object.keys(rawTwitterJson?.data || rawTwitterJson || {})
            });
        }
    }

    /* ====================== 填充 API 数据 ====================== */
    private fillFromApi(data: any): void {
        const findDeepUser = (obj: any): any => {
            if (!obj) return null;
            if (obj.rest_id && (obj.core || obj.legacy)) return obj;
            if (obj.result && (obj.result.core || obj.result.legacy)) return obj.result;

            // Try common paths
            const next = obj.data || obj.user ||
                obj.user_result_by_screen_name ||
                obj.result;
            if (next && next !== obj) return findDeepUser(next);

            return null;
        };

        const u = findDeepUser(data);

        if (!u || u.__typename === 'UserUnavailable') {
            throw new Error('No valid user object found in payload');
        }

        // 1. 核心 + 头像
        this.userName = u.core?.screen_name ?? u.legacy?.screen_name ?? '';
        this.displayName = u.core?.name ?? u.legacy?.name ?? u.legacy?.display_name ?? '';
        this.userId = u.rest_id ?? '';
        this.internalId = u.id ?? '';
        this.createdAt = u.core?.created_at ?? u.legacy?.created_at ?? '';
        this.avatar = u.avatar?.image_url ?? u.legacy?.profile_image_url_https ?? '';

        // 2. 规模
        this.followersCount = u.legacy?.followers_count ?? 0;
        this.friendsCount = u.legacy?.friends_count ?? 0;
        this.listedCount = u.legacy?.listed_count ?? 0;
        this.followerRatio = this.friendsCount > 0 ? this.followersCount / this.friendsCount : 0;

        // 3. 活跃
        this.statusesCount = u.legacy?.statuses_count ?? 0;
        this.favouritesCount = u.legacy?.favourites_count ?? 0;
        this.mediaCount = u.legacy?.media_count ?? 0;
        this.creatorSubscriptionsCount = u.creator_subscriptions_count ?? 0;

        // 4. 信任
        this.isBlueVerified = !!u.is_blue_verified;
        this.canHighlightTweets = !!u.highlights_info?.can_highlight_tweets;
        this.hasAffiliateLabel = !!u.affiliates_highlighted_label?.label;
        this.isSuperFollowEligible = !!u.super_follow_eligible;

        // 5. 品牌
        this.hasProfileBanner = !!u.legacy?.profile_banner_url;
        this.hasProfessionalType = !!u.professional?.professional_type;
        this.hasHiddenSubscriptions = !!u.has_hidden_subscriptions_on_profile;
        this.hasDescription = !!u.legacy?.description?.trim();

        // 6. 成长
        this.accountAgeDays = this.calculateAgeInDays();
        this.avgTweetsPerDay = this.statusesCount / Math.max(this.accountAgeDays, 1);

        // EXTRA
        this.isFollowing = !!u.legacy?.following;
    }

    private calculateAgeInDays(): number {
        const created = new Date(this.createdAt);
        if (isNaN(created.getTime())) return 1;
        const now = new Date();
        return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    }

    /* ====================== 辅助 ====================== */
    public toJSON(): IUserScoreData {
        return { ...this };
    }
}
