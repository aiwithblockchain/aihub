import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataFetcher } from '../../../src/task/data-fetcher';

describe('DataFetcher', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('should create input reader with correct metadata', () => {
    const fetcher = new DataFetcher('http://mock', 'client', 'inst');
    const metadata = { totalParts: 2, totalBytes: 100, contentType: 'video/mp4' };
    const reader = fetcher.createInputReader('task-123', metadata);
    expect(reader.getMetadata()).toEqual(metadata);
  });

  it('should read part and handle success', async () => {
    const fetcher = new DataFetcher('http://mock', 'client', 'inst');
    const reader = fetcher.createInputReader('task-123', { totalParts: 1, totalBytes: 4, contentType: 'text/plain' });
    
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3, 4]).buffer)
    });

    const part = await reader.readPart(0);
    expect(part.length).toBe(4);
    expect(global.fetch).toHaveBeenCalledWith('http://mock/api/v1/tasks/task-123/input/0', expect.any(Object));
  });

  it('should throw error for invalid part index', async () => {
    const fetcher = new DataFetcher('http://mock', 'client', 'inst');
    const reader = fetcher.createInputReader('task-123', { totalParts: 1, totalBytes: 0, contentType: 'text/plain' });
    await expect(reader.readPart(1)).rejects.toThrow('Invalid part index');
  });

  it('should retry on fetch failure then throw', async () => {
    const fetcher = new DataFetcher('http://mock', 'client', 'inst');
    const reader = fetcher.createInputReader('task-123', { totalParts: 1, totalBytes: 0, contentType: 'text/plain' });
    
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 500
    });

    // Mock setTimeout to instantly resolve to speed up test
    vi.spyOn(global, 'setTimeout').mockImplementation((cb: any) => { cb(); return 0 as any; });

    await expect(reader.readPart(0, 3)).rejects.toThrow('Failed to fetch part 0: 500');
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('should validate integrity sum on iteration', async () => {
    const fetcher = new DataFetcher('http://mock', 'client', 'inst');
    const reader = fetcher.createInputReader('task-123', { totalParts: 2, totalBytes: 10, contentType: 'text/plain' });
    
    // We only return 6 bytes total, simulating truncation
    (global.fetch as any).mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3]).buffer)
    });

    const iterator = reader[Symbol.asyncIterator]();
    await iterator.next(); // part 0 (3 bytes)
    await iterator.next(); // part 1 (3 bytes)
    
    await expect(iterator.next()).rejects.toThrow('Data integrity error: expected 10 bytes but downloaded 6');
  });
});
