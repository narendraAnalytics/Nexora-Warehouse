import uuid

from fastapi import APIRouter, HTTPException, Request
from langchain_core.messages import HumanMessage

from schemas.orchestrator import (
    ApprovalActionRequest,
    ApprovalActionResponse,
    OrchestratorRunRequest,
    OrchestratorRunResponse,
    PendingApprovalItem,
)

router = APIRouter()


@router.post("/run", response_model=OrchestratorRunResponse, tags=["Orchestrator"])
async def orchestrator_run(body: OrchestratorRunRequest, request: Request):
    """Run the Nexora Orchestrator with a natural language task.

    The orchestrator routes the task to the appropriate domain agents,
    collects their outputs, and handles HITL approval gates automatically.

    - If the task completes without requiring approval → status: "completed"
    - If an action requires manager approval (e.g. PO creation, transfer) →
      status: "awaiting_approval" with an approval_id for POST /orchestrator/approve/{id}

    Provide thread_id to resume a previously interrupted workflow.
    """
    graph = request.app.state.orchestrator_graph
    memory = request.app.state.memory

    thread_id = body.thread_id or str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}

    initial_state = {
        "messages": [HumanMessage(content=body.task)],
        "task": body.task,
        "warehouse_id": body.warehouse_id,
        "target_agents": [],
        "agent_outputs": {},
        "approval_type": None,
        "approval_id": None,
        "thread_id": thread_id,
    }

    try:
        await graph.ainvoke(initial_state, config=config)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Check if the graph paused (interrupt_before=["post_approval"])
    state_snapshot = await graph.aget_state(config)
    is_paused = bool(state_snapshot.next)

    # Pull last message and agent metadata from saved state
    saved = state_snapshot.values
    last_message = ""
    if saved.get("messages"):
        last_message = saved["messages"][-1].content

    agents_invoked = saved.get("target_agents", [])
    approval_id = saved.get("approval_id")
    approval_type = saved.get("approval_type")

    if is_paused and approval_id:
        return OrchestratorRunResponse(
            thread_id=thread_id,
            status="awaiting_approval",
            response=last_message,
            agents_invoked=agents_invoked,
            approval_id=approval_id,
            approval_type=approval_type,
        )

    return OrchestratorRunResponse(
        thread_id=thread_id,
        status="completed",
        response=last_message,
        agents_invoked=agents_invoked,
    )


@router.post(
    "/approve/{approval_id}",
    response_model=ApprovalActionResponse,
    tags=["Orchestrator"],
)
async def orchestrator_approve(
    approval_id: str,
    body: ApprovalActionRequest,
    request: Request,
):
    """Approve or reject a pending HITL action and resume the orchestrator workflow.

    After a manager approves/rejects, the paused orchestrator graph resumes:
    - approved → post_approval node runs, sends confirmation, marks complete
    - rejected → post_approval notes rejection, workflow ends

    The thread_id is stored in the approval payload from when it was created.
    """
    memory = request.app.state.memory
    graph = request.app.state.orchestrator_graph

    record = await memory.get_approval(approval_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Approval {approval_id} not found")
    if record.get("status") != "pending":
        raise HTTPException(
            status_code=409,
            detail=f"Approval {approval_id} already resolved: {record.get('status')}",
        )

    # Resolve in Redis
    resolved = await memory.resolve_approval(approval_id, body.action, body.resolved_by)
    thread_id = record.get("payload", {}).get("thread_id", "")

    resumed = False
    if thread_id:
        config = {"configurable": {"thread_id": thread_id}}
        try:
            await graph.ainvoke(None, config=config)
            resumed = True
        except Exception:
            resumed = False

    return ApprovalActionResponse(
        approval_id=approval_id,
        status=body.action,
        thread_id=thread_id,
        resumed=resumed,
    )


@router.get("/pending", response_model=list[PendingApprovalItem], tags=["Orchestrator"])
async def list_pending_approvals(request: Request):
    """List all pending HITL approval requests across all orchestrator workflows."""
    memory = request.app.state.memory
    try:
        pending = await memory.list_pending_approvals()
        return [
            PendingApprovalItem(
                approval_id=r["approval_id"],
                approval_type=r["approval_type"],
                created_at=r["created_at"],
                payload=r.get("payload", {}),
            )
            for r in pending
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
