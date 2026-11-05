import React, {createElement, type ReactNode} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {afterEach, expect, it, vi} from 'vitest';
vi.mock('@/lib/payroll-ledger-link',()=>import('../lib/payroll-ledger-link'));
vi.mock('@/lib/salary-payment',()=>import('../lib/salary-payment'));
vi.mock('@/component/data-table/CommonTable',()=>({
 CommonTable:({children}:{children:ReactNode})=>createElement('table',null,children),
 TableRowActions:({renderActions}:{renderActions:()=>ReactNode})=>createElement('div',null,renderActions()),
}));
import LedgerTable from '../app/admin/capital/components/LedgerTable';
afterEach(()=>vi.unstubAllGlobals());
const reference='11111111-1111-4111-8111-111111111111';
function render(amount:number,cancelled_at:string|null=null){
 vi.stubGlobal('React',React);
 const noop=()=>{};
 return renderToStaticMarkup(createElement(LedgerTable,{data:[{id:1,type:'CHI_PHI',category:'Lương',amount,source_type:'PAYROLL',source_reference:reference,idempotency_key:`payroll-ledger:${reference}`,cancelled_at}],salaryMailEnabled:true,activityEnabled:true,canUpdate:true,canManageTestRecords:false,onRetrySalaryEmail:noop,onTestArchive:noop,onHistory:noop,onTogglePaid:noop,onOpenEdit:noop,onGenerateQr:noop,reimbursementCapabilities:{currentEmployeeId:'1',canApprove:true,canPay:true},activeReimbursementActionId:null,onTransitionReimbursement:noop}));
}
it('renders a zero obligation without debt label, payment, QR or manual edit',()=>{
 const html=render(0);expect(html).toContain('Không phát sinh thanh toán');expect(html).not.toContain('Treo nợ');expect(html).not.toContain('Mã QR');expect(html).not.toContain('Chỉnh sửa');
});
it('renders positive linked payroll as unpaid with QR and no manual edit',()=>{
 const html=render(100);expect(html).toContain('Chưa trả');expect(html).toContain('Mã QR');expect(html).not.toContain('Chỉnh sửa');
});
it('keeps replaced payroll visible as history, without restoring or paying it',()=>{
 const html=render(100,'2026-11-05T00:00:00Z');expect(html).toContain('Đã thay thế');expect(html).not.toContain('Khôi phục');expect(html).not.toContain('Mã QR');
});
