import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..');
const source = (relativePath: string) =>
  readFileSync(join(root, relativePath), 'utf8');

describe('Homepage Hero administration consumer', () => {
  it('routes browser operations through ERP server boundaries', () => {
    const page = source('app/admin/commerce/homepage-hero/page.tsx');
    const client = source(
      'app/admin/commerce/homepage-hero/HomepageHeroManagerClient.tsx',
    );
    const route = source('app/api/admin/commerce/homepage-hero/route.ts');
    const access = source(
      'services/server/commerceAdminHomepageHeroAccess.ts',
    );

    expect(page).toMatch(
      /requireHomepageHeroAccess\('COMMERCE_HOMEPAGE_HERO_VIEW'\)/,
    );
    expect(route).toMatch(/listHomepageHeroPresentations/);
    expect(route).toMatch(/createHomepageHeroDraft/);
    expect(access).toMatch(/requireWorkspaceAccess\('ADMIN_WORKSPACE'\)/);
    expect(access).toMatch(/hasPermission\(authContext, capability\)/);
    expect(client).not.toMatch(
      /SUPABASE_SECRET_KEY|HMAC_SECRET|createClient\(|service[_-]?role/i,
    );
  });

  it('supports asset list, signed upload ticket and bounded direct upload', () => {
    const contracts = source('lib/commerce-admin/contracts.ts');
    const adapter = source('services/server/commerceAdminHomepageHero.ts');
    const uploadRoute = source(
      'app/api/admin/commerce/homepage-hero/assets/upload-ticket/route.ts',
    );
    const client = source(
      'app/admin/commerce/homepage-hero/HomepageHeroManagerClient.tsx',
    );

    expect(contracts).toMatch(
      /HOMEPAGE_HERO_ASSET_MAX_BYTES = 10 \* 1024 \* 1024/,
    );
    expect(contracts).toMatch(/homepage-hero\/assets\/upload-ticket/);
    expect(adapter).toMatch(/createHomepageHeroAssetUploadTicket/);
    expect(uploadRoute).toMatch(/COMMERCE_HOMEPAGE_HERO_MANAGE/);
    expect(client).toMatch(/fetch\(ticket\.signedUrl/);
    expect(client).toMatch(/Tệp Hero phải có từ 1 đến/);
  });

  it('keeps the 3D preview isolated and pins the Commerce model-viewer version', () => {
    const client = source('app/admin/commerce/homepage-hero/HomepageHeroManagerClient.tsx') + source('lib/commerce-admin/hero-preview.ts');

    expect(client).toMatch(
      /model-viewer\/4\.3\.1\/model-viewer\.min\.js/,
    );
    expect(client).toMatch(/sandbox="allow-scripts"/);
    expect(client).toMatch(/referrerPolicy="no-referrer"/);
    expect(client).toMatch(/camera-orbit/);
    expect(client).toMatch(/orientation="0deg -52deg 0deg"/);
    expect(client).toMatch(/camera-controls disable-pan/);
    expect(client).toMatch(/camera-target="auto auto auto"/);
    expect(client).toMatch(/file.size > HOMEPAGE_HERO_ASSET_MAX_BYTES/);
    expect(client).toMatch(/field-of-view/);
    expect(client).toMatch(/previewLocalModel/);
    expect(client).toMatch(/reader.readAsDataURL/);
    expect(client).toMatch(/Boolean\(localModelPreview\)/);
    expect(client).toMatch(/Chỉ xem trên máy, không tải lên hay lưu vào Commerce/);
    const localControls = client.slice(client.indexOf('Tên cấu hình'), client.indexOf('Hero đang dùng', client.indexOf('Tên cấu hình')));
    expect(localControls).not.toMatch(/disabled=\{integrationDisabled\}/);
    expect(client).toMatch(/shadow-intensity/);
    expect(client).toMatch(/exposure/);
  });

  it('adds Vietnamese Commerce navigation without expanding the permission catalog', () => {
    const navigation = source('lib/navigation/admin.ts');
    const vocabulary = source('lib/i18n/vi.ts');
    const permissions = source('lib/account-permissions.ts');

    expect(vocabulary).toMatch(/commerce: "Thương mại"/);
    expect(vocabulary).toMatch(/homepageHero: "Hero trang chủ"/);
    expect(navigation).toMatch(/path: "\/admin\/commerce\/homepage-hero"/);
    expect(navigation).toMatch(/COMMERCE_HOMEPAGE_HERO_VIEW/);
    expect(permissions).not.toMatch(
      /COMMERCE_HOMEPAGE_HERO_VIEW|COMMERCE_HOMEPAGE_HERO_MANAGE/,
    );
  });

  it('keeps publish separate from draft save and protected by confirmation', () => {
    const client = source(
      'app/admin/commerce/homepage-hero/HomepageHeroManagerClient.tsx',
    );

    expect(client).toMatch(/Lưu nháp/);
    expect(client).toMatch(/Dùng Hero này/);
    expect(client).toMatch(/showConfirm/);
    expect(client).toMatch(/mutationRetry\.current\.prepare/);
    expect(client).toMatch(/mutationRetry\.current\.confirm\(operationId\)/);
    expect(client).toMatch(/mutationInFlight\.current/);
    expect(client).toMatch(/changePublishState/);
  });

  it('explains material tint and why remote save can be unavailable', () => {
    const client = source(
      'app/admin/commerce/homepage-hero/HomepageHeroManagerClient.tsx',
    );

    expect(client).toMatch(
      /Màu phủ áp lên vật liệu 3D/,
    );
  });
});
