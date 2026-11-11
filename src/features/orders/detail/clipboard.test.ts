import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText } from './clipboard';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('copyText', () => {
  it('writes through the async clipboard when it is available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    await expect(copyText('ORD-100001')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('ORD-100001');
  });

  it('reports failure when the clipboard rejects and there is no fallback', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    await expect(copyText('ORD-100001')).resolves.toBe(false);
    expect(writeText).toHaveBeenCalledTimes(1);
  });

  it('reports failure when no clipboard is available at all', async () => {
    vi.stubGlobal('navigator', {});
    await expect(copyText('ORD-100001')).resolves.toBe(false);
  });

  it('falls back to the older copy command when the async clipboard is missing', async () => {
    const area = {
      value: '',
      style: {} as Record<string, string>,
      setAttribute: vi.fn(),
      select: vi.fn(),
      remove: vi.fn(),
    };
    const execCommand = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('document', {
      createElement: vi.fn().mockReturnValue(area),
      body: { appendChild: vi.fn() },
      execCommand,
    });

    await expect(copyText('ORD-100001')).resolves.toBe(true);
    expect(area.value).toBe('ORD-100001');
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(area.remove).toHaveBeenCalled();
  });

  it('reports failure when the older copy command throws, and still cleans up', async () => {
    const area = {
      value: '',
      style: {} as Record<string, string>,
      setAttribute: vi.fn(),
      select: vi.fn(),
      remove: vi.fn(),
    };
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('document', {
      createElement: vi.fn().mockReturnValue(area),
      body: { appendChild: vi.fn() },
      execCommand: vi.fn().mockImplementation(() => {
        throw new Error('not allowed');
      }),
    });

    await expect(copyText('x')).resolves.toBe(false);
    expect(area.remove).toHaveBeenCalled();
  });
});
