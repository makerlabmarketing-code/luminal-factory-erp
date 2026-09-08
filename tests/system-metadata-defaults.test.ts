import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_CAPITAL_CONTRIBUTION_TYPES,
  BANK_DIRECTORY_METADATA_NAME,
  DEFAULT_BANK_DIRECTORY,
  DEFAULT_FINANCIAL_TRANSACTION_TYPES,
  DEFAULT_SYSTEM_METADATA_CATEGORIES,
  FINANCIAL_TRANSACTION_TYPE_METADATA_NAME,
  mergeSystemMetadataCategories,
  normalizeSystemMetadataOptions,
} from "../lib/system-metadata-defaults";

const repositoryRoot = join(__dirname, "..");

function source(relativePath: string): string {
  return readFileSync(join(repositoryRoot, relativePath), "utf8");
}

describe("system metadata dropdown fallbacks", () => {
  it("keeps financial ledger dropdowns usable when system_metadata rows are empty or missing", () => {
    expect(
      normalizeSystemMetadataOptions(null, DEFAULT_FINANCIAL_TRANSACTION_TYPES),
    ).toEqual(DEFAULT_FINANCIAL_TRANSACTION_TYPES);
    expect(
      normalizeSystemMetadataOptions([], DEFAULT_CAPITAL_CONTRIBUTION_TYPES),
    ).toEqual(DEFAULT_CAPITAL_CONTRIBUTION_TYPES);
    expect(
      normalizeSystemMetadataOptions(
        [{ code: "", label: "Blank" }],
        DEFAULT_FINANCIAL_TRANSACTION_TYPES,
      ),
    ).toEqual(DEFAULT_FINANCIAL_TRANSACTION_TYPES);
  });

  it("preserves DB metadata when valid options exist", () => {
    expect(
      normalizeSystemMetadataOptions(
        [
          { code: " CUSTOM ", label: " Tuỳ chỉnh " },
          { code: "", label: "Bỏ qua" },
        ],
        DEFAULT_FINANCIAL_TRANSACTION_TYPES,
      ),
    ).toEqual([{ code: "CUSTOM", label: "Tuỳ chỉnh" }]);
  });

  it("exposes default categories for the metadata management screen", () => {
    expect(
      DEFAULT_SYSTEM_METADATA_CATEGORIES.map((category) => category.name),
    ).toContain(FINANCIAL_TRANSACTION_TYPE_METADATA_NAME);
    expect(DEFAULT_SYSTEM_METADATA_CATEGORIES.map((category) => category.name)).toContain(BANK_DIRECTORY_METADATA_NAME);
    expect(DEFAULT_BANK_DIRECTORY.some((bank) => bank.code === 'MB')).toBe(true);
    expect(
      DEFAULT_SYSTEM_METADATA_CATEGORIES.every(
        (category) => category.isFallback,
      ),
    ).toBe(true);
  });

  it("adds missing defaults without hiding persisted categories", () => {
    const persisted = [{ id: 9, name: FINANCIAL_TRANSACTION_TYPE_METADATA_NAME, data: [{ code: 'CUSTOM', label: 'Custom' }] }];
    const merged = mergeSystemMetadataCategories(persisted);
    expect(merged.find((category) => category.id === 9)?.data).toEqual(persisted[0].data);
    expect(merged.map((category) => category.name)).toContain(BANK_DIRECTORY_METADATA_NAME);
  });

  it("uses fallback metadata in the capital and metadata pages without writing seed data", () => {
    const capitalPage = source("app/admin/capital/page.tsx");
    const metadataPage = source("app/admin/metadata/page.tsx");
    const metadataRoute = source("app/api/admin/system-metadata/route.ts");

    expect(capitalPage).toMatch(/DEFAULT_FINANCIAL_TRANSACTION_TYPES/);
    expect(capitalPage).toMatch(
      /normalizeSystemMetadataOptions\(meta\?\.data, DEFAULT_FINANCIAL_TRANSACTION_TYPES\)/,
    );
    expect(capitalPage).toMatch(
      /normalizeSystemMetadataOptions\(contribMeta\?\.data, DEFAULT_CAPITAL_CONTRIBUTION_TYPES\)/,
    );
    expect(metadataRoute).toMatch(/mergeSystemMetadataCategories/);
    expect(metadataPage).toMatch(/payload\.categories \|\| \[\]/);
    expect(metadataPage).toMatch(
      /Danh mục mặc định chỉ dùng khi hệ thống chưa có cấu hình/,
    );
    expect(`${metadataPage}\n${metadataRoute}`).not.toMatch(
      /upsert\(|insert\(DEFAULT_SYSTEM_METADATA_CATEGORIES/,
    );
  });
});
