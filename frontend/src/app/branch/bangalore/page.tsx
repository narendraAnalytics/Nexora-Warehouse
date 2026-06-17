"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import "./bangalore-auth.css"

const LOGO = "https://res.cloudinary.com/dkqbzwicr/image/upload/q_auto/f_auto/v1781526126/logoImage_nonxua.png"
const CORRECT_PASSWORD = "admin@123"

export default function BangaloreAuth() {
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
      router.push("/branch/bangalore/dashboard")
    } else {
      setError("Invalid password. Access denied.")
      setShake(true)
      setTimeout(() => setShake(false), 600)
    }
  }

  return (
    <div className="blr-auth">
      {/* ── LEFT — Warehouse Scene ─────────────────────── */}
      <div className="blr-left">
        {/* Brand tag */}
        <div className="blr-brand-tag">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="Nexora" />
          <span className="blr-brand-name">Nexora</span>
        </div>

        {/* Glow orbs */}
        <div className="blr-orb blr-orb-1" />
        <div className="blr-orb blr-orb-2" />
        <div className="blr-orb blr-orb-3" />

        {/* Warehouse shelving */}
        <div className="blr-warehouse">
          <div className="blr-shelf-unit">
            {/* Shelf row 1 */}
            <div className="blr-shelf-row">
              <div className="blr-strut-r" />
              <div className="blr-box a" />
              <div className="blr-box b" />
              <div className="blr-box a" />
              <div className="blr-box c" />
              <div className="blr-box b" />
            </div>
            {/* Shelf row 2 */}
            <div className="blr-shelf-row">
              <div className="blr-strut-r" />
              <div className="blr-box c" />
              <div className="blr-box e" />
              <div className="blr-box d" />
              <div className="blr-box a" />
              <div className="blr-box e" />
            </div>
            {/* Shelf row 3 */}
            <div className="blr-shelf-row">
              <div className="blr-strut-r" />
              <div className="blr-box b" />
              <div className="blr-box d" />
              <div className="blr-box c" />
              <div className="blr-box b" />
              <div className="blr-box a" />
            </div>
          </div>
        </div>

        {/* City label */}
        <div className="blr-city-label">
          <h2>Bangalore</h2>
          <p>Karnataka · Electronics Hub</p>
        </div>
      </div>

      {/* ── RIGHT — Login Form ─────────────────────────── */}
      <div className="blr-right">
        <div className="blr-form-card">
          {/* Logo */}
          <div className="blr-logo-row">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO} alt="Nexora" />
            <div className="blr-logo-text">
              <span>Nexora</span>
              <span>Warehouse Intelligence</span>
            </div>
          </div>

          {/* Heading */}
          <h1 className="blr-heading">Bangalore Branch</h1>
          <p className="blr-sub">Authorized personnel only. Enter credentials to access branch data.</p>

          {/* Branch stats */}
          <div className="blr-stats">
            <div className="blr-stat inv">
              <div className="blr-stat-dot" />
              ₹11.8 Cr Inventory
            </div>
            <div className="blr-stat sqft">
              <div className="blr-stat-dot" />
              12,000 sq ft
            </div>
            <div className="blr-stat otd">
              <div className="blr-stat-dot" />
              97.1% OTD
            </div>
          </div>

          <div className="blr-divider" />

          {/* Form */}
          <form
            ref={formRef}
            className={`blr-form${shake ? " shake" : ""}`}
            onSubmit={handleLogin}
          >
            <div className="blr-field">
              <label className="blr-label" htmlFor="blr-username">Branch Username</label>
              <input
                id="blr-username"
                className="blr-input"
                type="text"
                value="BangaloreBranch"
                readOnly
                tabIndex={-1}
              />
            </div>

            <div className="blr-field">
              <label className="blr-label" htmlFor="blr-password">Password</label>
              <input
                id="blr-password"
                className="blr-input"
                type="password"
                placeholder="Enter branch password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoFocus
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="blr-error">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <button className="blr-btn" type="submit" disabled={loading || !password}>
              {loading ? "Unlocking…" : "Access Branch Dashboard →"}
            </button>
          </form>

          <p className="blr-footer">
            Nexora Warehouse Intelligence · Bangalore Branch · Secured Access
          </p>
        </div>
      </div>
    </div>
  )
}
