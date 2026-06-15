import json
import re

from fastapi import APIRouter, HTTPException, Query, Request
from langchain_core.messages import HumanMessage

from schemas.ceo import CEOBriefingRequest, CEOBriefingResponse, ExecutiveDecision

router = APIRouter()


@router.post("/briefing", response_model=CEOBriefingResponse, tags=["CEO"])
async def generate_briefing(body: CEOBriefingRequest, request: Request):
    """Generate an executive CEO briefing on demand.

    The CEO agent aggregates KPIs, risk summary, and operations pulse from all
    domains, synthesises a structured briefing, and logs it to executive_decisions.
    """
    graph = request.app.state.ceo_graph
    pool = request.app.state.pool

    task = (
        f"Generate a {body.briefing_type.replace('_', ' ')} executive briefing for Nexora. "
        + (f"Scope to warehouse_id={body.warehouse_id}." if body.warehouse_id else "Cover all branches.")
    )

    initial_state = {
        "messages": [HumanMessage(content=task)],
        "briefing_type": body.briefing_type,
        "warehouse_id": body.warehouse_id,
    }

    try:
        result = await graph.ainvoke(initial_state)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    briefing_text = result["messages"][-1].content

    # Extract decision_id from the log_executive_decision tool output if present
    decision_id = None
    for msg in reversed(result["messages"]):
        content = getattr(msg, "content", "") or ""
        if isinstance(content, list):
            for block in content:
                if isinstance(block, dict) and block.get("decision_id"):
                    decision_id = block["decision_id"]
                    break
        elif isinstance(content, str):
            match = re.search(r'"decision_id"\s*:\s*"([^"]+)"', content)
            if match:
                decision_id = match.group(1)
                break
        if decision_id:
            break

    return CEOBriefingResponse(
        briefing=briefing_text,
        decision_id=decision_id,
        briefing_type=body.briefing_type,
        warehouse_id=body.warehouse_id,
    )


@router.get("/decisions", response_model=list[ExecutiveDecision], tags=["CEO"])
async def list_decisions(
    request: Request,
    limit: int = Query(default=10, ge=1, le=100),
):
    """List recent executive decisions logged by the CEO agent."""
    pool = request.app.state.pool
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT
                    id::text,
                    decision_type,
                    title,
                    summary,
                    recommendations,
                    priority,
                    status,
                    briefing_date::text,
                    created_at::text
                FROM executive_decisions
                ORDER BY created_at DESC
                LIMIT $1
            """, limit)

        return [
            ExecutiveDecision(
                id=r["id"],
                decision_type=r["decision_type"],
                title=r["title"],
                summary=r["summary"],
                recommendations=json.loads(r["recommendations"]) if r["recommendations"] else None,
                priority=r["priority"],
                status=r["status"],
                briefing_date=r["briefing_date"],
                created_at=r["created_at"],
            )
            for r in rows
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
