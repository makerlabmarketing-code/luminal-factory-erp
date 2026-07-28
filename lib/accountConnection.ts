export type AccountConnectionStatus =
  | 'NOT_CONNECTED'
  | 'MISSING_EMAIL'
  | 'INVITED'
  | 'PENDING_PASSWORD'
  | 'CONNECTED'
  | 'INVITE_ERROR'
  | 'INVITE_EXPIRED'
  | 'ACCESS_REVOKED'
  | 'AUTH_USER_MISSING'
  | 'AUTH_LOOKUP_FAILED'
  | 'AUTH_EMAIL_MISMATCH'
  | 'DUPLICATE_AUTH_MAPPING'
  | 'EMPLOYEE_INACTIVE';

export interface AccountStatusInput {
  employeeEmail?: string | null;
  authUserId?: string | null;
  employeeIsActive: boolean;
  authLookupFailed?: boolean;
  duplicateMapping?: boolean;
  accessRevoked?: boolean;
  authUser: {
    email?: string | null;
    invitedAt?: string | null;
    confirmedAt?: string | null;
    lastSignInAt?: string | null;
    bannedUntil?: string | null;
  } | null;
}

const email = (value?: string | null) => (value || '').trim().toLowerCase();

export function resolveAccountConnectionStatus(input: AccountStatusInput): AccountConnectionStatus {
  if (!input.employeeIsActive) return 'EMPLOYEE_INACTIVE';
  if (!input.authUserId && !email(input.employeeEmail)) return 'MISSING_EMAIL';
  if (!input.authUserId) return 'NOT_CONNECTED';
  if (input.authLookupFailed) return 'AUTH_LOOKUP_FAILED';
  if (input.duplicateMapping) return 'DUPLICATE_AUTH_MAPPING';
  if (!input.authUser) return 'AUTH_USER_MISSING';
  if (email(input.employeeEmail) && email(input.authUser.email) && email(input.employeeEmail) !== email(input.authUser.email)) return 'AUTH_EMAIL_MISMATCH';
  if (input.accessRevoked || input.authUser.bannedUntil) return 'ACCESS_REVOKED';
  if (!input.authUser.confirmedAt && input.authUser.invitedAt) return 'INVITED';
  if (!input.authUser.lastSignInAt) return 'PENDING_PASSWORD';
  return 'CONNECTED';
}

export const accountConnectionLabels: Record<AccountConnectionStatus, string> = {
  NOT_CONNECTED: 'Chưa kết nối',
  MISSING_EMAIL: 'Thiếu email',
  INVITED: 'Đã gửi lời mời',
  PENDING_PASSWORD: 'Chờ đặt mật khẩu',
  CONNECTED: 'Đã kết nối',
  INVITE_ERROR: 'Lời mời lỗi',
  INVITE_EXPIRED: 'Lời mời hết hạn',
  ACCESS_REVOKED: 'Đã thu hồi quyền',
  AUTH_USER_MISSING: 'Không tìm thấy tài khoản',
  AUTH_LOOKUP_FAILED: 'Chưa tải được trạng thái tài khoản',
  AUTH_EMAIL_MISMATCH: 'Email tài khoản không khớp',
  DUPLICATE_AUTH_MAPPING: 'Lỗi liên kết',
  EMPLOYEE_INACTIVE: 'Nhân sự ngừng hoạt động',
};

export const accountConnectionExplanations: Record<AccountConnectionStatus, string> = {
  NOT_CONNECTED: 'Hồ sơ chưa liên kết với tài khoản đăng nhập.',
  MISSING_EMAIL: 'Cần bổ sung email trước khi gửi lời mời.',
  INVITED: 'Đã gửi lời mời và đang chờ xác nhận.',
  PENDING_PASSWORD: 'Tài khoản chưa hoàn tất lần đăng nhập đầu tiên.',
  CONNECTED: 'Liên kết hồ sơ và tài khoản đăng nhập hợp lệ.',
  INVITE_ERROR: 'Lần gửi lời mời gần nhất không thành công.',
  INVITE_EXPIRED: 'Lời mời trước đã hết hạn và có thể gửi lại.',
  ACCESS_REVOKED: 'Quyền truy cập hệ thống hiện đã bị thu hồi.',
  AUTH_USER_MISSING: 'Mã liên kết không còn tồn tại trong Supabase Auth.',
  AUTH_LOOKUP_FAILED: 'Dịch vụ tài khoản tạm thời chưa phản hồi; hồ sơ nhân sự không bị ảnh hưởng.',
  AUTH_EMAIL_MISMATCH: 'Email hồ sơ khác email của tài khoản đang liên kết.',
  DUPLICATE_AUTH_MAPPING: 'Nhiều hồ sơ đang trỏ tới cùng một tài khoản; cần đối chiếu thủ công.',
  EMPLOYEE_INACTIVE: 'Hồ sơ nhân sự hiện không hoạt động.',
};
