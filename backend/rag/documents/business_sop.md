# Nexora Business SOPs and Operational Policies

## Inventory Reorder Policy

Stock reorder is triggered automatically when quantity falls below the reorder_point for a product at any warehouse. The Inventory Intelligence Agent monitors this threshold every 4 hours.

Reorder quantity is calculated as: `reorder_qty = max_stock - current_quantity`. Agents must raise a Purchase Order draft when reorder is triggered. POs above INR 2,00,000 require manager approval before submission to suppliers.

Emergency reorder (critical stockout): Agent may issue urgent PO up to INR 50,000 without prior approval, flagged with priority=critical.

## Stock Transfer Policy

Cross-warehouse transfers are initiated when one branch has excess stock (>120% of max_stock) and another branch has stock below reorder_point for the same product.

Transfer approval threshold: transfers involving >500 units or valued above INR 1,00,000 require Operations Manager approval via HITL gate.

Transfer lead time SLA: 24–48 hours for intercity transfers within the same state, 48–72 hours for cross-state transfers.

## Order Fulfillment SLA

| Priority | Dispatch Target | Delivery Target |
|---|---|---|
| Critical | 2 hours | Same day |
| High | 4 hours | Next day |
| Normal | 24 hours | 2–3 business days |

Orders not dispatched within SLA trigger automatic escalation to the Operations Agent.

## Agent Decision Audit

All agent decisions must be logged in the `agent_logs` table with:
- agent_name, action, input_summary, output_summary
- decision (JSONB), confidence score
- reference_id and reference_type (order/po/transfer)

Decisions with confidence < 0.6 are flagged for human review.

## Branch Operating Hours

All 5 branches (Hyderabad, Bangalore, Chennai, Mumbai, Pune) operate Monday–Saturday, 9:00 AM – 6:00 PM IST. Emergency dispatch available 24/7 for critical priority orders.

## Product Categories

Nexora handles 5 electronics categories:
1. TVs and Display Systems
2. Mobiles and Tablets
3. Gaming Consoles and Accessories
4. Networking Equipment (Routers, Switches, Access Points)
5. Accessories and Peripherals (Cables, Chargers, Bags)

High-value items (unit price > INR 25,000): require additional verification before dispatch.
