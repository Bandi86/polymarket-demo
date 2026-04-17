'use client'

import { useState } from "react"
import { X, ExternalLink, ArrowRight, Wallet, CreditCard, Building2, ArrowDownUp, Info, CheckCircle } from "lucide-react"

interface PaymentGuideModalProps {
  isOpen: boolean
  onClose: () => void
}

export function PaymentGuideModal({ isOpen, onClose }: PaymentGuideModalProps) {
  const [activeStep, setActiveStep] = useState(1)

  if (!isOpen) return null

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.9)",
        backdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "1rem",
        overflow: "auto",
      }}
    >
      <div style={{
        background: "var(--bg)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        width: "100%",
        maxWidth: 700,
        maxHeight: "90vh",
        overflow: "auto",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
      }}>
        {/* Header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1rem 1.5rem",
          borderBottom: "1px solid var(--border)",
          position: "sticky",
          top: 0,
          background: "var(--bg)",
          zIndex: 1,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <CreditCard className="w-6 h-6" style={{ color: "var(--primary)" }} />
            <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>
              Pénzügyi Útmutató
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "var(--glass-bg)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "0.5rem",
              cursor: "pointer",
            }}
          >
            <X className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
          </button>
        </div>

        <div style={{ padding: "1.5rem" }}>
          {/* Step Navigation */}
          <div style={{
            display: "flex",
            gap: "0.5rem",
            marginBottom: "1.5rem",
            flexWrap: "wrap",
          }}>
            {[1, 2, 3, 4].map((step) => (
              <button
                key={step}
                onClick={() => setActiveStep(step)}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: 8,
                  border: activeStep === step ? "2px solid var(--primary)" : "1px solid var(--border)",
                  background: activeStep === step ? "rgba(99, 102, 241, 0.1)" : "transparent",
                  color: activeStep === step ? "var(--primary)" : "var(--text-muted)",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {step === 1 && "1. Feltöltés"}
                {step === 2 && "2. Kereskedés"}
                {step === 3 && "3. Kivétel"}
                {step === 4 && "4. Bank"}
              </button>
            ))}
          </div>

          {/* Step Content */}
          {activeStep === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.125rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <ArrowDownUp className="w-5 h-5" style={{ color: "#22c55e" }} />
                Pénz feltöltése a Polymarket-ra
              </h3>

              <div style={{ padding: "1rem", background: "var(--glass-bg)", borderRadius: 12, border: "1px solid var(--border)" }}>
                <h4 style={{ margin: "0 0 0.75rem", fontSize: "0.9rem", color: "var(--text-primary)" }}>
                  Lehetőségek:
                </h4>

                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                    <div style={{ background: "#22c55e20", padding: "0.4rem", borderRadius: 8 }}>
                      <Wallet className="w-4 h-4" style={{ color: "#22c55e" }} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>Bridge (Ajánlott)</div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        ETH, Polygon, Arbitrum, Base, Solana → Polymarket
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                        1. "Deposit" gomb a appban<br/>
                        2. Küldj USDC-t a megjelenő címre<br/>
                        3. Automatikusan megjelenik a Polymarket-on
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                    <div style={{ background: "#3b82f620", padding: "0.4rem", borderRadius: 8 }}>
                      <CreditCard className="w-4 h-4" style={{ color: "#3b82f6" }} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>Közvetlen vásárlás</div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        Polymarket.com → Portfolio → Add Funds
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                        Bankkártya (korlátozott elérhetőség)
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ padding: "0.75rem", background: "rgba(245, 158, 11, 0.1)", borderRadius: 8, border: "1px solid rgba(245, 158, 11, 0.3)", fontSize: "0.85rem" }}>
                <strong style={{ color: "#f59e0b" }}>💡 Tipp:</strong> Polygon hálózaton a legolcsóbb a gas, és a leggyorsabb a transfer.
              </div>
            </div>
          )}

          {activeStep === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.125rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <ArrowRight className="w-5 h-5" style={{ color: "#8b5cf6" }} />
                Kereskedés a app-ban
              </h3>

              <div style={{ padding: "1rem", background: "var(--glass-bg)", borderRadius: 12, border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <CheckCircle className="w-4 h-4" style={{ color: "#22c55e" }} />
                    <span style={{ fontSize: "0.9rem" }}>Demo mode: Tesztelés ingyen</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <CheckCircle className="w-4 h-4" style={{ color: "#22c55e" }} />
                    <span style={{ fontSize: "0.9rem" }}>Live mode: Valós pénz - szükséges az approvals</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <CheckCircle className="w-4 h-4" style={{ color: "#22c55e" }} />
                    <span style={{ fontSize: "0.9rem" }}>Approvals: Egy engedély tranzakció (MATIC gas)</span>
                  </div>
                </div>
              </div>

              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                A bot-ok automatikusan kereskednek a beállított stratégia alapján.
              </div>
            </div>
          )}

          {activeStep === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.125rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <ArrowDownUp className="w-5 h-5" style={{ color: "#ef4444" }} />
                Pénz kivétele Polymarket-ról
              </h3>

              <div style={{ padding: "1rem", background: "var(--glass-bg)", borderRadius: 12, border: "1px solid var(--border)" }}>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
                  <strong style={{ color: "#ef4444" }}>Fontos:</strong> Polymarket NEM támogatja a közvetlen bank kivételt!
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.25rem" }}>
                      1. Bridge vissza (Polygon/Ethereum/Base)
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      Polymarket.com → Portfolio → Withdraw → Válassz chain-t
                    </div>
                  </div>

                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.25rem" }}>
                      2. Küldés exchange-re
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      Polygon → Küldd a wallet-odba, onnan exchange-re (Binance/Bybit/Crypto.com)
                    </div>
                  </div>

                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.25rem" }}>
                      3. Exchange → Bank
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      Sell USDC → HUF/EUR → Kivétel bankkártyára
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ padding: "0.75rem", background: "rgba(239, 68, 68, 0.1)", borderRadius: 8, border: "1px solid rgba(239, 68, 68, 0.3)", fontSize: "0.85rem" }}>
                <strong style={{ color: "#ef4444" }}>⚠️ Figyelmeztetés:</strong> Minden lépéshez gas díj tartozik!
                A legolcsóbb Polygon → Polygon transfer.
              </div>
            </div>
          )}

          {activeStep === 4 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.125rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Building2 className="w-5 h-5" style={{ color: "#06b6d4" }} />
                Bank számlára juttatás
              </h3>

              <div style={{ padding: "1rem", background: "var(--glass-bg)", borderRadius: 12, border: "1px solid var(--border)" }}>
                <h4 style={{ margin: "0 0 0.75rem", fontSize: "0.9rem" }}>
                  Ajánlott exchange-ek magyar felhasználóknak:
                </h4>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                    <div style={{ background: "#f59e0b20", padding: "0.4rem", borderRadius: 8 }}>
                      <span style={{ fontSize: "0.8rem", fontWeight: 700 }}>B</span>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>Binance (Ajánlott)</div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        • Legalacsonyabb fee<br/>
                        • HUF feltöltés + kivétel<br/>
                        • P2P - magyar bankkártya
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                    <div style={{ background: "#f59e0b20", padding: "0.4rem", borderRadius: 8 }}>
                      <span style={{ fontSize: "0.8rem", fontWeight: 700 }}>By</span>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>Bybit</div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        • Olcsó trading<br/>
                        • Kártyás vásárlás<br/>
                        • Fast conversion
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                    <div style={{ background: "#06b6d420", padding: "0.4rem", borderRadius: 8 }}>
                      <span style={{ fontSize: "0.8rem", fontWeight: 700 }}>R</span>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>Revolut</div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        • Nem közvetlen crypto<br/>
                        • Exchange-en át kell menni<br/>
                        • Gyors bank transzfer
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                    <div style={{ background: "#ec489920", padding: "0.4rem", borderRadius: 8 }}>
                      <span style={{ fontSize: "0.8rem", fontWeight: 700 }}>P</span>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>PayPal</div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        • Csak eladás a PayPal app-ban<br/>
                        • Exchange → PayPal → Bank
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Complete Flow Diagram */}
              <div style={{ padding: "1rem", background: "linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1))", borderRadius: 12, border: "1px solid var(--border)" }}>
                <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.75rem", textAlign: "center" }}>
                  Teljes pénzáramlás
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.25rem", flexWrap: "wrap", fontSize: "0.75rem" }}>
                  <span style={{ background: "var(--glass-bg)", padding: "0.25rem 0.5rem", borderRadius: 4 }}>Bank</span>
                  <ArrowRight className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                  <span style={{ background: "#22c55e20", padding: "0.25rem 0.5rem", borderRadius: 4, color: "#22c55e" }}>Polygon</span>
                  <ArrowRight className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                  <span style={{ background: "#8b5cf620", padding: "0.25rem 0.5rem", borderRadius: 4, color: "#8b5cf6" }}>Polymarket</span>
                  <ArrowRight className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                  <span style={{ background: "#ef444420", padding: "0.25rem 0.5rem", borderRadius: 4, color: "#ef4444" }}>Binance</span>
                  <ArrowRight className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                  <span style={{ background: "var(--glass-bg)", padding: "0.25rem 0.5rem", borderRadius: 4 }}>Revolut/PayPal</span>
                  <ArrowRight className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                  <span style={{ background: "var(--glass-bg)", padding: "0.25rem 0.5rem", borderRadius: 4 }}>Bank</span>
                </div>
              </div>
            </div>
          )}

          {/* Footer Links */}
          <div style={{ marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid var(--border)", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <a
              href="https://polymarket.com/portfolio"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", gap: "0.25rem", color: "var(--primary)", fontSize: "0.85rem" }}
            >
              Polymarket Portfolio <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="https://www.binance.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", gap: "0.25rem", color: "var(--primary)", fontSize: "0.85rem" }}
            >
              Binance <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="https://bybit.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", gap: "0.25rem", color: "var(--primary)", fontSize: "0.85rem" }}
            >
              Bybit <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
