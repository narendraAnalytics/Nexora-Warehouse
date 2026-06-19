from pydantic import BaseModel


class PRItem(BaseModel):
    sku: str
    name: str
    category: str
    current_qty: int
    reorder_point: int
    suggested_qty: int
    unit_cost: float
    line_total: float


class PRGenerateRequest(BaseModel):
    warehouse_id: str
    reorder_alerts: list[dict] = []
    requested_by: str = "branch_manager"
    notes: str = ""


class PRApprovalRequest(BaseModel):
    acted_by: str
    acted_by_role: str
    notes: str = ""


class PRResponse(BaseModel):
    id: str
    pr_number: str
    workflow_id: str
    warehouse_id: str
    status: str
    total_estimated_value: float
    approval_level: str
    approver_role: str
    items: list[PRItem]
    escalation_deadline: str
    created_at: str
    notes: str = ""


class PRListItem(BaseModel):
    id: str
    pr_number: str
    workflow_id: str
    warehouse_id: str
    status: str
    total_estimated_value: float
    approval_level: str
    approver_role: str
    requested_by: str
    escalation_deadline: str
    created_at: str


class PRApprovalHistoryRow(BaseModel):
    id: str
    action: str
    acted_by: str | None
    acted_by_role: str | None
    notes: str | None
    created_at: str


class PRDetailResponse(PRResponse):
    requested_by: str
    approved_by: str | None
    approved_by_role: str | None
    rejection_reason: str | None
    inventory_analysis: dict
    approval_history: list[PRApprovalHistoryRow] = []


class POItem(BaseModel):
    sku: str
    name: str
    category: str
    quantity: int
    unit_cost: float
    line_total: float


class POResponse(BaseModel):
    id: str
    po_number: str
    pr_id: str
    supplier_id: str
    supplier_name: str
    supplier_city: str
    supplier_reliability: float
    supplier_risk: float
    warehouse_id: str
    status: str
    total_amount: float
    expected_date: str
    items: list[POItem]
    ai_reasoning: str
    created_at: str
