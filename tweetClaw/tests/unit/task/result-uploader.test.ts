import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResultUploaderImpl } from '../../../src/task/result-uploader';

describe('ResultUploader', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    vi.spyOn(global, 'setTimeout').mockImplementation((cb: any) => { cb(); return 0 as any; });
  });

  it('should upload result successfully', async () => {
    const uploader = new ResultUploaderImpl({ localBridgeBaseUrl: 'http://mock', clientName: 'c', instanceId: 'i' });
    
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ resultRef: 'file://mock/result.json' })
    });

    const ref = await uploader.uploadResult('task-1', 'app/json', new Uint8Array([1,2,3]));
    expect(ref).toBe('file://mock/result.json');
    expect(global.fetch).toHaveBeenCalledWith('http://mock/api/v1/tasks/task-1/result', expect.objectContaining({
      method: 'POST',
      headers: {
        'Content-Type': 'app/json',
        'X-Client-Name': 'c',
        'X-Instance-ID': 'i'
      }
    }));
  });

  it('should retry on upload failure and finally throw', async () => {
    const uploader = new ResultUploaderImpl({ localBridgeBaseUrl: 'http://mock', clientName: 'c', instanceId: 'i' });
    
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 502,
      text: () => Promise.resolve('Bad Gateway')
    });

    await expect(uploader.uploadResult('task-1', 'app/json', new Uint8Array([1]), 3)).rejects.toThrow('Upload failed: 502 - Bad Gateway');
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });
});
