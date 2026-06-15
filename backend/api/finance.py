from fastapi import APIRouter, HTTPException, Request
from langchain_core.messages import HumanMessage

from schemas.finance import FinanceQueryRequest, FinanceQueryResponse

router = APIRouter()


@router.post("/query", response_model=FinanceQueryResponse, tags=["Finance"])
async def finance_query(body: FinanceQueryRequest, request: Request):
    """Invoke the Finance & Profitability Agent with a natural language query.

    Optionally scope to a single warehouse by providing warehouse_id.
    The agent runs a full analysis: dashboard → revenue → cash flow → margin tracking.
    """
    graph = request.app.state.finance_graph
    try:
        result = await graph.ainvoke({
            "messages": [HumanMessage(content=body.query)],
            "warehouse_id": body.warehouse_id,
        })
        return FinanceQueryResponse(
            response=result["messages"][-1].content,
            warehouse_id=body.warehouse_id,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
