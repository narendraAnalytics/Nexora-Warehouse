from pydantic import BaseModel, Field


class KnowledgeQueryRequest(BaseModel):
    query: str = Field(..., min_length=5, description="Natural language question to search the knowledge base")
    layer: str | None = Field(None, description="Knowledge layer: business | supplier | logistics | executive")


class KnowledgeQueryResponse(BaseModel):
    response: str
    layer: str | None = None
