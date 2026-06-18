import { sql } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const b = await req.json()

    if (!b.sku || !b.productName) {
      return NextResponse.json({ error: "SKU and Product Name are required" }, { status: 400 })
    }
    if (!b.category) {
      return NextResponse.json({ error: "Category is required" }, { status: 400 })
    }

    // Strict duplicate check — reject if SKU or product name already exists
    const existing = await sql`
      SELECT sku, name FROM products
      WHERE sku = ${b.sku} OR LOWER(name) = LOWER(${b.productName})
      LIMIT 1
    `
    if (existing.length > 0) {
      const dup   = existing[0]
      const field = dup.sku === b.sku
        ? `SKU "${b.sku}"`
        : `Product Name "${dup.name}"`
      return NextResponse.json(
        { error: `${field} already exists. Use a different value.` },
        { status: 409 }
      )
    }

    const unitPrice = b.mrp      ? Number(b.mrp)      : (b.unitCost ? Number(b.unitCost) : 0)
    const unitCost  = b.unitCost ? Number(b.unitCost) : 0

    // Plain INSERT — no upsert (duplicates blocked by pre-check above)
    const [product] = await sql`
      INSERT INTO products (
        sku, name, category, brand,
        description, unit_price, unit_cost, unit_of_measure,
        is_active
      ) VALUES (
        ${b.sku},
        ${b.productName},
        ${b.category},
        ${b.brand       || null},
        ${b.description || null},
        ${unitPrice},
        ${unitCost},
        ${b.uom || 'piece'},
        ${true}
      )
      RETURNING id, sku, name, is_active
    `

    // Fetch all active warehouses and upsert inventory row for each
    const warehouses = await sql`SELECT id FROM warehouses WHERE is_active = TRUE`

    const reorderPoint = Number(b.reorderPoint) || 0
    const safetyStock  = Number(b.safetyStock)  || 0
    const reorderQty   = reorderPoint > 0 ? reorderPoint * 2 : 50
    const maxStock     = reorderPoint > 0 ? reorderPoint * 4 : 200

    for (const wh of warehouses) {
      await sql`
        INSERT INTO inventory (
          warehouse_id, product_id,
          quantity, reserved_qty,
          reorder_point, reorder_qty, max_stock,
          avg_daily_sales
        ) VALUES (
          ${wh.id}::uuid,
          ${product.id}::uuid,
          ${safetyStock},
          0,
          ${reorderPoint},
          ${reorderQty},
          ${maxStock},
          0
        )
        ON CONFLICT (warehouse_id, product_id) DO NOTHING
      `
    }

    return NextResponse.json({
      id:          product.id,
      sku:         product.sku,
      productName: product.name,
      isActive:    product.is_active,
      warehouses:  warehouses.length,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
