from pydantic import BaseModel, Field


class FinanceQueryRequest(BaseModel):
    query: str = Field(..., min_length=5, description="Natural language finance question")
    warehouse_id: str | None = Field(None, description="Optional warehouse UUID to scope analysis")


class FinanceQueryResponse(BaseModel):
    response: str
    warehouse_id: str | None = None
