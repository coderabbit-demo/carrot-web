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


describe('copyText fallback regressions', () => {
  function fallback(execCommand: () => boolean) {
    const area = {
      value: '', style: {} as Record<string, string>,
      setAttribute: vi.fn(), select: vi.fn(), remove: vi.fn(),
    };
    const appendChild = vi.fn();
    vi.stubGlobal('document', {
      createElement: vi.fn().mockReturnValue(area),
      body: { appendChild }, execCommand,
    });
    return { area, appendChild };
  }

  it.each(['reject', 'throw'] as const)('tries the legacy command when the clipboard fails: %s', async (mode) => {
    const writeText = vi.fn(() => {
      if (mode === 'throw') throw new Error('denied');
      return Promise.reject(new Error('denied'));
    });
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const execCommand = vi.fn().mockReturnValue(true);
    const { area, appendChild } = fallback(execCommand);
    await expect(copyText('ORD-000123')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('ORD-000123');
    expect(area.value).toBe('ORD-000123');
    expect(area.setAttribute).toHaveBeenCalledWith('readonly', '');
    expect(appendChild).toHaveBeenCalledWith(area);
    expect(area.select).toHaveBeenCalledOnce();
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(area.remove).toHaveBeenCalledOnce();
  });

  it('reports a false legacy result and removes the temporary textarea', async () => {
    vi.stubGlobal('navigator', undefined);
    const { area } = fallback(vi.fn().mockReturnValue(false));
    await expect(copyText('ORD-123')).resolves.toBe(false);
    expect(area.remove).toHaveBeenCalledOnce();
  });

  it('does not create a legacy textarea after a successful async copy', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    const createElement = vi.fn();
    vi.stubGlobal('document', { createElement });
    await expect(copyText('')).resolves.toBe(true);
    expect(createElement).not.toHaveBeenCalled();
  });
});
