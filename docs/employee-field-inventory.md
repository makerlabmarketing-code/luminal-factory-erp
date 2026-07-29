# Employee field inventory

`public.employees` is the authoritative employee profile row. This inventory records only columns already evidenced by repository queries; it does not propose schema changes.

| Classification | Field / authoritative column | Admin | Staff own profile | Empty value | Current dependency |
|---|---|---|---|---|---|
| Required core identity | Employee key — `employees.id` | Read; never edited in profile | Read | Invalid | Attendance, payroll, projects, account/workspace relationships |
| Required core identity | Full name — `employees.full_name` | Read; `EMPLOYEE_MANAGE` edit | Read only | Invalid on create/update | All employee presentation |
| Required core employment | Email — `employees.email` | Read; `EMPLOYEE_MANAGE` edit | Read only | Existing null is representable; required before Admin save/invite | Auth account connection and notifications |
| Required core employment | Employment status — `employees.status` plus derived `is_active` compatibility | Read; `EMPLOYEE_MANAGE` edit of `status` | Read only | Invalid on create/update | Active employee, account and assignment eligibility |
| Operational | Facility assignment — `employees.branch_code`, enriched from facility directory | Read; `EMPLOYEE_MANAGE` edit | Read assigned facility | Valid (unassigned) | Attendance/facility operations |
| Operational | Job title — `employees.title` | Read; `EMPLOYEE_MANAGE` edit | Read | Valid | Payroll shift-wage display and staffing |
| Operational | Auth connection — `employees.auth_user_id`, enriched from Supabase Auth | Read; managed only by account actions | Derived own session | Valid (not connected) | Authentication and workspaces |
| Operational | Hourly rate — `employees.hourly_rate` | Read only with `FINANCE_VIEW` or employee-manage capability | Read own value through authenticated profile | Valid until payroll configuration | Payroll |
| Optional personal | Phone — `employees.phone` | Read; `EMPLOYEE_MANAGE` + `FINANCE_VIEW` edit | Read and edit own row | Valid | Contact |
| Optional personal | Bank — `employees.bank_name` | Read; `EMPLOYEE_MANAGE` + `FINANCE_VIEW` edit | Read and edit own row | Valid | Payroll/reimbursement payment |
| Optional personal | Bank account — `employees.bank_account_number` | Read; `EMPLOYEE_MANAGE` + `FINANCE_VIEW` edit | Read and edit own row | Valid | Payroll/reimbursement payment |
| Derived/enriched | Facility display/status | Read | Read | “Chưa cập nhật” or local warning, depending on empty vs failed lookup | Facility directory |
| Derived/enriched | Account connection/invitation state | Read; account actions require `ACCOUNT_MANAGE` | Not editable | “Chưa kết nối” is valid | Auth + workspace access |
| Derived/enriched | Effective permissions/workspaces | Read; centralized account manager only | Effective access only | Empty is valid | Authorization |
| Derived/enriched | Project memberships | Read | Own assignments elsewhere | Empty is valid | Project assignment |
| Derived/enriched | Created date — `employees.created_at` | Read | Not currently shown | Valid for legacy rows | Audit context |
| Schema extension required | Birth date, gender, address, avatar, personal notes, employment type/start date, direct manager, employee change history | Unavailable | Unavailable | Unknown | Draft package `20260729_employee_profile_extension`; operator/business approval required |
| Business decision blocked | Emergency contact, contracts, tax and insurance identifiers | Unavailable | Unavailable | Unknown | No authoritative repository columns or approved rules |

## Missing-data and failure contract

A nullable field that loads successfully is displayed as **Chưa cập nhật**. Failure of facility, Auth, workspace/permission, or membership enrichment is not treated as an empty employee field: Employee Detail keeps the core row visible and shows a section-local Vietnamese warning with **Thử tải lại**. Each editable tab owns its dirty state and PATCH payload; save controls appear only for changed fields, while viewers without `EMPLOYEE_MANAGE` receive read-only values and no edit action.
