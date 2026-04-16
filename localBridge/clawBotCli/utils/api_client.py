"""
REST API Client for LocalBridge
"""
import requests
from typing import Optional, Dict, Any, List
import json
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
        except requests.exceptions.HTTPError as e:
            error_message = str(e)
            response = e.response
            if response is not None:
                try:
                    payload = response.json()
                    if isinstance(payload, dict) and payload.get('error'):
                        error_message = payload['error']
                    elif isinstance(payload, dict) and payload.get('message'):
                        error_message = payload['message']
                    else:
                        error_message = json.dumps(payload, ensure_ascii=False)
                except ValueError:
                    body = response.text.strip()
                    if body:
                        error_message = body
            return {"error": error_message, "status_code": response.status_code if response is not None else None}
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

    # (Removed legacy upload_media implementation)

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


class MediaUploadTask:
    """
    流式媒体上传任务封装类
    
    该类实现了设计文档中要求的 6 步任务生命周期，通过将原本同步阻塞的 Base64 上传模式
    改造成基于分片上传和任务状态轮询的异步模式，极大提升了大文件上传的稳定性。
    """
    
    def __init__(self, task_client, uploader, progress):
        """
        Args:
            task_client: TaskClient 实例
            uploader: ChunkedUploader 实例
            progress: ProgressDisplay 实例
        """
        self.task_client = task_client
        self.uploader = uploader
        self.progress = progress
    
    def upload_video(
        self,
        video_path: str,
        client_name: str = "tweetClaw",
        instance_id: str = None,
        tab_id: int = None
    ) -> str:
        """
        上传视频并返回 media_id
        
        通过 6 步完整生命周期实现：
        1. 获取/校验 instanceId
        2. 创建任务 (POST /api/v1/tasks)
        3. 分片上传 (PUT .../input/{partIndex})
        4. 封存输入 (POST .../seal)
        5. 启动任务 (POST .../start)
        6. 轮询并获取执行结果 (GET .../result)
        
        Args:
            video_path: 视频文件在本地磁盘的绝对路径
            client_name: 客户端名称标识，默认 "tweetClaw"
            instance_id: 特定实例 ID，如果为 None 则自动查找配置文件中的默认值
            tab_id: 可选的浏览器标签页 ID
            
        Returns:
            str: 上传成功并在 Twitter 后端通过校验的 media_id
            
        Raises:
            KeyboardInterrupt: 用户手动按下 Ctrl+C 时抛出，会自动触发服务端取消
            Exception: 任何网络、超时或业务逻辑错误时抛出
        """
        task_id = None
        try:
            # 获取 instance_id
            if not instance_id:
                instance_id = self.task_client.get_default_instance_id(client_name)
            
            # 1. 创建任务
            print(f"Creating upload task for {os.path.basename(video_path)}...")
            task_id = self.task_client.create_task(
                client_name=client_name,
                instance_id=instance_id,
                task_kind="x.media_upload",
                input_mode="chunked_binary",
                params={"tabId": tab_id}
            )
            print(f"Task created: {task_id}")
            
            # 2. 分片上传
            print("Uploading video...")
            total_parts, total_bytes, content_type = self.uploader.upload_file(
                task_id,
                video_path,
                progress_callback=lambda c, t: self.progress.show_upload_progress(
                    c, t, os.path.basename(video_path)
                )
            )
            
            # 3. Seal 输入
            print("Finalizing upload...")
            self.task_client.seal_input(task_id, total_parts, total_bytes, content_type)
            
            # 4. 启动任务
            print("Starting upload task...")
            self.task_client.start_task(task_id)
            
            # 5. 等待完成
            print("Processing video...")
            result = self.task_client.wait_for_completion(
                task_id,
                poll_interval=2.0,
                timeout=300.0,
                progress_callback=lambda state, phase, prog: 
                    self.progress.show_task_progress(state, phase, prog)
            )
            
            if result['state'] == 'completed':
                # 6. 获取结果
                result_data = self.task_client.get_task_result(task_id)
                result_json = json.loads(result_data)
                media_id = result_json['mediaId']
                print(f"\nUpload completed! Media ID: {media_id}")
                return media_id
            else:
                error_msg = result.get('errorMessage', 'Unknown error')
                raise Exception(f"Upload failed: {error_msg}")
        
        except KeyboardInterrupt:
            if task_id:
                print("\n\nCancelling upload...")
                try:
                    self.task_client.cancel_task(task_id)
                    print("Upload cancelled.")
                except Exception as e:
                    print(f"Failed to cancel task: {e}")
            raise
        except Exception as e:
            if task_id:
                print(f"\nUpload failed: {e}")
                try:
                    self.task_client.cancel_task(task_id)
                except:
                    pass
            raise
