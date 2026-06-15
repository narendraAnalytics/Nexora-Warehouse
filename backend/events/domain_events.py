"""
Nexora domain event handlers — triggered by operational events:
  inventory/low, order/created, supplier/delay, warehouse/transfer, finance/updated
"""
import inngest
from langchain_core.messages import HumanMessage

from events.inngest_client import inngest_client
from memory.redis_manager import RedisMemoryManager


def create_domain_functions(pool, agent_graphs: dict, memory: RedisMemoryManager) -> list:
    """Return list of Inngest Function objects for all domain events."""

    # ── inventory/low ────────────────────────────────────────────────────────────

    @inngest_client.create_function(
        fn_id="inventory-low-handler",
        trigger=inngest.TriggerEvent("inventory/low"),
        retries=2,
    )
    async def handle_inventory_low(ctx: inngest.Context, step: inngest.Step) -> dict:
        """Triggered when stock falls below reorder threshold.

        event.data: { warehouse_id, product_id, product_name, current_qty, reorder_point }
        """
        data = ctx.event.data or {}
        warehouse_id = data.get("warehouse_id", "")
        product_name = data.get("product_name", "unknown product")

        task = (
            f"Analyse current stock levels for {product_name} in warehouse {warehouse_id}. "
            f"Current quantity is {data.get('current_qty', 0)}, reorder point is "
            f"{data.get('reorder_point', 0)}. Identify reorder candidates and flag alerts."
        )

        async def run_inventory():
            graph = agent_graphs.get("inventory")
            if not graph:
                return "inventory agent not available"
            result = await graph.ainvoke({
                "messages": [HumanMessage(content=task)],
                "warehouse_id": warehouse_id or None,
            })
            return result["messages"][-1].content

        inventory_output = await step.run("inventory-analysis", run_inventory)

        async def run_procurement():
            graph = agent_graphs.get("procurement")
            if not graph:
                return "procurement agent not available"
            procurement_task = (
                f"Based on low stock alert for {product_name} in warehouse {warehouse_id}, "
                f"check reorder candidates and create draft POs for items below reorder point. "
                f"Context from inventory analysis: {inventory_output[:500]}"
            )
            result = await graph.ainvoke({
                "messages": [HumanMessage(content=procurement_task)],
                "warehouse_id": warehouse_id or None,
            })
            return result["messages"][-1].content

        procurement_output = await step.run("procurement-action", run_procurement)

        return {
            "event": "inventory/low",
            "warehouse_id": warehouse_id,
            "product": product_name,
            "inventory_summary": inventory_output[:300],
            "procurement_summary": procurement_output[:300],
        }

    # ── order/created ────────────────────────────────────────────────────────────

    @inngest_client.create_function(
        fn_id="order-created-handler",
        trigger=inngest.TriggerEvent("order/created"),
        retries=2,
    )
    async def handle_order_created(ctx: inngest.Context, step: inngest.Step) -> dict:
        """Triggered when a new customer order is placed.

        event.data: { order_id, order_number, warehouse_id, customer_name, total_amount }
        """
        data = ctx.event.data or {}
        order_number = data.get("order_number", "unknown")
        warehouse_id = data.get("warehouse_id", "")
        customer_name = data.get("customer_name", "customer")

        task = (
            f"New order {order_number} received from {customer_name}. "
            f"Check order pipeline for warehouse {warehouse_id}, identify if this order "
            f"is at risk of delay and take any required actions."
        )

        async def run_fulfillment():
            graph = agent_graphs.get("order_fulfillment")
            if not graph:
                return "order_fulfillment agent not available"
            result = await graph.ainvoke({
                "messages": [HumanMessage(content=task)],
                "warehouse_id": warehouse_id or None,
            })
            return result["messages"][-1].content

        fulfillment_output = await step.run("order-fulfillment", run_fulfillment)

        return {
            "event": "order/created",
            "order_number": order_number,
            "warehouse_id": warehouse_id,
            "fulfillment_summary": fulfillment_output[:300],
        }

    # ── supplier/delay ───────────────────────────────────────────────────────────

    @inngest_client.create_function(
        fn_id="supplier-delay-handler",
        trigger=inngest.TriggerEvent("supplier/delay"),
        retries=2,
    )
    async def handle_supplier_delay(ctx: inngest.Context, step: inngest.Step) -> dict:
        """Triggered when a supplier reports or is predicted to delay.

        event.data: { supplier_id, supplier_name, po_number, delay_days, warehouse_id }
        """
        data = ctx.event.data or {}
        supplier_name = data.get("supplier_name", "unknown supplier")
        po_number = data.get("po_number", "")
        delay_days = data.get("delay_days", 0)

        risk_task = (
            f"Supplier {supplier_name} has reported a delay of {delay_days} days on PO {po_number}. "
            f"Assess supplier risk score, find alternative suppliers, and review all overdue POs."
        )

        async def run_risk():
            graph = agent_graphs.get("supplier_risk")
            if not graph:
                return "supplier_risk agent not available"
            result = await graph.ainvoke({
                "messages": [HumanMessage(content=risk_task)],
            })
            return result["messages"][-1].content

        risk_output = await step.run("risk-assessment", run_risk)

        async def run_procurement_replan():
            graph = agent_graphs.get("procurement")
            if not graph:
                return "procurement agent not available"
            procurement_task = (
                f"Supplier {supplier_name} delayed PO {po_number} by {delay_days} days. "
                f"Identify any items from this supplier below reorder point and create "
                f"alternative draft POs from backup suppliers if needed. "
                f"Risk context: {risk_output[:400]}"
            )
            result = await graph.ainvoke({
                "messages": [HumanMessage(content=procurement_task)],
            })
            return result["messages"][-1].content

        procurement_output = await step.run("procurement-replan", run_procurement_replan)

        return {
            "event": "supplier/delay",
            "supplier": supplier_name,
            "po_number": po_number,
            "delay_days": delay_days,
            "risk_summary": risk_output[:300],
            "procurement_summary": procurement_output[:300],
        }

    # ── warehouse/transfer ───────────────────────────────────────────────────────

    @inngest_client.create_function(
        fn_id="warehouse-transfer-handler",
        trigger=inngest.TriggerEvent("warehouse/transfer"),
        retries=2,
    )
    async def handle_warehouse_transfer(ctx: inngest.Context, step: inngest.Step) -> dict:
        """Triggered when a stock transfer is approved or needed.

        event.data: { from_warehouse_id, to_warehouse_id, product_id, trigger, category }
        """
        data = ctx.event.data or {}
        category = data.get("category", "")
        trigger_reason = data.get("trigger", "rebalancing needed")

        transfer_task = (
            f"Stock transfer triggered: {trigger_reason}. "
            + (f"Category: {category}. " if category else "")
            + "Review warehouse inventory imbalances and recommend optimal transfers."
        )

        async def run_transfer():
            graph = agent_graphs.get("warehouse_transfer")
            if not graph:
                return "warehouse_transfer agent not available"
            result = await graph.ainvoke({
                "messages": [HumanMessage(content=transfer_task)],
            })
            return result["messages"][-1].content

        transfer_output = await step.run("transfer-plan", run_transfer)

        async def run_dispatch():
            graph = agent_graphs.get("logistics")
            if not graph:
                return "logistics agent not available"
            dispatch_task = (
                f"Following transfer plan, check dispatch queue and schedule any pending "
                f"inter-branch shipments. Transfer context: {transfer_output[:400]}"
            )
            result = await graph.ainvoke({
                "messages": [HumanMessage(content=dispatch_task)],
            })
            return result["messages"][-1].content

        dispatch_output = await step.run("dispatch-plan", run_dispatch)

        return {
            "event": "warehouse/transfer",
            "trigger": trigger_reason,
            "transfer_summary": transfer_output[:300],
            "dispatch_summary": dispatch_output[:300],
        }

    # ── finance/updated ──────────────────────────────────────────────────────────

    @inngest_client.create_function(
        fn_id="finance-updated-handler",
        trigger=inngest.TriggerEvent("finance/updated"),
        retries=2,
    )
    async def handle_finance_updated(ctx: inngest.Context, step: inngest.Step) -> dict:
        """Triggered when revenue or cost data is updated.

        event.data: { warehouse_id, record_type, amount, category }
        """
        data = ctx.event.data or {}
        warehouse_id = data.get("warehouse_id")
        record_type = data.get("record_type", "finance record")
        amount = data.get("amount", 0)

        finance_task = (
            f"Finance record updated: {record_type} of ₹{amount:,.0f}. "
            + (f"Warehouse: {warehouse_id}. " if warehouse_id else "")
            + "Run full financial analysis: dashboard, revenue, cash flow, margins."
        )

        async def run_finance():
            graph = agent_graphs.get("finance")
            if not graph:
                return "finance agent not available"
            result = await graph.ainvoke({
                "messages": [HumanMessage(content=finance_task)],
                "warehouse_id": warehouse_id,
            })
            return result["messages"][-1].content

        finance_output = await step.run("finance-analysis", run_finance)

        async def run_ceo_update():
            graph = agent_graphs.get("ceo")
            if not graph:
                return "ceo agent not available"
            ceo_task = (
                f"Finance data updated. Generate a quick executive financial health update. "
                f"Finance context: {finance_output[:500]}"
            )
            result = await graph.ainvoke({
                "messages": [HumanMessage(content=ceo_task)],
                "briefing_type": "on_demand",
                "warehouse_id": warehouse_id,
            })
            return result["messages"][-1].content

        ceo_output = await step.run("ceo-update", run_ceo_update)

        return {
            "event": "finance/updated",
            "record_type": record_type,
            "finance_summary": finance_output[:300],
            "ceo_summary": ceo_output[:300],
        }

    return [
        handle_inventory_low,
        handle_order_created,
        handle_supplier_delay,
        handle_warehouse_transfer,
        handle_finance_updated,
    ]
