import { PageContext, PageScene, AvailableAction } from '../types/page-context';
import { parseRouteKind, extractTweetId } from './route-parser';
import { resolveTweetEntity } from './entity-resolver';

export function derivePageContext(
    url: string | undefined, 
    hasSession: boolean, 
    isLoggedIn: boolean = false,
    featuredTweet: any | null = null,
    activeAccountHandle: string | null = null
): PageContext {
    if (!url) {
        return {
            scene: 'no_tab',
            routeKind: 'none',
            currentUrl: '',
            entityType: null,
            entityId: null,
            availableActions: ['open_x_tab'],
            currentEntity: null
        };
    }

    const routeKind = parseRouteKind(url);
    if (routeKind === 'none') {
        return {
            scene: 'not_x',
            routeKind: 'none',
            currentUrl: url,
            entityType: null,
            entityId: null,
            availableActions: ['open_x_tab'],
            currentEntity: null
        };
    }

    if (!isLoggedIn) {
        return {
            scene: 'login_required',
            routeKind,
            currentUrl: url,
            entityType: null,
            entityId: null,
            availableActions: ['open_x_tab', 'refresh_session'],
            currentEntity: null
        };
    }

    let scene: PageScene = 'unknown_x_scene';
    let actions: AvailableAction[] = [];
    let currentEntity = null;

    switch (routeKind) {
        case 'home':
            scene = 'home';
            actions = ['read_home_timeline'];
            break;
        case 'profile':
            scene = 'profile';
            actions = ['list_profile_tweets'];
            break;
        case 'thread':
            scene = 'tweet_detail';
            actions = ['get_current_tweet', 'list_tweet_replies', 'like_tweet', 'repost_tweet', 'reply_to_tweet'];
            currentEntity = resolveTweetEntity(url, featuredTweet, activeAccountHandle);
            break;
        case 'search':
            scene = 'search';
            actions = ['search_tweets'];
            break;
        case 'notification':
            scene = 'notification';
            actions = ['read_notifications'];
            break;
    }

    // If identity is unresolved but we are on a known scene, prioritize the scene.
    // If we are on an unknown scene and identity is unresolved, use identity_resolving.
    let finalScene: PageScene = scene;
    if (!hasSession && isLoggedIn && scene === 'unknown_x_scene') {
        finalScene = 'identity_resolving';
    }

    return {
        scene: finalScene,
        routeKind,
        currentUrl: url,
        entityType: currentEntity ? currentEntity.entityType : null,
        entityId: currentEntity ? currentEntity.entityId : extractTweetId(url),
        availableActions: actions.length > 0 ? actions : (finalScene === 'identity_resolving' ? (['refresh_session'] as AvailableAction[]) : []),
        currentEntity
    };
}
