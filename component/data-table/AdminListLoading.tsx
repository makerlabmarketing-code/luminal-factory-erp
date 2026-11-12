import { AdminPage, AdminPageHeader } from '@/component/AdminUI';
import { CommonTable, TableLoadingRows } from './CommonTable';

const adminListLayouts = {
  '/admin/accounts': { title: 'Phân quyền', columns: ['Nhân sự', 'Tài khoản', 'Cổng nhân viên', 'Trang quản trị', 'Mẫu quyền', 'Số quyền', 'Truy cập', 'Thao tác'] },
  '/admin/capital': { title: 'Sổ thu chi', columns: ['Khoản mục', 'Người thực hiện', 'Người hưởng lợi', 'Trạng thái quỹ', 'Số tiền', 'Hành động'] },
  '/admin/commerce/products': { title: "Danh mục sản phẩm", columns: ['Sản phẩm', 'Loại', 'Cách phát hành', 'Trạng thái', 'Cập nhật', 'Thao tác'] },
  '/admin/commerce/raffles': { title: "Raffle", columns: ['Đợt raffle', 'Trạng thái', 'Mở', 'Đóng', 'Thao tác'] },
  '/admin/email-history': { title: 'Lịch sử email hệ thống', columns: ['Thời gian gửi', 'Phân hệ', 'Người nhận', 'Tiêu đề', 'Trạng thái', 'Xem'] },
  '/admin/employees': { title: 'Hồ sơ nhân sự', columns: ['Nhân sự', 'Trạng thái', 'Cơ sở', 'Tài khoản hệ thống', 'Thao tác'] },
  '/admin/facilities': { title: 'Cơ sở làm việc', columns: ['Tên cơ sở / chi nhánh', 'Địa chỉ thực tế tại xưởng', 'Vĩ độ', 'Kinh độ', 'Vùng an toàn', 'Trạng thái', 'Thao tác'] },
  '/admin/metadata': { title: 'Danh mục hệ thống', columns: ['Mã', 'Tên hiển thị', 'Thứ tự', 'Trạng thái', 'Thao tác'] },
  '/admin/payroll': { title: 'Quyết toán lương tháng', columns: ['Nhân viên', 'Giờ / ca', 'Lương tính', 'Điều chỉnh', 'Thực nhận', 'Trạng thái', 'Thao tác'] },
  '/admin/production-orders': { title: 'Lệnh sản xuất', columns: ['Lệnh sản xuất', 'Dự án / mẫu màu', 'Trạng thái', 'Giai đoạn', 'Sản lượng', 'Hạn hoàn thành'] },
  '/admin/projects': { title: 'Điều phối dự án', columns: ['Dự án / dòng sản phẩm', 'Colorway', 'Bị vướng', 'Tiến độ', 'Mục tiêu', 'Việc tiếp theo', 'Thao tác'] },
} as const;

type AdminListRoute = keyof typeof adminListLayouts;

export function isAdminListRoute(path: string): path is AdminListRoute {
  return Object.hasOwn(adminListLayouts, path);
}

export default function AdminListLoading({ route }: { route: AdminListRoute }) {
  const { title, columns } = adminListLayouts[route];
  return (
    <AdminPage>
      <AdminPageHeader title={title} />
      <section className="admin-table-shell overflow-x-auto" aria-busy="true">
        <CommonTable className="min-w-[36rem]">
          <thead><tr>{columns.map(column => <th key={column} scope="col">{column}</th>)}</tr></thead>
          <tbody><TableLoadingRows columns={columns.length} /></tbody>
        </CommonTable>
      </section>
    </AdminPage>
  );
}
