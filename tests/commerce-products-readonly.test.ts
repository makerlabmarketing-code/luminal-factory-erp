import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { commerceProductEndpoints } from '../lib/commerce-admin/contracts';
import { filterAdminNavigation } from '../lib/navigation/admin';

vi.mock('server-only', () => ({}));

const source = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('Commerce product catalog catalog access foundation', () => {
  it('uses the signed product-only GET scope without reusing Hero permission', () => {
    expect(commerceProductEndpoints.list()).toMatchObject({
      method: 'GET',
      path: '/api/admin/v1/products',
      scope: 'commerce.product.read',
      capability: 'COMMERCE_PRODUCT_VIEW',
    });
    expect(commerceProductEndpoints.list().body).toBeUndefined();
  });

  it('hides navigation until a dedicated Product view permission is provisioned', () => {
    const withHeroOnly = filterAdminNavigation(['COMMERCE_HOMEPAGE_HERO_VIEW']);
    const heroItems = withHeroOnly.flatMap((group) => group.items).map((item) => item.path);
    expect(heroItems).toContain('/admin/commerce/homepage-hero');
    expect(heroItems).not.toContain('/admin/commerce/products');

    const withProduct = filterAdminNavigation(['COMMERCE_PRODUCT_VIEW']);
    const productItems = withProduct.flatMap((group) => group.items).map((item) => item.path);
    expect(productItems).toContain('/admin/commerce/products');
    expect(productItems).not.toContain('/admin/commerce/homepage-hero');
  });

  it('keeps Product requests server-owned and draft writes separate', () => {
    const adapter = source('services/server/commerceAdminProducts.ts');
    const page = source('app/admin/commerce/products/page.tsx');
    const route = source('app/api/admin/commerce/products/route.ts');

    expect(adapter).toMatch(/^import 'server-only';/);
    expect(adapter).toContain('requestCommerceAdmin(');
    expect(adapter).toContain('value.every(isProductRecord)');
    expect(page).toContain('Danh mục sản phẩm');
    expect(page).toContain("requireCommerceProductAccess('COMMERCE_PRODUCT_VIEW')");
    expect(page).not.toMatch(/onSubmit|fetch\(|createClient|serviceRole/);
    expect(route).toContain('listCommerceProducts()');
    expect(route).toContain("requireCommerceProductAccess('COMMERCE_PRODUCT_MANAGE')");
    expect(route).not.toMatch(/export async function DELETE/);
  });
});
