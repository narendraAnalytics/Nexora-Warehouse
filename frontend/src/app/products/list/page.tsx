"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import "../products.css"

interface Product {
  id: string
  sku: string
  name: string
  category: string | null
  brand: string | null
  unit_price: string | null
  unit_of_measure: string | null
  is_active: boolean
  created_at: string
}

export default function ProductListPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [stats, setStats]       = useState({ total: 0, active: 0, draft: 0 })
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    Promise.all([
      fetch("/api/products/list").then(r => r.json()),
      fetch("/api/products/stats").then(r => r.json()),
    ]).then(([list, s]) => {
      if (!list.error) setProducts(list)
      if (!s.error)    setStats(s)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const fmt = (v: string | null) =>
    v ? `₹${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"

  return (
    <div className="nexora-products">

      {/* Topbar */}
      <header className="np-topbar">
        <button className="np-back" onClick={() => router.push("/dashboard")}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Back to Dashboard
        </button>
        <div className="np-topbar-center">
          <h1 className="np-title">Product Catalog</h1>
          <p className="np-subtitle">Product Master Management · All Warehouses</p>
        </div>
        <div className="np-stats-chips">
          <span className="np-chip"><span className="np-chip-dot blue"/>{stats.total} Total</span>
          <span className="np-chip"><span className="np-chip-dot green"/>{stats.active} Active</span>
          <span className="np-chip"><span className="np-chip-dot amber"/>{stats.draft} Draft</span>
          <button className="np-view-btn" onClick={() => router.push("/products")}>+ Add Product</button>
        </div>
      </header>

      {/* Hero strip */}
      <div className="np-hero">
        <div>
          <span className="np-hero-tag">Product Master</span>
          <h2 className="np-hero-title">All Products</h2>
          <p className="np-hero-desc">View and manage your complete product catalog across all warehouses</p>
        </div>
        <div className="np-hero-icons">
          {["📦", "🏷️", "📊", "🔍"].map((icon, i) => (
            <div key={i} className="np-hero-icon">{icon}</div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="np-content" style={{ display: "block", padding: "24px 28px 60px" }}>
        <div className="np-section np-section-blue" style={{ overflow: "auto" }}>
          <div className="np-section-header">
            <span className="np-section-icon">📋</span>
            <div>
              <h3 className="np-section-title">Product Records</h3>
              <p className="np-section-desc">{products.length} product{products.length !== 1 ? "s" : ""} in catalog</p>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#6b7280", fontSize: "14px" }}>
              Loading products…
            </div>
          ) : products.length === 0 ? (
            <div style={{ padding: "60px 24px", textAlign: "center" }}>
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>📦</div>
              <p style={{ color: "#374151", fontWeight: 700, fontSize: "15px" }}>No products yet</p>
              <p style={{ color: "#6b7280", fontSize: "13px", marginTop: "6px" }}>Add your first product to get started</p>
              <button className="np-btn-save" style={{ marginTop: "20px" }} onClick={() => router.push("/products")}>
                + Add New Product
              </button>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="np-list-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product Name</th>
                    <th>Category</th>
                    <th>Brand</th>
                    <th>Unit Price</th>
                    <th>UOM</th>
                    <th>Status</th>
                    <th>Added</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id}>
                      <td><span className="np-sku-tag">{p.sku}</span></td>
                      <td style={{ fontWeight: 600 }}>{p.name}</td>
                      <td>{p.category ?? "—"}</td>
                      <td>{p.brand ?? "—"}</td>
                      <td>{fmt(p.unit_price)}</td>
                      <td>{p.unit_of_measure ?? "—"}</td>
                      <td>
                        <span className={`np-status-badge ${p.is_active ? "np-badge-active" : "np-badge-draft"}`}>
                          {p.is_active ? "Active" : "Draft"}
                        </span>
                      </td>
                      <td style={{ color: "#6b7280", fontSize: "12px" }}>
                        {new Date(p.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
