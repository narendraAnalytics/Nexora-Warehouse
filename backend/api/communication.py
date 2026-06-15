from fastapi import APIRouter, HTTPException, Request
from langchain_core.messages import HumanMessage

from schemas.communication import CommunicationRequest, CommunicationResponse

router = APIRouter()


@router.post("/send", response_model=CommunicationResponse, tags=["Communication"])
async def communication_send(body: CommunicationRequest, request: Request):
    """Send an email via the Communication Agent.

    Provide a natural language instruction describing what to send and to whom.
    The agent selects the appropriate email type (alert, escalation, or executive report),
    composes the message, and sends it via Resend.

    Example: "Send a stockout alert to ops@nexora.com — TVs at Hyderabad are below reorder point (12 units left, reorder at 50)"
    """
    graph = request.app.state.communication_graph
    try:
        result = await graph.ainvoke({
            "messages": [HumanMessage(content=body.instruction)],
        })
        return CommunicationResponse(response=result["messages"][-1].content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
