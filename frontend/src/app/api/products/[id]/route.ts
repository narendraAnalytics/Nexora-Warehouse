import { sql } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const rows = await sql`SELECT * FROM products WHERE id = ${id}::uuid`
    if (rows.length === 0) return NextResponse.json(null, { status: 404 })
    return NextResponse.json(rows[0])
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const b = await req.json()

    if (!b.sku || !b.productName) {
      return NextResponse.json({ error: "SKU and Product Name are required" }, { status: 400 })
    }
    if (!b.category) {
      return NextResponse.json({ error: "Category is required" }, { status: 400 })
    }

    // Duplicate check — exclude self
    const existing = await sql`
      SELECT sku, name FROM products
      WHERE (sku = ${b.sku} OR LOWER(name) = LOWER(${b.productName}))
        AND id != ${id}::uuid
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
    const isActive  = b.status !== "Draft"

    const [product] = await sql`
      UPDATE products SET
        sku             = ${b.sku},
        name            = ${b.productName},
        category        = ${b.category},
        brand           = ${b.brand       || null},
        description     = ${b.description || null},
        unit_price      = ${unitPrice},
        unit_cost       = ${unitCost},
        unit_of_measure = ${b.uom || 'piece'},
        is_active       = ${isActive}
      WHERE id = ${id}::uuid
      RETURNING id, sku, name, is_active
    `

    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 })

    // Update inventory thresholds across all warehouses (if provided)
    if (b.reorderPoint) {
      const reorderPoint = Number(b.reorderPoint)
      const reorderQty   = reorderPoint > 0 ? reorderPoint * 2 : 50
      const maxStock     = reorderPoint > 0 ? reorderPoint * 4 : 200

      await sql`
        UPDATE inventory SET
          reorder_point = ${reorderPoint},
          reorder_qty   = ${reorderQty},
          max_stock     = ${maxStock}
        WHERE product_id = ${id}::uuid
      `
    }

    // Log notification to agent_logs
    await sql`
      INSERT INTO agent_logs (agent_name, action, output_summary, status)
      VALUES ('product_master', 'product_updated',
        ${`Product ${product.sku} — ${product.name} updated`},
        'success')
    `

    return NextResponse.json({
      id:          product.id,
      sku:         product.sku,
      productName: product.name,
      isActive:    product.is_active,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await sql`DELETE FROM inventory WHERE product_id = ${id}::uuid`
    const result = await sql`DELETE FROM products WHERE id = ${id}::uuid RETURNING id`
    if (result.length === 0) return NextResponse.json({ error: "Product not found" }, { status: 404 })

    // Log notification to agent_logs
    await sql`
      INSERT INTO agent_logs (agent_name, action, output_summary, status)
      VALUES ('product_master', 'product_deleted',
        ${'Product removed from catalog and all warehouse inventories'},
        'success')
    `

    return NextResponse.json({ deleted: true, id: result[0].id })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
