"""
REST API Client for LocalBridge
"""
import requests
from typing import Optional, Dict, Any, List
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import API_BASE_URL, API_TIMEOUT, MEDIA_UPLOAD_TIMEOUT


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
    def create_tweet(self, text: str, media_ids: Optional[List[str]] = None) -> Dict[Any, Any]:
        """Create a new tweet with optional media"""
        data = {'text': text}
        if media_ids:
            data['media_ids'] = media_ids
        return self._request('POST', '/api/v1/x/tweets', json=data)

    def create_reply(self, tweet_id: str, text: str, media_ids: Optional[List[str]] = None) -> Dict[Any, Any]:
        """Reply to a tweet with optional media"""
        data = {'tweetId': tweet_id, 'text': text}
        if media_ids:
            data['media_ids'] = media_ids
        return self._request('POST', '/api/v1/x/replies', json=data)

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

    # Media Upload API
    def upload_media(self, file_path: str, tab_id: Optional[int] = None) -> str:
        """
        Upload media file (image/video) and return media_id

        Args:
            file_path: Path to the media file
            tab_id: Optional tab ID

        Returns:
            media_id_string for use in tweet creation
        """
        import base64
        import mimetypes

        # Read file and convert to base64
        with open(file_path, 'rb') as f:
            file_data = f.read()

        media_data = base64.b64encode(file_data).decode('utf-8')

        # Detect MIME type
        mime_type, _ = mimetypes.guess_type(file_path)
        if not mime_type:
            # Default to PNG if cannot detect
            mime_type = 'image/png'

        # Prepare request
        data = {
            'mediaData': media_data,
            'mimeType': mime_type
        }
        if tab_id:
            data['tabId'] = tab_id

        # Upload with extended timeout for large files (videos)
        response = self._request('POST', '/api/v1/x/media/upload', json=data, timeout=MEDIA_UPLOAD_TIMEOUT)

        if 'error' in response:
            raise Exception(f"Media upload failed: {response['error']}")

        return response.get('media_id_string', response.get('media_id', ''))

    # AI Claw APIs
    def get_ai_status(self) -> Dict[Any, Any]:
        """Get AI tabs status"""
        return self._request('GET', '/api/v1/ai/status')

    def send_ai_message(self, platform: str, prompt: str, conversation_id: Optional[str] = None) -> Dict[Any, Any]:
        """Send message to AI platform"""
        data = {'platform': platform, 'prompt': prompt}
        if conversation_id:
            data['conversationId'] = conversation_id
        return self._request('POST', '/api/v1/ai/message', json=data)

    def new_ai_conversation(self, platform: str) -> Dict[Any, Any]:
        """Create new AI conversation"""
        return self._request('POST', '/api/v1/ai/new_conversation', json={'platform': platform})

    def navigate_ai_platform(self, platform: str) -> Dict[Any, Any]:
        """Navigate AI platform to home"""
        return self._request('POST', '/api/v1/ai/navigate', json={'platform': platform})
