import { listCommerceProducts } from '@/services/server/commerceAdminProducts';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Bản nháp',
  published: 'Đã xuất bản',
  archived: 'Đã lưu trữ',
};
const RELEASE_LABEL: Record<string, string> = {
  direct: 'Bán trực tiếp',
  preorder: 'Đặt trước',
  informational: 'Giới thiệu / raffle',
};
const TYPE_LABEL: Record<string, string> = {
  artisan_keycap: 'Artisan keycap',
  collectible_object: 'Đồ sưu tầm',
  custom_object: 'Đồ tùy chỉnh',
  other: 'Khác',
};

export default async function CommerceProductsPage() {
  let products: Awaited<ReturnType<typeof listCommerceProducts>> = [];
  let error: string | null = null;

  try {
    products = await listCommerceProducts();
  } catch (caught) {
    // Only show the bounded transport error; no credentials or privileged data.
    error = caught instanceof Error ? caught.message : 'Không thể tải danh mục sản phẩm.';
  }

  return (
    <div className="admin-page space-y-5">
      <div className="space-y-2">
        <h1 className="admin-page-title">Danh mục sản phẩm</h1>
        <p className="text-sm text-slate-400">
          Dữ liệu đọc trực tiếp từ Commerce qua kết nối máy chủ có ký HMAC.
          Giai đoạn này chưa hỗ trợ tạo, sửa, xuất bản hoặc thay đổi giá và tồn kho.
        </p>
      </div>
      {error ? (
        <div role="alert" className="admin-card border-amber-900/50 p-5 text-sm text-amber-200">
          {error}
        </div>
      ) : (
        <div className="admin-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800 p-4">
            <h2 className="font-semibold text-slate-100">Sản phẩm trên Commerce</h2>
            <span className="text-xs text-slate-400">{products.length} sản phẩm</span>
          </div>
          {products.length === 0 ? (
            <p className="p-6 text-sm text-slate-400">Chưa có sản phẩm trong danh mục.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[740px] w-full text-left text-sm">
                <thead className="bg-slate-950/50 text-xs text-slate-400">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">Sản phẩm</th>
                    <th scope="col" className="px-4 py-3 font-medium">Loại</th>
                    <th scope="col" className="px-4 py-3 font-medium">Cách phát hành</th>
                    <th scope="col" className="px-4 py-3 font-medium">Trạng thái</th>
                    <th scope="col" className="px-4 py-3 font-medium">Cập nhật</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {products.map((product) => (
                    <tr key={product.id} className="text-slate-200">
                      <td className="px-4 py-4">
                        <div className="font-medium">{product.name}</div>
                        <div className="mt-1 text-xs text-slate-500">{product.slug}</div>
                      </td>
                      <td className="px-4 py-4">{TYPE_LABEL[product.product_type] ?? product.product_type}</td>
                      <td className="px-4 py-4">{RELEASE_LABEL[product.release_type] ?? product.release_type}</td>
                      <td className="px-4 py-4">{STATUS_LABEL[product.status] ?? product.status}</td>
                      <td className="px-4 py-4 text-xs text-slate-400">
                        {Number.isNaN(Date.parse(product.updated_at)) ? 'Không xác định' : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(product.updated_at))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
