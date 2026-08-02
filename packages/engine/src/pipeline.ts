import { evaluate } from "./evaluate";
import { explain } from "./explain";
import { selectPartners } from "./partners";
import type { FinderRequest, DecisionReport } from "./contracts";
import type { NormalizedKB } from "@mydogcanfly/knowledge";

/**
 * Business orchestration of the full pipeline (stays in the engine, never in the Worker):
 * Decision Engine → Explanation Engine → contextual partners → Decision Report.
 */
export function runFinder(kb: NormalizedKB, req: FinderRequest): DecisionReport {
  const report = explain(evaluate(kb, req), req.locale);
  report.partners = selectPartners(kb, req, report, req.locale);
  return report;
}
