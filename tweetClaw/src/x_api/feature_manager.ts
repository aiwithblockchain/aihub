/**
 * Feature Manager for X GraphQL requests
 * Handles dynamic feature discovery from 400/403/404 errors.
 *
 * Strategy:
 * 1. Each operation has its own feature cache (per-operation features)
 * 2. When a request fails, we capture features from successful browser requests
 * 3. Features are merged: base + global dynamic + per-operation
 */
import { __DBK_dynamic_features } from '../capture/consts';

const __DBK_per_op_features = 'tc_per_op_features';

export const baseFeatures = {
    responsive_web_graphql_timeline_navigation_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    rweb_video_screen_enabled: false,
    standardized_nudges_misinfo: true,
    freedom_of_speech_not_reach_fetch_enabled: true,
    responsive_web_enhance_cards_enabled: false,
    articles_preview_enabled: true,
    communities_web_enable_tweet_community_results_fetch: true,
    c9s_tweet_anatomy_moderator_badge_enabled: true
};

// Per-operation features for SearchTimeline
export const searchTimelineFeatures = {
    profile_label_improvements_pcf_label_in_post_enabled: true,
    responsive_web_profile_redirect_enabled: false,
    rweb_tipjar_consumption_enabled: false,
    verified_phone_label_enabled: false,
    premium_content_api_read_enabled: false,
    responsive_web_grok_analyze_button_fetch_trends_enabled: false,
    responsive_web_grok_analyze_post_followups_enabled: true,
    responsive_web_jetfuel_frame: true,
    responsive_web_grok_share_attachment_enabled: true,
    responsive_web_grok_annotations_enabled: true,
    tweet_awards_web_tipping_enabled: false,
    content_disclosure_indicator_enabled: true,
    content_disclosure_ai_generated_indicator_enabled: true,
    responsive_web_grok_show_grok_translated_post: false,
    responsive_web_grok_analysis_button_from_backend: true,
    post_ctas_fetch_enabled: true,
    longform_notetweets_inline_media_enabled: false,
    responsive_web_grok_image_annotation_enabled: true,
    responsive_web_grok_imagine_annotation_enabled: true,
    responsive_web_grok_community_note_auto_translation_is_enabled: false
};

export async function extractMissingFeature(body: string): Promise<string | null> {
    if (!body) return null;
    // X normally returns: "cannot be null: some_feature_flag"
    const m = body.match(/cannot be null:\s*([a-zA-Z0-9_]+)/);
    if (!m) return null;
    const feature = m[1];

    const data = await chrome.storage.local.get(__DBK_dynamic_features);
    const current = (data[__DBK_dynamic_features] || {}) as Record<string, boolean>;
    if (!(feature in current)) {
        current[feature] = true;
        await chrome.storage.local.set({ [__DBK_dynamic_features]: current });
        console.log("[TweetClaw-Feature] Auto-harvested new feature flag:", feature);
    }
    return feature;
}

/**
 * Build features for a specific operation
 * Priority: base < global dynamic < per-operation
 */
export async function buildFeatures(op?: string): Promise<Record<string, boolean>> {
    const data = await chrome.storage.local.get([__DBK_dynamic_features, __DBK_per_op_features]);
    const globalDynamic = (data[__DBK_dynamic_features] || {}) as Record<string, boolean>;
    const perOpFeatures = (data[__DBK_per_op_features] || {}) as Record<string, Record<string, boolean>>;

    const opSpecific = op ? (perOpFeatures[op] || {}) : {};

    // Special handling for SearchTimeline - use hardcoded features if not cached
    if (op === 'SearchTimeline' && Object.keys(opSpecific).length === 0) {
        return { ...baseFeatures, ...globalDynamic, ...searchTimelineFeatures };
    }

    return { ...baseFeatures, ...globalDynamic, ...opSpecific };
}

/**
 * Cache features for a specific operation (learned from successful browser requests)
 */
export async function cacheOperationFeatures(op: string, features: Record<string, boolean>): Promise<void> {
    const data = await chrome.storage.local.get(__DBK_per_op_features);
    const perOpFeatures = (data[__DBK_per_op_features] || {}) as Record<string, Record<string, boolean>>;

    // Merge with existing features for this operation
    perOpFeatures[op] = { ...(perOpFeatures[op] || {}), ...features };

    await chrome.storage.local.set({ [__DBK_per_op_features]: perOpFeatures });
    console.log(`[TweetClaw-Feature] Cached features for ${op}:`, Object.keys(features).length, 'flags');
}

/**
 * Get cached features for a specific operation
 */
export async function getOperationFeatures(op: string): Promise<Record<string, boolean> | null> {
    const data = await chrome.storage.local.get(__DBK_per_op_features);
    const perOpFeatures = (data[__DBK_per_op_features] || {}) as Record<string, Record<string, boolean>>;
    return perOpFeatures[op] || null;
}
