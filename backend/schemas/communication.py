from pydantic import BaseModel, Field


class CommunicationRequest(BaseModel):
    instruction: str = Field(
        ...,
        min_length=10,
        description=(
            "Natural language instruction, e.g. "
            "'Send a stockout alert to ops@nexora.com for TVs at Hyderabad branch'"
        ),
    )


class CommunicationResponse(BaseModel):
    response: str
