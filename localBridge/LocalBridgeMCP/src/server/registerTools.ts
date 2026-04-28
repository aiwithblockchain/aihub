import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppDeps } from './createServer.js';
import { registerListXInstancesTool } from '../tools/context/listXInstances.js';
import { registerGetXStatusTool } from '../tools/context/getXStatus.js';
import { registerGetXBasicInfoTool } from '../tools/context/getXBasicInfo.js';
import { registerGetHomeTimelineTool } from '../tools/context/getHomeTimeline.js';
import { registerGetTweetTool } from '../tools/context/getTweet.js';
import { registerGetTweetRepliesTool } from '../tools/context/getTweetReplies.js';
import { registerGetUserProfileTool } from '../tools/context/getUserProfile.js';
import { registerSearchTweetsTool } from '../tools/context/searchTweets.js';

export function registerTools(server: McpServer, deps: AppDeps): void {
  const enabledTools = deps.config.enabledTools;

  if (enabledTools === null || enabledTools.includes('list_x_instances')) {
    registerListXInstancesTool(server, deps);
  }

  if (enabledTools === null || enabledTools.includes('get_x_status')) {
    registerGetXStatusTool(server, deps);
  }

  if (enabledTools === null || enabledTools.includes('get_x_basic_info')) {
    registerGetXBasicInfoTool(server, deps);
  }

  if (enabledTools === null || enabledTools.includes('get_home_timeline')) {
    registerGetHomeTimelineTool(server, deps);
  }

  if (enabledTools === null || enabledTools.includes('get_tweet')) {
    registerGetTweetTool(server, deps);
  }

  if (enabledTools === null || enabledTools.includes('get_tweet_replies')) {
    registerGetTweetRepliesTool(server, deps);
  }

  if (enabledTools === null || enabledTools.includes('get_user_profile')) {
    registerGetUserProfileTool(server, deps);
  }

  if (enabledTools === null || enabledTools.includes('search_tweets')) {
    registerSearchTweetsTool(server, deps);
  }
}
