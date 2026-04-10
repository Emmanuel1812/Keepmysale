"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import "../app/landing.css";

export function LandingPage() {
  const [navScrolled, setNavScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  // Calculator State
  const [returns, setReturns] = useState(50);
  const [aov, setAov] = useState(75);

  const navRef = useRef<HTMLElement>(null);

  // Scroll logic for Nav
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setNavScrolled(true);
      } else {
        setNavScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Intersection Observer for animations
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: "0px 0px -80px 0px",
      threshold: 0.1,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    document.querySelectorAll(".landing-reveal").forEach((el) => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  // ROI Math
  const calculateROI = () => {
    // Without KeepMySale: returns * (avg_order * 0.3 + 15)
    const without = returns * (aov * 0.3 + 15);

    // With KeepMySale: 50% of returns prevented, 30% partial refund average on those
    const partialRefundCost = returns * 0.5 * aov * 0.3;
    // Remaining 50% still returned, same cost
    const remainingReturnCost = returns * 0.5 * (aov * 0.3 + 15);
    const withKMS = partialRefundCost + remainingReturnCost;

    let pricing = 149;
    if (returns <= 30) pricing = 49;
    else if (returns <= 150) pricing = 149;
    else pricing = 299;

    const saved = without - withKMS - pricing;
    const roi = saved > 0 ? saved / pricing : 0;

    return { without, saved: Math.max(0, saved), roi };
  };

  const formatCurrency = (num: number) => {
    return "€" + Math.round(num).toLocaleString("en-US");
  };

  const { without, saved, roi } = calculateROI();

  return (
    <div className="landing-body">
      {/* NAVBAR */}
      <nav
        ref={navRef}
        className={`landing-navbar ${navScrolled ? "scrolled" : ""}`}
      >
        <div className="navbar-inner">
          <Link href="/" className="landing-logo">
            <span>Keep</span>MySale
          </Link>
          <div className={`nav-links ${mobileMenuOpen ? "open" : ""}`}>
            <a href="#features" onClick={() => setMobileMenuOpen(false)}>
              Features
            </a>
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>
              How it Works
            </a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)}>
              Pricing
            </a>
            <a href="#faq" onClick={() => setMobileMenuOpen(false)}>
              FAQ
            </a>
            <Link
              href="/dashboard"
              className="text-white hover:text-gray-300 font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              Login
            </Link>
            <Link
              href="/onboarding"
              className="landing-btn btn-primary nav-cta"
              onClick={() => setMobileMenuOpen(false)}
            >
              Start Free Trial
            </Link>
          </div>
          <button
            className={`mobile-toggle ${mobileMenuOpen ? "open" : ""}`}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-bg">
          <div className="hero-orb hero-orb-1"></div>
          <div className="hero-orb hero-orb-2"></div>
          <div className="hero-orb hero-orb-3"></div>
          <div className="hero-grid"></div>
        </div>
        <div className="hero-content">
          <div className="hero-badge">
            <span className="hero-badge-dot"></span>
            Your AI helpdesk that handles tickets AND saves you thousands on returns
          </div>
          <h1>
            Stop Losing Money
            <br />
            on <span className="gradient-text">Returns</span>
          </h1>
          <p className="hero-sub">
            AI-powered customer service that handles your tickets and saves thousands by
            preventing returns. Your customers keep the product, you keep the revenue.
          </p>
          <div className="hero-buttons">
            <Link href="/onboarding" className="landing-btn btn-primary">
              Start Free Trial
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="ml-2">
                <path
                  d="M3 8h10m0 0L9 4m4 4L9 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
            <a href="#how-it-works" className="landing-btn btn-secondary">
              See How It Works
            </a>
          </div>
          <p className="hero-meta">
            No credit card required <span>·</span> 14-day free trial <span>·</span> Cancel anytime
          </p>
          <div className="hero-trust">
            <p>
              <span className="trust-avatars">
                <span className="trust-avatar">S</span>
                <span className="trust-avatar">M</span>
                <span className="trust-avatar">L</span>
                <span className="trust-avatar">A</span>
              </span>
              Trusted by 50+ Shopify stores
            </p>
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="social-proof">
        <div className="social-proof-inner">
          <span className="social-proof-label">Integrates with</span>
          <div className="social-proof-logos">
            <div className="proof-logo">
              <svg viewBox="0 0 24 24">
                <path d="M15.34 3.41L13.79 5.77L10.95 1L7.54 6.6L6.04 4.77L1 14.5H3.55L6.1 9.75L7.6 11.5L10.95 5.93L13.79 10.7L15.29 8.39L19.53 14.5H22L15.34 3.41Z" />
                <path d="M1 16.5H22V18H1V16.5Z" />
              </svg>
              Shopify
            </div>
            <div className="proof-logo">
              <svg viewBox="0 0 24 24">
                <path d="M20 18h-2V9.25L12 13 6 9.25V18H4V6h1.2l6.8 4.25L18.8 6H20v12z" />
                <path
                  d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
              Gmail
            </div>
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="landing-section problem" id="problem">
        <div className="landing-container">
          <div className="section-header landing-reveal">
            <p className="section-label">The Problem</p>
            <h2 className="section-title">Returns Are Killing Your Margins</h2>
            <p className="section-subtitle">
              Every return costs you money — shipping, handling, depreciation. Most merchants just
              accept it. You don't have to.
            </p>
          </div>
          <div className="problem-grid">
            <div className="problem-card landing-reveal reveal-delay-1">
              <div className="problem-icon">📦</div>
              <p className="problem-stat">€15–25</p>
              <p className="problem-desc">
                per return in shipping & handling costs that eat directly into your margins
              </p>
            </div>
            <div className="problem-card landing-reveal reveal-delay-2">
              <div className="problem-icon">📉</div>
              <p className="problem-stat">20–50%</p>
              <p className="problem-desc">
                of product value lost on every return due to depreciation and restocking
              </p>
            </div>
            <div className="problem-card landing-reveal reveal-delay-3">
              <div className="problem-icon">⏰</div>
              <p className="problem-stat">Hours/week</p>
              <p className="problem-desc">
                spent on repetitive customer support emails instead of growing your business
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="landing-section how-it-works" id="how-it-works">
        <div className="landing-container">
          <div className="section-header landing-reveal">
            <p className="section-label">How It Works</p>
            <h2 className="section-title">How KeepMySale Saves Your Revenue</h2>
            <p className="section-subtitle">
              Three simple steps to turn costly returns into saved revenue — fully automated.
            </p>
          </div>
          <div className="steps">
            <div className="step landing-reveal reveal-delay-1">
              <div className="step-number">
                <span className="step-num-label">Step 1</span>
                📨
              </div>
              <h3>Customer Emails About a Return</h3>
              <p>A customer reaches out wanting to return a product. KeepMySale instantly picks it up.</p>
            </div>
            <div className="step landing-reveal reveal-delay-2">
              <div className="step-number">
                <span className="step-num-label">Step 2</span>
                🤝
              </div>
              <h3>AI Negotiates a Partial Refund</h3>
              <p>The AI offers the customer a partial refund to keep the product, escalating intelligently.</p>
              <div className="step-offers">
                <span className="step-offer">20%</span>
                <span className="step-offer-arrow">→</span>
                <span className="step-offer">35%</span>
                <span className="step-offer-arrow">→</span>
                <span className="step-offer">50%</span>
              </div>
            </div>
            <div className="step landing-reveal reveal-delay-3">
              <div className="step-number">
                <span className="step-num-label">Step 3</span>
                ✅
              </div>
              <h3>Everyone Wins</h3>
              <p>Customer keeps the product with a discount. You save on shipping, handling, and depreciation.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="landing-section features" id="features">
        <div className="landing-container">
          <div className="section-header landing-reveal">
            <p className="section-label">Features</p>
            <h2 className="section-title">Everything You Need</h2>
            <p className="section-subtitle">
              One platform to handle customer service and prevent returns — so you can focus on growing your store.
            </p>
          </div>
          <div className="features-grid">
            <div className="feature-card landing-reveal reveal-delay-1">
              <div className="feature-icon">🤖</div>
              <h3>AI Customer Service</h3>
              <p>Answers WISMO, product questions, and complaints automatically — in your customer's language.</p>
            </div>
            <div className="feature-card landing-reveal reveal-delay-2">
              <div className="feature-icon">💰</div>
              <h3>Smart Return Negotiation</h3>
              <p>Offers escalating partial refunds to prevent costly returns and keep your revenue intact.</p>
            </div>
            <div className="feature-card landing-reveal reveal-delay-3">
              <div className="feature-icon">📧</div>
              <h3>Gmail Integration</h3>
              <p>Connect with Google in 1 click. Replies come from YOUR email address — seamless and professional.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CALCULATOR */}
      <section className="landing-section calculator" id="calculator">
        <div className="landing-container">
          <div className="section-header landing-reveal">
            <p className="section-label">ROI Calculator</p>
            <h2 className="section-title">Calculate Your Savings</h2>
            <p className="section-subtitle">See how much KeepMySale can save your store every single month.</p>
          </div>
          <div className="calc-container landing-reveal">
            <div className="calc-inputs">
              <div className="calc-field">
                <label>Monthly Returns</label>
                <div className="calc-value">{returns}</div>
                <input
                  type="range"
                  min="10"
                  max="500"
                  step="5"
                  value={returns}
                  onChange={(e) => setReturns(parseInt(e.target.value))}
                  style={{
                    background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${
                      ((returns - 10) / (500 - 10)) * 100
                    }%, var(--bg-secondary) ${((returns - 10) / (500 - 10)) * 100}%, var(--bg-secondary) 100%)`,
                  }}
                />
              </div>
              <div className="calc-field">
                <label>Average Order Value</label>
                <div className="calc-value">€{aov}</div>
                <input
                  type="range"
                  min="20"
                  max="300"
                  step="5"
                  value={aov}
                  onChange={(e) => setAov(parseInt(e.target.value))}
                  style={{
                    background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${
                      ((aov - 20) / (300 - 20)) * 100
                    }%, var(--bg-secondary) ${((aov - 20) / (300 - 20)) * 100}%, var(--bg-secondary) 100%)`,
                  }}
                />
              </div>
            </div>
            <div className="calc-results">
              <div className="calc-result">
                <div className="calc-result-value red">{formatCurrency(without)}</div>
                <div className="calc-result-label">Lost without us</div>
              </div>
              <div className="calc-result highlight">
                <div className="calc-result-value green">{formatCurrency(saved)}</div>
                <div className="calc-result-label">Saved with KeepsySale</div>
              </div>
              <div className="calc-result">
                <div className="calc-result-value accent">
                  {roi > 0 ? roi.toFixed(1) + "x" : "—"}
                </div>
                <div className="calc-result-label">Return on investment</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="final-cta">
        <div className="final-cta-bg">
          <div className="final-cta-orb"></div>
        </div>
        <div className="final-cta-content landing-reveal">
          <h2>
            Ready to Stop Losing
            <br />
            Money on <span className="gradient-text">Returns</span>?
          </h2>
          <p className="section-subtitle" style={{ textAlign: "center", margin: "0 auto 40px" }}>
            Join 50+ Shopify merchants who save thousands every month with AI-powered customer service and return
            prevention.
          </p>
          <Link href="/onboarding" className="landing-btn btn-primary text-lg px-8 py-4">
            Start Your Free Trial
          </Link>
          <p className="final-cta-meta">No credit card required · Setup in under 5 minutes</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="landing-footer">
        <div className="footer-inner">
          <div className="flex flex-col md:flex-row justify-between items-center opacity-60 text-sm gap-4">
            <p>© 2026 KeepMySale. All rights reserved.</p>
            <div className="flex gap-4">
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
