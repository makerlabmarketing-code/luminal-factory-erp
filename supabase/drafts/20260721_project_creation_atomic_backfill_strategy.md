# Corrective Slice 3A backfill strategy (draft only)

No automatic backfill should run with the application slice. If `project_code` is added, generate missing codes from approved business records only after an operator reviews duplicates and reserved codes. Do not derive task assignees from names; unresolved assignees must remain null until a project member is selected.
