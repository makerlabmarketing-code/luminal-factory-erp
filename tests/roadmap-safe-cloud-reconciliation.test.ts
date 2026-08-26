import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const roadmap = readFileSync("docs/ERP_IMPLEMENTATION_ROADMAP.md", "utf8");
const phaseTemplateDecision = readFileSync(
  "docs/phase-template-business-decision.md",
  "utf8",
);
const phaseTemplateSpecification = readFileSync(
  "docs/phase-template-approved-specification.md",
  "utf8",
);
const phaseTemplatePreflightResult = readFileSync(
  "docs/phase-template-schema-preflight-result.md",
  "utf8",
);
const phaseTemplatePreflight = readFileSync(
  "supabase/drafts/20260820_phase_template_schema_preflight.sql",
  "utf8",
);
const operatorHandoff = readFileSync(
  "docs/production-operator-sql-handoff.md",
  "utf8",
);

describe("roadmap Cloud-work reconciliation", () => {
  it("records the merged PR #100 boundary and exact local Attendance handoff", () => {
    expect(roadmap).toContain("## 2026-07-31 post-PR #100 Cloud reconciliation");
    expect(roadmap).toContain("Attendance stale-row cancellation is `READY_FOR_LOCAL_OPERATOR`");
    expect(roadmap).toContain("It did not change\n`supabase/migrations/`");
    expect(roadmap).toContain("Any non-zero\n`total_hours` or `total_salary`");
    expect(roadmap).toContain("run the guarded forward exactly once");
  });

  it("records every roadmap item with one allowed Cloud classification", () => {
    const classificationSection = roadmap.slice(
      roadmap.indexOf("## Cloud execution classification"),
      roadmap.indexOf("## Reconciled roadmap"),
    );
    const classificationRows = classificationSection.match(
      /^\| \d+\. .+ \| `(SAFE_CLOUD_WORK_AVAILABLE|READY_FOR_OPERATOR|BLOCKED_BY_BUSINESS_DECISION|BLOCKED_BY_DEPENDENCY|COMPLETE)` \|/gm,
    );

    expect(classificationRows).toHaveLength(20);
    expect(roadmap).toContain(
      "Items 17 and 18 have no remaining safe Cloud implementation work",
    );
  });

  it("records the approved Phase Template contract and bounded preflight", () => {
    const decisionSection = phaseTemplateDecision.slice(
      phaseTemplateDecision.indexOf("## Exact decisions required from the business owner"),
      phaseTemplateDecision.indexOf("## Exact next action"),
    );
    const decisionQuestions = decisionSection.match(/^\d+\. /gm);

    expect(phaseTemplateDecision).toContain(
      "**Status:** `BUSINESS_CONTRACT_APPROVED`",
    );
    expect(decisionQuestions).toHaveLength(12);
    expect(roadmap).toContain(
      "| 17. Phase Templates | `READY_FOR_OPERATOR` |",
    );
    expect(phaseTemplateSpecification).toContain(
      "**Status:** `PRODUCTION_MIGRATION_PASS / RUNTIME_FLAG_DISABLED`",
    );
    expect(phaseTemplateSpecification).toContain("`PHASE_TEMPLATE_MANAGE`");
    expect(phaseTemplateSpecification).toContain("retained for seven years");
    expect(phaseTemplateSpecification).toContain("launch seed catalog is intentionally empty");
    expect(phaseTemplatePreflight).toContain("begin transaction read only;");
    expect(phaseTemplatePreflight).toContain("rollback;");
    expect(phaseTemplatePreflight).not.toMatch(/\b(insert|update|delete|alter|create|drop|truncate)\b/i);
    expect(phaseTemplatePreflightResult).toContain(
      "**Status:** `PASS_WITH_EXISTING_SECURITY_DEBT_RECORDED`",
    );
    expect(phaseTemplatePreflightResult).toContain("**Mutation count:** 0");
    expect(phaseTemplatePreflightResult).toContain("| Phase Template object collisions | 0");
    expect(roadmap).toContain("PR #177 merged through protected `main` as `0f3fe87`");
    expect(roadmap).toContain("20260821_phase_template_nonproduction_fixture.sql");
    expect(roadmap).toContain("20260821065313_phase_template_release_one.sql");
    expect(roadmap).toContain("phase-template-production-delivery-result.md");
  });

  it("preserves Attendance as operator-only and keeps UI work blocked", () => {
    expect(roadmap).toContain(
      "| 10. Attendance | `READY_FOR_OPERATOR` | Preserve `OPERATOR_PRODUCTION_VERIFICATION_REQUIRED`",
    );
    expect(operatorHandoff).toContain(
      "Attendance remains `OPERATOR_PRODUCTION_VERIFICATION_REQUIRED`",
    );
    expect(roadmap).toContain(
      "| 19. Broad SaaS UI re-skin | `BLOCKED_BY_DEPENDENCY` |",
    );
    expect(roadmap).toContain(
      "| 18. SaaS UI foundation | `COMPLETE` |",
    );
    expect(roadmap).toContain("saas-ui-foundation-result.md");
  });
});

describe("consolidated local operator authorities", () => {
  const currentHandoff = readFileSync(
    "docs/current-operator-handoff.md",
    "utf8",
  );

  it("keeps Attendance and Finance at guarded local-operator boundaries", () => {
    expect(roadmap).toContain("the approved forward committed exactly once, post-run passed, and package-wide validation passed");
    expect(roadmap).toContain("PR #103, `e82b873`");
    expect(currentHandoff).toContain("**stop for explicit\n   mutation approval**");
    expect(currentHandoff).toContain("Exactly one Attendance row");
    expect(currentHandoff).toContain("zero partial persistence");
    expect(currentHandoff).toContain("authenticated-only `EXECUTE`");
    expect(currentHandoff).toContain("do not broaden policies for the function");
  });

  it("preserves disabled flags and the local master prompt guardrails", () => {
    for (const flag of [
      "ATTENDANCE_RECOVERY_ENABLED=false",
      "FINANCE_REIMBURSEMENT_ENABLED=false",
      "PAYROLL_SETTLEMENT_ENABLED=false",
      "EMAIL_DELIVERY_ENABLED=false",
      "FACILITY_ACTIVE_STATE_ENABLED=false",
    ]) {
      expect(currentHandoff).toContain(flag);
    }
    expect(currentHandoff).toContain("## Exact Local Codex CLI Master Prompt");
    expect(currentHandoff).toContain("Never replay a migration already recorded");
    expect(currentHandoff).toContain("Never skip ahead to another mutating package");
    expect(currentHandoff).toContain("rollback boundary and rollback reference");
  });

  it("separates email review, decision, and live-delivery boundaries", () => {
    const emailDecisionPackage = readFileSync(
      "docs/email-history-business-decision-package.md",
      "utf8",
    );

    expect(roadmap).toContain(
      "| Email-history safe UI/read slice | `READY_FOR_PROTECTED_REVIEW` |",
    );
    expect(roadmap).toContain(
      "| Email-history schema/RLS/archive/retry | `BLOCKED_BY_BUSINESS_DECISION` |",
    );
    expect(roadmap).toContain(
      "| ERP transactional email live delivery | `BLOCKED_BY_DEPENDENCY` |",
    );
    expect(emailDecisionPackage.match(/^\| \d+ \|/gm)).toHaveLength(15);
    expect(emailDecisionPackage).toContain(
      "Every recommendation below is **UNAPPROVED**",
    );
  });
});
