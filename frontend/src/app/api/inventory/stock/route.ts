import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

const BANGALORE_UUID = "531e5c42-e4a1-4db0-a35c-a434f3b94344"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const warehouseId = searchParams.get("warehouse_id") ?? BANGALORE_UUID

  const rows = await sql`
    SELECT
      p.sku,
      p.name,
      p.category,
      p.brand,
      w.name        AS warehouse_name,
      w.city        AS warehouse_city,
      i.quantity,
      i.reserved_qty,
      i.reorder_point,
      i.reorder_qty,
      i.max_stock,
      ROUND(i.avg_daily_sales::numeric, 2) AS avg_daily_sales,
      CASE
        WHEN i.quantity <= i.reorder_point           THEN 'CRITICAL'
        WHEN i.quantity <= (i.reorder_point * 1.5)   THEN 'LOW'
        WHEN i.max_stock > 0
         AND i.quantity >= i.max_stock               THEN 'OVERSTOCK'
        ELSE 'OK'
      END AS stock_status
    FROM inventory i
    JOIN products   p ON p.id = i.product_id
    JOIN warehouses w ON w.id = i.warehouse_id
    WHERE i.warehouse_id = ${warehouseId}::uuid
      AND p.is_active = TRUE
    ORDER BY i.quantity ASC
  `
  return NextResponse.json(rows)
}
