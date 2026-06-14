# ── Nexora Business Constants ─────────────────────────────────────────────────
NEXORA_BRANCHES = ["Hyderabad", "Bangalore", "Chennai", "Mumbai", "Pune"]

NEXORA_PRODUCT_CATEGORIES = [
    "TVs",
    "Mobiles & Tablets",
    "Gaming Consoles",
    "Networking Equipment",
    "Accessories & Peripherals",
]

# Inventory thresholds
REORDER_THRESHOLD_DAYS = 7        # trigger reorder when stock < 7 days of demand
OVERSTOCK_THRESHOLD_DAYS = 90     # flag overstock when stock > 90 days of demand
LOW_STOCK_PERCENTAGE = 0.20       # critical alert at 20% of safety stock

# CEO Briefing schedule
CEO_BRIEFING_HOUR = 8             # 8:00 AM daily
