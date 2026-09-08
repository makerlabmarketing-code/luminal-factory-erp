export interface SystemMetadataOption extends Record<string, SystemMetadataValue> {
  code: string;
  label: string;
}

export type SystemMetadataValue = string | number | boolean | null;

export type SystemMetadataRow = Record<string, SystemMetadataValue>;

export interface SystemMetadataCategory {
  id: number;
  name: string;
  data: SystemMetadataRow[];
  isFallback?: boolean;
}

export const FINANCIAL_TRANSACTION_TYPE_METADATA_NAME = 'Danh mục Nghiệp vụ';
export const CAPITAL_CONTRIBUTION_TYPE_METADATA_NAME = 'Danh mục Hình thức Góp vốn';
export const EXPENSE_CATEGORY_METADATA_NAME = 'Danh mục Loại Chi Tiêu';
export const BANK_DIRECTORY_METADATA_NAME = 'Danh mục Ngân hàng';

export const DEFAULT_FINANCIAL_TRANSACTION_TYPES: readonly SystemMetadataOption[] = [
  { code: 'CHI_PHI', label: '❌ Chi phí vận hành' },
  { code: 'VON_GOP', label: '🟢 Góp vốn' },
  { code: 'DOANH_THU', label: '💰 Doanh thu' },
  { code: 'HOAN_UNG', label: '🔄 Hoàn ứng' },
];

export const DEFAULT_CAPITAL_CONTRIBUTION_TYPES: readonly SystemMetadataOption[] = [
  { code: 'TIEN_MAT', label: '🏢 Góp vốn chung (Vào két quỹ)' },
  { code: 'HIEN_VAT', label: '👤 Cá nhân tự chi trả' },
];

export const DEFAULT_EXPENSE_CATEGORIES: readonly SystemMetadataOption[] = [
  { code: 'VAT_TU_SAN_XUAT', label: 'Vật tư sản xuất' },
  { code: 'DUNG_CU_XUONG', label: 'Dụng cụ xưởng' },
  { code: 'VAN_CHUYEN', label: 'Vận chuyển' },
  { code: 'VAN_PHONG', label: 'Văn phòng' },
  { code: 'KHAC', label: 'Khác' },
];

export const DEFAULT_BANK_DIRECTORY: readonly SystemMetadataOption[] = [
  { code: 'MB', label: 'MB Bank' },
  { code: 'VCB', label: 'Vietcombank' },
  { code: 'BIDV', label: 'BIDV' },
  { code: 'CTG', label: 'VietinBank' },
  { code: 'TCB', label: 'Techcombank' },
  { code: 'ACB', label: 'ACB' },
  { code: 'VPB', label: 'VPBank' },
  { code: 'TPB', label: 'TPBank' },
];

export const DEFAULT_SYSTEM_METADATA_CATEGORIES: readonly SystemMetadataCategory[] = [
  {
    id: -1,
    name: FINANCIAL_TRANSACTION_TYPE_METADATA_NAME,
    data: [...DEFAULT_FINANCIAL_TRANSACTION_TYPES],
    isFallback: true,
  },
  {
    id: -2,
    name: CAPITAL_CONTRIBUTION_TYPE_METADATA_NAME,
    data: [...DEFAULT_CAPITAL_CONTRIBUTION_TYPES],
    isFallback: true,
  },
  {
    id: -3,
    name: EXPENSE_CATEGORY_METADATA_NAME,
    data: [...DEFAULT_EXPENSE_CATEGORIES],
    isFallback: true,
  },
  {
    id: -4,
    name: BANK_DIRECTORY_METADATA_NAME,
    data: [...DEFAULT_BANK_DIRECTORY],
    isFallback: true,
  },
];

export function mergeSystemMetadataCategories(value: unknown): SystemMetadataCategory[] {
  const persisted = Array.isArray(value) ? value as SystemMetadataCategory[] : [];
  const persistedNames = new Set(persisted.map((category) => category.name));
  return [
    ...persisted,
    ...DEFAULT_SYSTEM_METADATA_CATEGORIES.filter((category) => !persistedNames.has(category.name)),
  ];
}

export function isSystemMetadataOption(value: unknown): value is SystemMetadataOption {
  if (!value || typeof value !== 'object') return false;
  const option = value as { code?: unknown; label?: unknown };
  return typeof option.code === 'string' && option.code.trim() !== '' && typeof option.label === 'string' && option.label.trim() !== '';
}

export function normalizeSystemMetadataOptions(
  value: unknown,
  fallback: readonly SystemMetadataOption[]
): SystemMetadataOption[] {
  if (!Array.isArray(value)) return [...fallback];
  const options = value.filter(isSystemMetadataOption).map((option) => ({
    code: option.code.trim(),
    label: option.label.trim(),
  }));
  return options.length > 0 ? options : [...fallback];
}
