# Private reimbursement evidence storage package

- Bucket: `finance-evidence`, private; accepted MIME types JPG, PNG, WEBP, PDF; 10 MiB maximum.
- Object path: `<ledger-id>/<server-generated-uuid>.<extension>`. Never trust a client path or filename.
- Upload/delete: authorized server capability only. Metadata is inserted only after storage upload succeeds; compensate by deleting the object if metadata insertion fails.
- Read: short-lived signed URLs created server-side after `FINANCE_VIEW` or requester/beneficiary ownership verification. Never expose bucket paths or employee payment details in public URLs.
- No hard delete: attachments and metadata use retention/archive handling. Existing `bill_url` remains read-only historical compatibility.
- Runtime currently does not upload files. `FINANCE_REIMBURSEMENT_ENABLED` must remain false until the private bucket, Storage RLS, signed-URL route, and failure cleanup smoke tests pass. The application does not pretend a selected local file was persisted.

## Storage RLS template (operator review required)

```sql
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('finance-evidence','finance-evidence',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
-- No authenticated INSERT/UPDATE/DELETE policy: writes use the reviewed server capability.
-- SELECT is also server-mediated so signed URL authorization can join ledger ownership.
```
