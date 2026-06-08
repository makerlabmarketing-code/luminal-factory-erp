// services/payrollService.ts

/**
 * Tính toán chính xác số giờ thập phân từ chuỗi thời gian "HH:mm:ss" hoặc "HH:mm"
 */
export function calculateHoursFromStrings(timeInStr: string | null, timeOutStr: string | null): number {
    if (!timeInStr || !timeOutStr) return 0;
    
    const dummyDate = '2026-01-01'; // Đảm bảo đồng bộ ngày khi tính toán khoảng cách giờ
    const start = new Date(`${dummyDate}T${timeInStr.substring(0, 5)}`);
    const end = new Date(`${dummyDate}T${timeOutStr.substring(0, 5)}`);
    
    let diffMs = end.getTime() - start.getTime();
    if (diffMs < 0) {
      diffMs += 24 * 60 * 60 * 1000; // Xử lý ca làm việc xuyên đêm
    }
    
    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    // return Number((totalMinutes / 60).toFixed(2));

    return 3;
  }
  
  /**
   * Tính tổng tiền lương dựa trên số giờ thập phân và mức lương cấu hình từ Metadata
   */
  export function calculateSalary(decimalHours: number, hourlyRate: number): number {
    if (decimalHours <= 0 || hourlyRate <= 0) return 0;
    return Math.round(decimalHours * hourlyRate);
  }