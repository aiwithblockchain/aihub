import { CurrentEntity, ReplyEntity, ProfileTweetEntity } from './entity';

export type PageScene = 
    | 'no_tab' 
    | 'not_x' 
    | 'login_required' 
    | 'identity_resolving'
    | 'home' 
    | 'profile' 
    | 'tweet_detail' 
    | 'search' 
    | 'notification' 
    | 'unknown_x_scene';

export type AvailableAction = 
    | 'read_home_timeline'
    | 'list_profile_tweets'
    | 'get_current_tweet'
    | 'list_tweet_replies'
    | 'like_tweet'
    | 'repost_tweet'
    | 'reply_to_tweet'
    | 'search_tweets'
    | 'read_notifications'
    | 'open_x_tab'
    | 'refresh_session';

export interface PageContext {
    scene: PageScene;
    routeKind: string;
    currentUrl: string;
    entityType: string | null;
    entityId: string | null;
    availableActions: AvailableAction[];
    currentEntity: CurrentEntity;
    repliesSnapshot?: ReplyEntity[];
    profileTweetsSnapshot?: ProfileTweetEntity[];
}
