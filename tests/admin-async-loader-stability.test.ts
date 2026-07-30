import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');

describe('admin asynchronous loader stability', () => {
  it('keeps email template loading stable without capturing preview state', () => {
    const editor = read('app/admin/email-editor/page.tsx');

    expect(editor).toMatch(/const loadData = useCallback\(async/);
    expect(editor).toContain(
      'setSelectedPreview((currentPreview) => currentPreview ?? data[0])',
    );
    expect(editor).toContain(
      'useEffect(() => { void loadData(true); }, [loadData])',
    );
  });

  it('keeps metadata loading stable without resetting the active category', () => {
    const metadata = read('app/admin/metadata/page.tsx');

    expect(metadata).toMatch(/const loadMetadata = useCallback\(async/);
    expect(metadata).toContain(
      'setSelectedCatId((currentCategoryId) =>',
    );
    expect(metadata).toMatch(
      /useEffect\(\(\) => \{\s+void loadMetadata\(\);\s+\}, \[loadMetadata\]\)/,
    );
  });

  it('renders a dimensioned VietQR image through the Next image boundary', () => {
    const capital = read('app/admin/capital/page.tsx');

    expect(capital).toContain("import Image from 'next/image'");
    expect(capital).toMatch(
      /<Image src=\{activeQrUrl\} alt="VietQR" width=\{240\} height=\{240\} unoptimized/,
    );
    expect(capital).not.toMatch(/<img[^>]+activeQrUrl/);
  });
});
