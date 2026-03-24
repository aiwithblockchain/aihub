"""
REST API Client for LocalBridge
"""
import requests
from typing import Optional, Dict, Any
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import API_BASE_URL, API_TIMEOUT


class APIClient:
    """LocalBridge REST API Client"""

    def __init__(self, base_url: str = API_BASE_URL, timeout: int = API_TIMEOUT):
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout

    def _request(self, method: str, path: str, **kwargs) -> Dict[Any, Any]:
        """Make HTTP request"""
        url = f"{self.base_url}{path}"
        kwargs.setdefault('timeout', self.timeout)

        try:
            response = requests.request(method, url, **kwargs)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return {"error": str(e)}

    # Status APIs
    def get_x_status(self) -> Dict[Any, Any]:
        """Get X tabs status"""
        return self._request('GET', '/api/v1/x/status')

    def get_instances(self) -> Dict[Any, Any]:
        """Get connected instances"""
        return self._request('GET', '/api/v1/x/instances')

    def get_basic_info(self) -> Dict[Any, Any]:
        """Get current user basic info"""
        return self._request('GET', '/api/v1/x/basic_info')

    # Read APIs
    def get_timeline(self, tab_id: Optional[int] = None) -> Dict[Any, Any]:
        """Get home timeline"""
        params = {'tabId': tab_id} if tab_id else {}
        return self._request('GET', '/api/v1/x/timeline', params=params)

    def get_tweet(self, tweet_id: str, tab_id: Optional[int] = None) -> Dict[Any, Any]:
        """Get single tweet"""
        params = {'tabId': tab_id} if tab_id else {}
        return self._request('GET', f'/api/v1/x/tweets/{tweet_id}', params=params)

    def get_tweet_replies(self, tweet_id: str, cursor: Optional[str] = None, tab_id: Optional[int] = None) -> Dict[Any, Any]:
        """Get tweet replies"""
        params = {}
        if cursor:
            params['cursor'] = cursor
        if tab_id:
            params['tabId'] = tab_id
        return self._request('GET', f'/api/v1/x/tweets/{tweet_id}/replies', params=params)

    def get_user_profile(self, screen_name: str, tab_id: Optional[int] = None) -> Dict[Any, Any]:
        """Get user profile"""
        params = {'screenName': screen_name}
        if tab_id:
            params['tabId'] = tab_id
        return self._request('GET', '/api/v1/x/users', params=params)

    def search_timeline(self, query: str, cursor: Optional[str] = None, count: int = 20, tab_id: Optional[int] = None) -> Dict[Any, Any]:
        """Search timeline"""
        params = {'query': query, 'count': count}
        if cursor:
            params['cursor'] = cursor
        if tab_id:
            params['tabId'] = tab_id
        return self._request('GET', '/api/v1/x/search', params=params)

    # Write APIs
    def create_tweet(self, text: str) -> Dict[Any, Any]:
        """Create a new tweet"""
        return self._request('POST', '/api/v1/x/tweets', json={'text': text})

    def create_reply(self, tweet_id: str, text: str) -> Dict[Any, Any]:
        """Reply to a tweet"""
        return self._request('POST', '/api/v1/x/replies', json={'tweetId': tweet_id, 'text': text})

    def like_tweet(self, tweet_id: str, tab_id: Optional[int] = None) -> Dict[Any, Any]:
        """Like a tweet"""
        data = {'tweetId': tweet_id}
        if tab_id:
            data['tabId'] = tab_id
        return self._request('POST', '/api/v1/x/likes', json=data)

    def unlike_tweet(self, tweet_id: str, tab_id: Optional[int] = None) -> Dict[Any, Any]:
        """Unlike a tweet"""
        data = {'tweetId': tweet_id}
        if tab_id:
            data['tabId'] = tab_id
        return self._request('POST', '/api/v1/x/unlikes', json=data)

    def retweet(self, tweet_id: str, tab_id: Optional[int] = None) -> Dict[Any, Any]:
        """Retweet"""
        data = {'tweetId': tweet_id}
        if tab_id:
            data['tabId'] = tab_id
        return self._request('POST', '/api/v1/x/retweets', json=data)

    def unretweet(self, tweet_id: str, tab_id: Optional[int] = None) -> Dict[Any, Any]:
        """Unretweet"""
        data = {'tweetId': tweet_id}
        if tab_id:
            data['tabId'] = tab_id
        return self._request('POST', '/api/v1/x/unretweets', json=data)

    def bookmark_tweet(self, tweet_id: str, tab_id: Optional[int] = None) -> Dict[Any, Any]:
        """Bookmark a tweet"""
        data = {'tweetId': tweet_id}
        if tab_id:
            data['tabId'] = tab_id
        return self._request('POST', '/api/v1/x/bookmarks', json=data)

    def unbookmark_tweet(self, tweet_id: str, tab_id: Optional[int] = None) -> Dict[Any, Any]:
        """Remove bookmark"""
        data = {'tweetId': tweet_id}
        if tab_id:
            data['tabId'] = tab_id
        return self._request('POST', '/api/v1/x/unbookmarks', json=data)

    def follow_user(self, user_id: str, tab_id: Optional[int] = None) -> Dict[Any, Any]:
        """Follow a user"""
        data = {'userId': user_id}
        if tab_id:
            data['tabId'] = tab_id
        return self._request('POST', '/api/v1/x/follows', json=data)

    def unfollow_user(self, user_id: str, tab_id: Optional[int] = None) -> Dict[Any, Any]:
        """Unfollow a user"""
        data = {'userId': user_id}
        if tab_id:
            data['tabId'] = tab_id
        return self._request('POST', '/api/v1/x/unfollows', json=data)

    def delete_tweet(self, tweet_id: str, tab_id: Optional[int] = None) -> Dict[Any, Any]:
        """Delete own tweet"""
        data = {'tweetId': tweet_id}
        if tab_id:
            data['tabId'] = tab_id
        return self._request('DELETE', '/api/v1/x/mytweets', json=data)

    # Tab Control APIs
    def open_tab(self, path: str = "home") -> Dict[Any, Any]:
        """Open a new X tab"""
        return self._request('POST', '/tweetclaw/open-tab', json={'path': path})

    def close_tab(self, tab_id: int) -> Dict[Any, Any]:
        """Close an X tab"""
        return self._request('POST', '/tweetclaw/close-tab', json={'tabId': tab_id})

    def navigate_tab(self, path: str, tab_id: Optional[int] = None) -> Dict[Any, Any]:
        """Navigate tab to path"""
        data = {'path': path}
        if tab_id:
            data['tabId'] = tab_id
        return self._request('POST', '/tweetclaw/navigate-tab', json=data)
