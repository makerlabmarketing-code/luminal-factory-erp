# Ledger/Reimbursement smoke checklist

1. Retain pre-run output and the legacy salary count/hash sample; stop on any failed prerequisite.
2. Deliver only through protected main/Supabase GitHub Integration; run post-run validation.
3. With the runtime flag still false, confirm Staff/Admin endpoints return the Vietnamese unavailable message.
4. After separate activation approval, verify employee A sees only own requester/beneficiary rows and cannot see employee B.
5. Submit once, retry the same idempotency key, and verify exactly one ledger row/history event.
6. Verify executor and beneficiary IDs differ and display independently; a legacy salary row with null beneficiary displays `Chưa xác định` unchanged.
7. Verify unauthorized and self approval/rejection/payment fail; rejection requires a reason.
8. Verify SUBMITTED→APPROVED→PAID, actor/time are server-derived, repeated payment key does not duplicate, and history cannot update/delete.
9. Verify employee cannot edit APPROVED/PAID and no role can hard-delete ledger/history.
10. Verify existing `bill_url` renders. Do not test upload until private bucket/RLS/signed URL package is separately approved.
11. Verify storage errors return Vietnamese safe messages without bucket paths/raw database errors.
12. Verify a payroll-origin ledger link retains immutable `source_type` + `source_reference` and does not mutate the payroll snapshot.
13. Verify targeted list refresh does not reload unrelated Staff Portal data.
