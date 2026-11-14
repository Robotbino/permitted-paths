// The entry of the bundle that the course page loads (js/data/studio-domain.js).
// The page runs the SAME functions as the application: the plan, the import pipeline, the export.
// examples/tools/sync-studio.py makes the bundle from this file. Do not import server code here.
export * as planning from '../personal-finance/shared/planning/plan.ts';
export * as cycle from '../personal-finance/shared/planning/pay-cycle.ts';
export * as insights from '../personal-finance/shared/planning/insights.ts';
export { example as planExample } from '../personal-finance/shared/planning/plan-example.ts';
export * as pipeline from '../personal-finance/shared/pipeline/index.ts';
export * as samples from '../personal-finance/shared/pipeline/samples.ts';
export * as exporter from '../personal-finance/shared/export/paste-rows.ts';
export { formatMoney, parseAmount } from '../personal-finance/shared/money.ts';
