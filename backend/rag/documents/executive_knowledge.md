# Nexora Executive Knowledge Base

## KPI Benchmarks

| KPI | Target | Alert Threshold |
|---|---|---|
| Stockout Rate | < 2% of SKUs | > 5% triggers CEO alert |
| Order Fulfillment Rate | > 95% on-time | < 90% triggers review |
| Procurement Cycle Time | < 5 days PO-to-delivery | > 10 days = risk flag |
| Supplier On-Time Rate | > 90% | < 80% = supplier review |
| Inventory Turnover | > 6x per year | < 4x = overstock risk |
| Gross Margin | > 18% | < 14% = cost review |
| Cash Collection Days | < 30 days | > 45 days = finance alert |

## CEO Morning Briefing Format

The CEO Agent generates a daily briefing at 8:00 AM IST containing:
1. Revenue yesterday vs. daily target (INR)
2. Top 5 stockout risk SKUs with reorder status
3. Pending high-value POs awaiting approval (>INR 2L)
4. Supplier delays in last 24 hours
5. Cash flow status: receivables vs. payables
6. Top 3 recommended actions with priority (HIGH/MEDIUM/LOW)

## Historical Decision Patterns

### Demand Surge Protocol
When a product category shows >30% week-over-week demand increase, the standard response is:
- Immediate reorder at 150% of normal reorder_qty
- Alert all branches in the relevant zone
- Lock unit_price for 7 days to prevent margin erosion

### Supplier Consolidation Decision
In Q3 2024, Nexora reduced supplier count from 18 to 12 by consolidating to top performers (reliability_score > 7). Result: 22% reduction in procurement cycle time, 8% cost savings.

### Peak Season Preparation
Festival seasons (Diwali, New Year) require pre-stocking 45 days in advance. Inventory targets increase to 150% of max_stock for TVs, Mobiles, and Gaming categories.

## Risk Intelligence Thresholds

| Risk Type | Medium | High | Critical |
|---|---|---|---|
| Stockout probability | 20–40% | 40–70% | > 70% |
| Supplier delay | 1–3 days | 3–7 days | > 7 days |
| Cash flow gap | INR 5–15L | INR 15–50L | > INR 50L |
| Order backlog | 10–25 orders | 25–50 orders | > 50 orders |

## Executive Decision Archive

All CEO Agent decisions are stored in `executive_decisions` with:
- decision_type: `reorder_override`, `supplier_replacement`, `transfer_approval`, `budget_adjustment`
- recommendations, kpis_snapshot, risk_flags (all JSONB)
- Status lifecycle: pending → actioned / dismissed

Decisions with outcomes feed back into the Demand Forecast Agent for model improvement.

## Nexora Business Goals 2025

1. Reduce stockouts by 30–35% using AI-driven reorder predictions
2. Cut procurement cycle from 10 days → 5 days via automated PO workflows
3. Achieve 95%+ on-time delivery rate across all 5 branches
4. Generate automated CEO briefings eliminating 2 hours/day of manual reporting
5. Expand to 3 additional cities (Kolkata, Delhi, Ahmedabad) by end of 2025
