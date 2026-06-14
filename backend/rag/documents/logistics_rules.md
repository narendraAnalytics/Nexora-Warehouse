# Nexora Logistics and Dispatch Rules

## Branch Delivery Zones

| Branch | Primary Zone | Secondary Zone |
|---|---|---|
| Hyderabad | Telangana, AP | Karnataka (Bellary, Kurnool) |
| Bangalore | Karnataka | Tamil Nadu (Chennai border), Goa |
| Chennai | Tamil Nadu | Pondicherry, Andhra (Nellore) |
| Mumbai | Maharashtra, Goa | Gujarat (Surat, Vadodara) |
| Pune | Maharashtra (West) | MP (Nashik, Aurangabad region) |

Inter-zone delivery: always routed through the nearest branch. The Logistics Agent selects the dispatching warehouse based on zone matching and stock availability.

## Vehicle Assignment Policy

| Order Size | Vehicle Type | Max Load |
|---|---|---|
| < 50 kg | Two-wheeler / Auto | 50 kg |
| 50–500 kg | Mini Truck (Tata Ace) | 750 kg |
| 500–2000 kg | Light Commercial Vehicle | 2500 kg |
| > 2000 kg | Full Truck | 10,000 kg |

Vehicle availability is tracked in the `deliveries` table via vehicle_number. The Logistics Agent checks current active deliveries before assigning.

## Dispatch Workflow

1. Order status transitions to `dispatching` when vehicle is assigned.
2. `deliveries` record created with vehicle_number, driver_name, driver_phone, route, estimated_eta.
3. Driver confirmation required within 30 minutes of dispatch instruction.
4. If no confirmation: escalate to Operations Agent, reassign vehicle.

## Estimated ETA Calculation

- Intra-city: 4–6 hours
- Intra-state (same zone): 24 hours
- Inter-state: 48–72 hours
- Priority Critical: add 50% speed buffer (ETA reduced by 30%)

## Route Optimization Rules

The Logistics Agent batches orders going to the same zone within a 2-hour window. A batch of 3+ orders to the same city triggers route optimization using the Logistics Agent's routing tool.

## Delivery Confirmation SLA

Delivery must be confirmed (status = `delivered`, delivered_at populated) within 2 hours of estimated_eta. Overdue deliveries trigger a MEDIUM severity alert. If overdue by > 4 hours: HIGH severity alert sent to Operations Manager.

## Return and Reverse Logistics

Returns accepted within 7 days of delivery for electronics defects. Return pickup routed through the nearest branch. Finance Agent records the return as a negative finance_record (record_type = `return`).
