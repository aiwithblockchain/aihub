/**
 * Feature Manager for X GraphQL requests
 * Handles dynamic feature discovery from 400/403 errors.
 */
import { __DBK_dynamic_features } from '../capture/consts';

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

export async function buildFeatures(): Promise<Record<string, boolean>> {
    const data = await chrome.storage.local.get(__DBK_dynamic_features);
    const dynamic = (data[__DBK_dynamic_features] || {}) as Record<string, boolean>;
    return { ...baseFeatures, ...dynamic };
}
