from pydantic import BaseModel, Field


class OrchestratorRunRequest(BaseModel):
    task: str = Field(..., min_length=10, description="Natural language task for the orchestrator")
    warehouse_id: str | None = Field(None, description="Optional warehouse UUID to scope the task")
    thread_id: str | None = Field(None, description="Resume an existing thread (omit to start new)")


class OrchestratorRunResponse(BaseModel):
    thread_id: str
    status: str                    # "completed" | "awaiting_approval"
    response: str
    agents_invoked: list[str] = []
    approval_id: str | None = None
    approval_type: str | None = None


class ApprovalActionRequest(BaseModel):
    resolved_by: str = Field(..., description="User ID or email of the approver")
    action: str = Field(..., pattern="^(approved|rejected)$")
    notes: str | None = None


class ApprovalActionResponse(BaseModel):
    approval_id: str
    status: str
    thread_id: str
    resumed: bool


class PendingApprovalItem(BaseModel):
    approval_id: str
    approval_type: str
    created_at: str
    payload: dict
