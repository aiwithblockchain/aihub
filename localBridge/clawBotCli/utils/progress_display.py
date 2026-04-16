import threading

class ProgressDisplay:
    """进度显示器"""
    
    def __init__(self, verbose: bool = False):
        """
        初始化进度显示器
        
        Args:
            verbose: 是否开启详细模式
        """
        self.verbose = verbose
        self.lock = threading.Lock()
    
    def show_upload_progress(
        self,
        current: int,
        total: int,
        file_name: str
    ) -> None:
        """
        显示文件上传分片进度
        
        Args:
            current: 当前已完成的分片索引 (1-based)
            total: 总分片数
            file_name: 正在上传的文件名
        """
        with self.lock:
            percent = (current / total) * 100
            bar_length = 40
            filled = int(bar_length * current / total)
            bar = '=' * filled + '-' * (bar_length - filled)
            
            print(f'\rUploading {file_name}: [{bar}] {percent:.1f}% ({current}/{total} chunks)', end='', flush=True)
            
            if current == total:
                print()
    
    def show_task_progress(
        self,
        state: str,
        phase: str,
        progress: float
    ) -> None:
        """
        显示服务器任务执行进度
        
        Args:
            state: 任务状态 (例如 'running', 'completed')
            phase: 任务当前阶段描述
            progress: 进度比例 (0.0 to 1.0)
        """
        with self.lock:
            if state == 'running':
                percent = progress * 100
                print(f'\rTask {state}: {phase} - {percent:.1f}%        ', end='', flush=True)
            else:
                print(f'\nTask {state}: {phase}')
    
    def show_error(self, error_code: str, error_message: str) -> None:
        """
        在终端显示格式化错误
        
        Args:
            error_code: 错误码
            error_message: 错误详细描述
        """
        with self.lock:
            print(f'\nError [{error_code}]: {error_message}')
