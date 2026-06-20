"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import "./chennai-auth.css"

const LOGO = "https://res.cloudinary.com/dkqbzwicr/image/upload/q_auto/f_auto/v1781526126/logoImage_nonxua.png"
const CORRECT_PASSWORD = "admin@123"

export default function ChennaiAuth() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    setError("")

    if (password === CORRECT_PASSWORD) {
      setLoading(true)
      router.push("/branch/chennai/dashboard")
    } else {
      setError("Invalid password. Access denied.")
      setShake(true)
      setTimeout(() => setShake(false), 600)
    }
  }

  return (
    <div className="chn-auth">
      {/* ── LEFT — Warehouse Scene ─────────────────────── */}
      <div className="chn-left">
        {/* Brand tag */}
        <div className="chn-brand-tag">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="Nexora" />
          <span className="chn-brand-name">Nexora</span>
        </div>

        {/* Glow orbs */}
        <div className="chn-orb chn-orb-1" />
        <div className="chn-orb chn-orb-2" />
        <div className="chn-orb chn-orb-3" />

        {/* Warehouse shelving */}
        <div className="chn-warehouse">
          <div className="chn-shelf-unit">
            {/* Shelf row 1 */}
            <div className="chn-shelf-row">
              <div className="chn-strut-r" />
              <div className="chn-box a" />
              <div className="chn-box b" />
              <div className="chn-box a" />
              <div className="chn-box c" />
              <div className="chn-box b" />
            </div>
            {/* Shelf row 2 */}
            <div className="chn-shelf-row">
              <div className="chn-strut-r" />
              <div className="chn-box c" />
              <div className="chn-box e" />
              <div className="chn-box d" />
              <div className="chn-box a" />
              <div className="chn-box e" />
            </div>
            {/* Shelf row 3 */}
            <div className="chn-shelf-row">
              <div className="chn-strut-r" />
              <div className="chn-box b" />
              <div className="chn-box d" />
              <div className="chn-box c" />
              <div className="chn-box b" />
              <div className="chn-box a" />
            </div>
          </div>
        </div>

        {/* City label */}
        <div className="chn-city-label">
          <h2>Chennai</h2>
          <p>Tamil Nadu · Electronics Hub</p>
        </div>
      </div>

      {/* ── RIGHT — Login Form ─────────────────────────── */}
      <div className="chn-right">
        <div className="chn-form-card">
          {/* Logo */}
          <div className="chn-logo-row">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO} alt="Nexora" />
            <div className="chn-logo-text">
              <span>Nexora</span>
              <span>Warehouse Intelligence</span>
            </div>
          </div>

          {/* Heading */}
          <h1 className="chn-heading">Chennai Branch</h1>
          <p className="chn-sub">Authorized personnel only. Enter credentials to access branch data.</p>

          {/* Branch stats */}
          <div className="chn-stats">
            <div className="chn-stat inv">
              <div className="chn-stat-dot" />
              ₹8.4 Cr Inventory
            </div>
            <div className="chn-stat sqft">
              <div className="chn-stat-dot" />
              10,500 sq ft
            </div>
            <div className="chn-stat otd">
              <div className="chn-stat-dot" />
              95.8% OTD
            </div>
          </div>

          <div className="chn-divider" />

          {/* Form */}
          <form
            ref={formRef}
            className={`chn-form${shake ? " shake" : ""}`}
            onSubmit={handleLogin}
          >
            <div className="chn-field">
              <label className="chn-label" htmlFor="chn-username">Branch Username</label>
              <input
                id="chn-username"
                className="chn-input"
                type="text"
                value="chennaibranch"
                readOnly
                tabIndex={-1}
              />
            </div>

            <div className="chn-field">
              <label className="chn-label" htmlFor="chn-password">Password</label>
              <input
                id="chn-password"
                className="chn-input"
                type="password"
                placeholder="Enter branch password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoFocus
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="chn-error">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <button className="chn-btn" type="submit" disabled={loading || !password}>
              {loading ? "Unlocking…" : "Access Branch Dashboard →"}
            </button>
          </form>

          <p className="chn-footer">
            Nexora Warehouse Intelligence · Chennai Branch · Secured Access
          </p>
        </div>
      </div>
    </div>
  )
}
