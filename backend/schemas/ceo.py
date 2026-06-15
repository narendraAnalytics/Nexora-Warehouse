from pydantic import BaseModel, Field


class CEOBriefingRequest(BaseModel):
    briefing_type: str = Field(default="on_demand", description="morning_briefing | on_demand")
    warehouse_id: str | None = Field(default=None, description="Scope briefing to a specific branch UUID")


class CEOBriefingResponse(BaseModel):
    briefing: str
    decision_id: str | None = None
    briefing_type: str
    warehouse_id: str | None = None


class ExecutiveDecision(BaseModel):
    id: str
    decision_type: str
    title: str
    summary: str | None = None
    recommendations: list | None = None
    priority: str
    status: str
    briefing_date: str
    created_at: str
