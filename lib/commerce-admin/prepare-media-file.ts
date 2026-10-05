import { MEDIA_MAX_BYTES } from './media-input';
export async function prepareMediaFile(file: File) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size === 0 || file.size > 20 * 1024 * 1024) throw new Error('Chọn ảnh JPG, PNG hoặc WebP, tối đa 20 MiB mỗi tệp.');
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 40_000_000) throw new Error('Ảnh quá lớn. Hãy giảm kích thước trước khi tải.');
    const scale = Math.min(1,2048 / Math.max(bitmap.width,bitmap.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1,Math.round(bitmap.width * scale)); canvas.height = Math.max(1,Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d'); if (!context) throw new Error('Không thể xử lý ảnh trên trình duyệt này.');
    context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const blob = await new Promise<Blob>((resolve,reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Không thể tối ưu ảnh.')),'image/webp',0.86));
    if (blob.type !== 'image/webp' || blob.size > MEDIA_MAX_BYTES) throw new Error('Ảnh sau tối ưu vượt 2 MiB. Hãy giảm kích thước hoặc dung lượng.');
    return { blob, width:canvas.width,height:canvas.height,fileName:file.name.replace(/[\\/]/g,'_').slice(0,180) || 'photo.webp' };
  } finally { bitmap.close(); }
}
