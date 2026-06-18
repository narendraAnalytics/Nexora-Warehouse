"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import "../../products.css"

interface FormState {
  sku: string
  productName: string
  category: string
  brand: string
  modelSeries: string
  productType: string
  hsnCode: string
  unitCost: string
  mrp: string
  gst: string
  reorderPoint: string
  safetyStock: string
  uom: string
  procurementCategory: string
  supplier: string
  warrantyMonths: string
  locationShelf: string
  barcode: string
  status: string
  description: string
}

const BLANK: FormState = {
  sku: "", productName: "", category: "", brand: "",
  modelSeries: "", productType: "", hsnCode: "",
  unitCost: "", mrp: "", gst: "18",
  reorderPoint: "", safetyStock: "", uom: "",
  procurementCategory: "", supplier: "",
  warrantyMonths: "", locationShelf: "", barcode: "",
  status: "Active", description: "",
}

export default function EditProductPage() {
  const router   = useRouter()
  const params   = useParams()
  const id       = params.id as string
  const { user, isLoaded } = useUser()

  const [form, setForm]         = useState<FormState>(BLANK)
  const [image, setImage]       = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [loading, setLoading]   = useState(true)
  const [toast, setToast]       = useState<{ msg: string; type: "success" | "draft" | "error" } | null>(null)
  const [skuError,  setSkuError]  = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Load product data on mount
  useEffect(() => {
    if (!id) return
    fetch(`/api/products/${id}`)
      .then(r => r.json())
      .then(data => {
        if (!data || data.error) {
          showToast("Product not found", "error")
          return
        }
        setForm({
          sku:                data.sku         ?? "",
          productName:        data.name        ?? "",
          category:           data.category    ?? "",
          brand:              data.brand       ?? "",
          modelSeries:        "",
          productType:        "",
          hsnCode:            "",
          unitCost:           data.unit_cost   != null ? String(data.unit_cost)  : "",
          mrp:                data.unit_price  != null ? String(data.unit_price) : "",
          gst:                "18",
          reorderPoint:       "",
          safetyStock:        "",
          uom:                data.unit_of_measure ?? "",
          procurementCategory: "",
          supplier:           "",
          warrantyMonths:     "",
          locationShelf:      "",
          barcode:            "",
          status:             data.is_active ? "Active" : "Draft",
          description:        data.description ?? "",
        })
      })
      .catch(() => showToast("Failed to load product", "error"))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const showToast = (msg: string, type: "success" | "draft" | "error") => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3200)
  }

  const set = (field: keyof FormState, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const checkSku = async (val: string) => {
    if (!val) return
    const r = await fetch(`/api/products/check?sku=${encodeURIComponent(val)}&excludeId=${id}`)
    const d = await r.json()
    setSkuError(d.exists ? `SKU "${val}" is already taken` : null)
  }

  const checkName = async (val: string) => {
    if (!val) return
    const r = await fetch(`/api/products/check?name=${encodeURIComponent(val)}&excludeId=${id}`)
    const d = await r.json()
    setNameError(d.exists ? `Product name "${val}" already exists` : null)
  }

  const updatedBy = isLoaded ? (user?.fullName || user?.username || "—") : "—"

  const buildPayload = () => ({
    sku:                 form.sku,
    productName:         form.productName,
    category:            form.category,
    brand:               form.brand,
    modelSeries:         form.modelSeries,
    productType:         form.productType,
    hsnCode:             form.hsnCode,
    unitCost:            form.unitCost,
    mrp:                 form.mrp,
    gst:                 form.gst,
    reorderPoint:        form.reorderPoint,
    safetyStock:         form.safetyStock,
    uom:                 form.uom,
    procurementCategory: form.procurementCategory,
    supplier:            form.supplier,
    warrantyMonths:      form.warrantyMonths,
    locationShelf:       form.locationShelf,
    barcode:             form.barcode,
    status:              form.status,
    description:         form.description,
    updatedBy,
  })

  const handleUpdate = async () => {
    if (!form.sku || !form.productName) {
      showToast("SKU and Product Name are required", "error")
      return
    }
    if (!form.category) {
      showToast("Category is required", "error")
      return
    }
    if (skuError || nameError) {
      showToast("Fix duplicate errors before saving", "error")
      return
    }
    setSaving(true)
    try {
      const res  = await fetch(`/api/products/${id}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(buildPayload()),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      showToast(`Updated — ${data.sku}`, "success")
      setTimeout(() => router.push("/products/list"), 1200)
    } catch (e) {
      showToast(String(e), "error")
    } finally {
      setSaving(false)
    }
  }

  const handleImageFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => setImage(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file?.type.startsWith("image/")) handleImageFile(file)
  }

  const now     = new Date()
  const dateStr = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })

  const baseVal  = parseFloat(form.unitCost || "0")
  const gstRate  = parseFloat(form.gst) / 100
  const gstAmt   = baseVal * gstRate
  const totalVal = baseVal + gstAmt

  if (loading) {
    return (
      <div className="nexora-products" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ textAlign: "center", color: "#6b7280", fontSize: "15px" }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>⏳</div>
          Loading product…
        </div>
      </div>
    )
  }

  return (
    <div className="nexora-products">

      {/* ── Topbar ── */}
      <header className="np-topbar">
        <button className="np-back" onClick={() => router.push("/products/list")}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Back to Catalog
        </button>

        <div className="np-topbar-center">
          <h1 className="np-title">Edit Product</h1>
          <p className="np-subtitle">Product Master Management · Update Record</p>
        </div>

        <div className="np-stats-chips">
          <span className="np-chip">
            <span className="np-chip-dot" style={{ background: "#a78bfa" }}/>
            ID: {id.slice(0, 8)}…
          </span>
          <button className="np-view-btn" onClick={() => router.push("/products/list")}>
            View Catalog →
          </button>
        </div>
      </header>

      {/* ── Hero strip ── */}
      <div className="np-hero">
        <div>
          <span className="np-hero-tag">Edit Mode</span>
          <h2 className="np-hero-title">Update Product Record</h2>
          <p className="np-hero-desc">Modify pricing, GST rate, thresholds — changes apply to all warehouses</p>
        </div>
        <div className="np-hero-icons">
          {["✏️", "💰", "📊", "💾"].map((icon, i) => (
            <div key={i} className="np-hero-icon">{icon}</div>
          ))}
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="np-content">

        {/* ── Left: form sections ── */}
        <div className="np-form-col">

          {/* Section 1 — Basic Information */}
          <section className="np-section np-section-blue">
            <div className="np-section-header">
              <span className="np-section-icon">📋</span>
              <div>
                <h3 className="np-section-title">Basic Information</h3>
                <p className="np-section-desc">Core product identifiers and classification</p>
              </div>
            </div>
            <div className="np-fields">

              <div className="np-field-row">
                <div className="np-field">
                  <label>SKU Code <span className="np-required">*</span></label>
                  <div className="np-input-wrap">
                    <input type="text" placeholder="e.g. LAP-DELL-5440" value={form.sku ?? ""}
                      onChange={e => { set("sku", e.target.value); setSkuError(null) }}
                      onBlur={e => checkSku(e.target.value)}/>
                  </div>
                  {skuError && <span className="np-field-error">{skuError}</span>}
                </div>
                <div className="np-field">
                  <label>Product Name <span className="np-required">*</span></label>
                  <input type="text" placeholder="e.g. Dell Latitude 5440" value={form.productName ?? ""}
                    onChange={e => { set("productName", e.target.value); setNameError(null) }}
                    onBlur={e => checkName(e.target.value)}/>
                  {nameError && <span className="np-field-error">{nameError}</span>}
                </div>
              </div>

              <div className="np-field-row">
                <div className="np-field">
                  <label>Category <span className="np-required">*</span></label>
                  <select title="Category" value={form.category ?? ""} onChange={e => set("category", e.target.value)}>
                    <option value="">Select Category</option>
                    <option>Laptops</option>
                    <option>Mobiles &amp; Tablets</option>
                    <option>TVs &amp; Displays</option>
                    <option>Gaming Consoles</option>
                    <option>Networking Equipment</option>
                    <option>Accessories</option>
                  </select>
                </div>
                <div className="np-field">
                  <label>Brand</label>
                  <input type="text" placeholder="e.g. Dell, Samsung, TP-Link" value={form.brand ?? ""}
                    onChange={e => set("brand", e.target.value)}/>
                </div>
              </div>

              <div className="np-field-row">
                <div className="np-field">
                  <label>Model / Series</label>
                  <input type="text" placeholder="e.g. Latitude 5000, Galaxy A" value={form.modelSeries ?? ""}
                    onChange={e => set("modelSeries", e.target.value)}/>
                </div>
                <div className="np-field">
                  <label>Product Type</label>
                  <select title="Product Type" value={form.productType ?? ""} onChange={e => set("productType", e.target.value)}>
                    <option value="">Select Type</option>
                    <option>Finished Goods</option>
                    <option>Raw Material</option>
                    <option>Consumable</option>
                    <option>Spare Part</option>
                    <option>Trading Goods</option>
                  </select>
                </div>
              </div>

              <div className="np-field">
                <label>HSN Code</label>
                <input type="text" placeholder="e.g. 84713010" value={form.hsnCode ?? ""}
                  onChange={e => set("hsnCode", e.target.value)}/>
                <span className="np-hint">Harmonized System of Nomenclature code for GST compliance</span>
              </div>

            </div>
          </section>

          {/* Section 2 — Pricing & Taxation */}
          <section className="np-section np-section-green">
            <div className="np-section-header">
              <span className="np-section-icon">💰</span>
              <div>
                <h3 className="np-section-title">Pricing &amp; Taxation</h3>
                <p className="np-section-desc">Unit cost, MRP, GST rate — update when prices change</p>
              </div>
            </div>
            <div className="np-fields">

              <div className="np-field-row">
                <div className="np-field">
                  <label>Unit Cost (₹)</label>
                  <div className="np-input-prefix">
                    <span className="np-prefix">₹</span>
                    <input type="number" placeholder="0.00" min="0" step="0.01" value={form.unitCost ?? ""}
                      onChange={e => set("unitCost", e.target.value)}/>
                  </div>
                </div>
                <div className="np-field">
                  <label>MRP (₹)</label>
                  <div className="np-input-prefix">
                    <span className="np-prefix">₹</span>
                    <input type="number" placeholder="0.00" min="0" step="0.01" value={form.mrp ?? ""}
                      onChange={e => set("mrp", e.target.value)}/>
                  </div>
                </div>
                <div className="np-field">
                  <label>GST Rate</label>
                  <select title="GST Rate" value={form.gst ?? ""} onChange={e => set("gst", e.target.value)}>
                    <option value="0">0% (Exempt)</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
              </div>

              {form.unitCost && (
                <div className="np-calc-strip">
                  <span>Base: ₹{baseVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  <span className="np-calc-sep">+</span>
                  <span>GST ({form.gst}%): ₹{gstAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  <span className="np-calc-sep">=</span>
                  <span className="np-calc-total">Total: ₹{totalVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
              )}

            </div>
          </section>

          {/* Section 3 — Inventory & Planning */}
          <section className="np-section np-section-orange">
            <div className="np-section-header">
              <span className="np-section-icon">📊</span>
              <div>
                <h3 className="np-section-title">Inventory &amp; Planning</h3>
                <p className="np-section-desc">Update reorder thresholds — applies to all warehouses</p>
              </div>
            </div>
            <div className="np-fields">

              <div className="np-field-row">
                <div className="np-field">
                  <label>Reorder Point</label>
                  <input type="number" placeholder="25" min="0" value={form.reorderPoint ?? ""}
                    onChange={e => set("reorderPoint", e.target.value)}/>
                  <span className="np-hint">Leave blank to keep current threshold</span>
                </div>
                <div className="np-field">
                  <label>Safety Stock</label>
                  <input type="number" placeholder="15" min="0" value={form.safetyStock ?? ""}
                    onChange={e => set("safetyStock", e.target.value)}/>
                </div>
              </div>

              <div className="np-field-row">
                <div className="np-field">
                  <label>Unit of Measure</label>
                  <select title="Unit of Measure" value={form.uom ?? ""} onChange={e => set("uom", e.target.value)}>
                    <option value="">Select UOM</option>
                    <option>Pcs</option>
                    <option>Box</option>
                    <option>Set</option>
                    <option>Kg</option>
                    <option>Ltr</option>
                    <option>Dozen</option>
                    <option>Carton</option>
                  </select>
                </div>
                <div className="np-field">
                  <label>Procurement Category</label>
                  <select title="Procurement Category" value={form.procurementCategory ?? ""} onChange={e => set("procurementCategory", e.target.value)}>
                    <option value="">Select Category</option>
                    <option>Direct</option>
                    <option>Indirect</option>
                    <option>Capital</option>
                    <option>Services</option>
                    <option>MRO</option>
                  </select>
                </div>
              </div>

              <div className="np-field">
                <label>Preferred Supplier</label>
                <input type="text" placeholder="e.g. TechSource Electronics" value={form.supplier ?? ""}
                  onChange={e => set("supplier", e.target.value)}/>
              </div>

            </div>
          </section>

          {/* Section 4 — Additional Information */}
          <section className="np-section np-section-purple">
            <div className="np-section-header">
              <span className="np-section-icon">📝</span>
              <div>
                <h3 className="np-section-title">Additional Information</h3>
                <p className="np-section-desc">Warranty, shelf location, barcode, status, and product notes</p>
              </div>
            </div>
            <div className="np-fields">

              <div className="np-field-row">
                <div className="np-field">
                  <label>Warranty (Months)</label>
                  <input type="number" placeholder="12" min="0" value={form.warrantyMonths ?? ""}
                    onChange={e => set("warrantyMonths", e.target.value)}/>
                </div>
                <div className="np-field">
                  <label>Location / Shelf</label>
                  <input type="text" placeholder="e.g. A3-B2, Rack 5" value={form.locationShelf ?? ""}
                    onChange={e => set("locationShelf", e.target.value)}/>
                </div>
              </div>

              <div className="np-field-row">
                <div className="np-field">
                  <label>Barcode / GTIN</label>
                  <input type="text" placeholder="e.g. 8901234567890" value={form.barcode ?? ""}
                    onChange={e => set("barcode", e.target.value)}/>
                </div>
                <div className="np-field">
                  <label>Product Status</label>
                  <select title="Product Status" value={form.status ?? ""} onChange={e => set("status", e.target.value)}>
                    <option>Active</option>
                    <option>Draft</option>
                    <option>Discontinued</option>
                  </select>
                </div>
              </div>

              <div className="np-field">
                <label>Product Description</label>
                <textarea rows={4} placeholder="Enter product description, specifications, or notes..."
                  value={form.description ?? ""} onChange={e => set("description", e.target.value)}/>
              </div>

            </div>
          </section>
        </div>

        {/* ── Right: panels ── */}
        <div className="np-right-col">

          {/* Image upload */}
          <div className="np-panel">
            <h4 className="np-panel-title"><span>🖼️</span> Product Image</h4>
            <div
              className={`np-drop-zone${dragOver ? " np-drop-over" : ""}${image ? " np-has-image" : ""}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              {image ? (
                <img src={image} alt="Product preview" className="np-preview-img"/>
              ) : (
                <>
                  <span className="np-drop-icon">📁</span>
                  <p className="np-drop-text">Drag &amp; drop or click to upload</p>
                  <p className="np-drop-hint">PNG, JPG, WebP · Max 5 MB</p>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" aria-label="Upload product image" style={{ display: "none" }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f) }}/>
            {image && (
              <button className="np-remove-img" onClick={() => setImage(null)}>Remove Image</button>
            )}
          </div>

          {/* System Info */}
          <div className="np-panel np-panel-sys">
            <h4 className="np-panel-title"><span>⚙️</span> System Info</h4>
            <div className="np-sys-rows">
              <div className="np-sys-row"><span>Updated By</span><span>{updatedBy}</span></div>
              <div className="np-sys-row"><span>Date</span><span>{dateStr}</span></div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Sticky action bar ── */}
      <div className="np-action-bar">
        <span className="np-req-note">* Required fields</span>
        <div className="np-action-btns">
          <button className="np-btn-reset" onClick={() => router.push("/products/list")} disabled={saving}>
            Cancel
          </button>
          <button className="np-btn-save" onClick={handleUpdate} disabled={saving}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="20,6 9,17 4,12"/>
            </svg>
            {saving ? "Saving…" : "Update Product"}
          </button>
        </div>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className={`np-toast np-toast-${toast.type}`}>
          <span className="np-toast-icon">
            {toast.type === "success" ? "✓" : toast.type === "draft" ? "📄" : "✕"}
          </span>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
