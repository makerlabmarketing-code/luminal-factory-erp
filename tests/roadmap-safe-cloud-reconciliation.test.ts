import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const roadmap = readFileSync("docs/ERP_IMPLEMENTATION_ROADMAP.md", "utf8");
const phaseTemplateDecision = readFileSync(
  "docs/phase-template-business-decision.md",
  "utf8",
);
const operatorHandoff = readFileSync(
  "docs/production-operator-sql-handoff.md",
  "utf8",
);

describe("roadmap Cloud-work reconciliation", () => {
  it("records every roadmap item with one allowed Cloud classification", () => {
    const classificationSection = roadmap.slice(
      roadmap.indexOf("## Cloud execution classification"),
      roadmap.indexOf("## Reconciled roadmap"),
    );
    const classificationRows = classificationSection.match(
      /^\| \d+\. .+ \| `(SAFE_CLOUD_WORK_AVAILABLE|READY_FOR_OPERATOR|BLOCKED_BY_BUSINESS_DECISION|BLOCKED_BY_DEPENDENCY|COMPLETE)` \|/gm,
    );

    expect(classificationRows).toHaveLength(20);
    expect(roadmap).toContain("No item is currently `SAFE_CLOUD_WORK_AVAILABLE`");
  });

  it("preserves the Phase Template decision gate and twelve questions", () => {
    const decisionQuestions = phaseTemplateDecision.match(/^\d+\. /gm);

    expect(phaseTemplateDecision).toContain(
      "**Status:** `BLOCKED_BY_BUSINESS_DECISION`",
    );
    expect(decisionQuestions).toHaveLength(12);
    expect(roadmap).toContain(
      "| 17. Phase Templates | `BLOCKED_BY_BUSINESS_DECISION` |",
    );
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
  });
});
