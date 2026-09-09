import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { DEFAULT_BANK_DIRECTORY } from '../lib/system-metadata-defaults';
import { loadBankDirectory } from '../services/server/bankDirectory';

function createSupabaseStub(result: unknown) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue(result);

  return {
    client: { from: vi.fn().mockReturnValue(query) },
    query,
  };
}

describe('shared bank directory', () => {
  it('returns normalized persisted options from the system metadata category', async () => {
    const { client, query } = createSupabaseStub({
      data: { data: [{ code: ' vcb ', label: ' Vietcombank ' }] },
      error: null,
    });

    const result = await loadBankDirectory(client as never);

    expect(client.from).toHaveBeenCalledWith('system_metadata');
    expect(query.select).toHaveBeenCalledWith('data');
    expect(query.eq).toHaveBeenCalledWith('name', 'Danh mục Ngân hàng');
    expect(result).toEqual({
      options: [{ code: 'vcb', label: 'Vietcombank' }],
      lookupFailed: false,
    });
  });

  it('keeps the profile usable with the default directory when the lookup fails', async () => {
    const { client } = createSupabaseStub({
      data: null,
      error: { code: 'PGRST000' },
    });

    await expect(loadBankDirectory(client as never)).resolves.toEqual({
      options: [...DEFAULT_BANK_DIRECTORY],
      lookupFailed: true,
    });
  });
});
