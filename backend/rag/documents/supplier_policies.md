# Nexora Supplier Policies and SLA Terms

## Supplier Scoring

Each supplier is scored on two dimensions (scale 1–10):
- **risk_score**: Higher = riskier. Factors: delay history, financial stability, single-source dependency.
- **reliability_score**: Higher = more reliable. Factors: on-time delivery %, quality returns rate, communication responsiveness.

Suppliers with risk_score > 7.0 are flagged by the Supplier Risk Agent for review. Suppliers with reliability_score < 4.0 are placed on a watchlist and alternative suppliers are recommended.

## Payment Terms

| Term | Description |
|---|---|
| NET30 | Payment due 30 days after invoice |
| NET15 | Payment due 15 days after invoice |
| COD | Cash on delivery — high-risk suppliers only |
| ADVANCE | 30% advance, 70% on delivery |

Default term: NET30. Suppliers on watchlist default to COD or ADVANCE.

## Lead Time SLA

Standard lead time: 7 days from PO confirmation to warehouse delivery.

If a supplier's avg_lead_days exceeds 14 days, the Procurement Agent must flag this and recommend a secondary supplier for that product category.

Supplier delay alert: triggered if actual delivery date exceeds expected_date by more than 2 business days. Supplier Risk Agent sends automated alert and logs the incident.

## PO Submission Rules

1. Verify supplier is active (is_active = TRUE) before issuing PO.
2. PO must reference a specific warehouse_id (receiving branch).
3. ai_reasoning field must be populated with the agent's justification.
4. Supplier must confirm PO within 24 hours, else Procurement Agent escalates.

## Supplier Replacement Protocol

If a supplier fails to confirm within 48 hours or has 3+ consecutive delays:
1. Supplier Risk Agent raises a HIGH severity alert.
2. Procurement Agent identifies top 2 alternative suppliers (same category, lower risk_score).
3. Alternatives presented to Operations Manager for decision.
4. CEO Agent is notified if the affected product is a top-seller (>100 units/month).

## Supplier Categories

Suppliers are tagged with the product categories they supply (e.g., ["tvs", "mobiles"]). The Procurement Agent uses this for matching during PO creation.
