"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import "../app/landing.css";

export function LandingPage() {
  const [navScrolled, setNavScrolled] = useState(false);
  const [typingText, setTypingText] = useState("");
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [activeNiche, setActiveNiche] = useState(2); // Default to Beauty
  
  // Spotlight Sequence State
  const [spotlightStep, setSpotlightStep] = useState(0);
  const [savedAmount, setSavedAmount] = useState(0);
  
  // AI Assistant Sequence State
  const [aiStep, setAiStep] = useState(0);
  const [aiTypedMessage, setAiTypedMessage] = useState("");
  
  const heroHeadline = "your Shopify returns with AI";

  // Intersection Observer for animations
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: "0px 0px -40px 0px",
      threshold: 0.15,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          
          // Trigger Spotlight Sequence
          if (entry.target.classList.contains("phone-mockup")) {
            startSpotlightSequence();
          }
          
          // Trigger AI Assistant Sequence
          if (entry.target.classList.contains("ai-card")) {
            startAiSequence();
          }
          
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    const elementsToReveal = document.querySelectorAll(
      ".hero-badge, .hero-headline, .hero-subtitle, .hero-ctas, .hero-trust, .dashboard-card, .section-badge, .section-title, .section-subtitle, .step-card, .feature-card, .spotlight-badge, .spotlight-headline, .spotlight-desc, .benefit-item, .phone-mockup, .ai-badge, .ai-headline, .ai-subtitle, .ai-bullet, .ai-card, .niches-badge, .niches-title, .niche-card, .cta-badge, .cta-title, .cta-subtitle, .value-card, .cta-panel, .faq-badge, .faq-title, .faq-item"
    );

    elementsToReveal.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  // Spotlight Animation Sequence
  const startSpotlightSequence = () => {
    const timings = [
      { step: 1, delay: 400 },
      { step: 2, delay: 1100 },
      { step: 3, delay: 1900 },
      { step: 4, delay: 2800 },
      { step: 5, delay: 3500 }, // typing indicator
      { step: 6, delay: 4200 }, // ai bubble
      { step: 7, delay: 4900 }, // saved banner
    ];

    timings.forEach(t => {
      setTimeout(() => setSpotlightStep(t.step), t.delay);
    });

    // Saved amount counter
    setTimeout(() => {
      let start = 0;
      const target = 18.50;
      const duration = 800;
      const startTime = performance.now();

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(2, -10 * progress);
        setSavedAmount(eased * target);
        if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    }, 5100);
  };

  // AI Assistant Animation Sequence
  const startAiSequence = () => {
    setTimeout(() => setAiStep(1), 600); // show customer email
    setTimeout(() => setAiStep(2), 1200); // show ai draft card
    setTimeout(() => {
      const fullText = "Hi there! Great news — your order #2847 shipped yesterday and is currently in transit. Your tracking number is NL4827391. Based on the carrier estimate, it should arrive within 1-2 business days.";
      let i = 0;
      const interval = setInterval(() => {
        if (i <= fullText.length) {
          setAiTypedMessage(fullText.slice(0, i));
          i++;
        } else {
          clearInterval(interval);
          setAiStep(3); // show buttons
        }
      }, 20);
    }, 1600);
  };

  // Niche Auto-Cycling
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveNiche(current => (current + 1) % 5);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Typing effect for Hero
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    let i = 0;
    
    // Delay start for hero headline typing
    const startTimeout = setTimeout(() => {
      const type = () => {
        if (i <= heroHeadline.length) {
          setTypingText(heroHeadline.slice(0, i));
          i++;
          timeout = setTimeout(type, 50);
        }
      };
      type();
    }, 1500);

    return () => {
      clearTimeout(startTimeout);
      clearTimeout(timeout);
    };
  }, []);

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

  return (
    <div className="landing-body">
      {/* BACKGROUND EFFECTS */}
      <div className="bg-gradient"></div>
      <div className="grid-overlay"></div>

      {/* NAVBAR */}
      <header className={`navbar ${navScrolled ? "scrolled" : ""}`}>
        <Link href="/" className="nav-logo">
          <div className="nav-logo-icon">K</div>
          <div className="nav-logo-text">Keep<span>My</span>Sale</div>
        </Link>

        <ul className="nav-links">
          <li><a href="#features">Features</a></li>
          <li><a href="#how-it-works">How It Works</a></li>
          <li><a href="#pricing">Pricing</a></li>
          <li><a href="#faq">FAQ</a></li>
        </ul>

        <div className="nav-right">
          <Link href="/login" className="nav-login">Log in</Link>
          <Link href="/signup" className="nav-cta">
            Get Started
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </Link>
        </div>
      </header>

      {/* PARTICLES */}
      <div className="particles" id="particles"></div>

      {/* HERO SECTION */}
      <section className="hero">
        <div className="hero-left">
          <div className="hero-badge">
            <div className="hero-badge-dot"></div>
            AI-Powered Customer Service
          </div>

          <h1 className="hero-headline">
            <span className="line">Save Thousands</span>
            <span className="line">On Returns.</span>
            <span className="line highlight">Automatically.</span>
          </h1>

          <p className="hero-subtitle">
            KeepMySale intercepts return requests and negotiates partial refunds with AI — saving you €15+ per
            return on logistics alone. The AI helpdesk that handles your tickets <em>and</em> keeps your revenue.
          </p>

          <div className="hero-ctas">
            <Link href="/signup" className="btn-primary">
              Start Free Trial
              <span className="arrow" style={{ marginLeft: '8px' }}>→</span>
            </Link>
            <a href="#how-it-works" className="btn-secondary">
              See How It Works
            </a>
          </div>

          <div className="hero-trust">
            <div className="trust-item">
              <div className="trust-check">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </div>
              Save €15+ per intercepted return
            </div>
            <div className="trust-item">
              <div className="trust-check">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </div>
              AI responds from your own email address
            </div>
            <div className="trust-item">
              <div className="trust-check">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </div>
              Built for Shopify — setup in under 5 minutes
            </div>
          </div>
        </div>

        <div className="hero-right">
          <div className="dashboard-card">
            <div className="card-header">
              <div className="card-header-left">
                <div className="card-icon">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <div>
                  <div className="card-title">Return Dashboard</div>
                  <div className="card-label">Live Overview</div>
                </div>
              </div>
              <div className="card-status">
                <div className="status-dot"></div>
                Active
              </div>
            </div>

            <div className="stats-grid">
              <div className="stat-box">
                <div className="stat-label">Intercepted</div>
                <div className="stat-value">47</div>
                <div className="stat-sub positive">+12 this week</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">Saved</div>
                <div className="stat-value">€2,847</div>
                <div className="stat-sub positive">+€430 today</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">Success Rate</div>
                <div className="stat-value">89%</div>
                <div className="stat-sub">Industry: 34%</div>
              </div>
            </div>

            <div className="card-divider"></div>

            <div className="email-preview">
              <div className="email-header">
                <div className="email-sender">
                  <div className="email-avatar">LV</div>
                  <div>
                    <div className="email-name">Lisa V.</div>
                    <div className="email-meta" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>via Gmail · 3 hours ago</div>
                  </div>
                </div>
                <div className="ai-badge" style={{ background: 'rgba(0, 150, 255, 0.1)', borderColor: 'rgba(0, 150, 255, 0.2)', color: '#0099ff' }}>
                  Return
                </div>
              </div>
              <div className="email-body">
                "Hi, I'd like to return order #1084. The size doesn't fit me well..."
              </div>
              <div className="email-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '14px' }}>
                <div className="ai-badge">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px' }}>
                    <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
                  </svg>
                  Negotiating — 35% Store Credit Offered
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS SECTION */}
      <section className="how-it-works" id="how-it-works">
        <div className="section-header">
          <div className="section-badge">3 Simple Steps</div>
          <h2 className="section-title">Up and Running in Minutes</h2>
          <p className="section-subtitle">
            No complex setup. No training required. Just connect, launch, and start saving on returns.
          </p>
        </div>

        <div className="steps-grid">
          {/* STEP 1: Connect Shopify */}
          <div className="step-card">
            <div className="step-top">
              <div className="step-number">01</div>
              <div className="step-icon-wrap">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="#00e0c0">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              </div>
              <div className="step-arrow">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>
            </div>

            <div className="step-title">Connect Your Shopify Store</div>
            <div className="step-tag" style={{ color: '#00e0c0' }}>Takes under 5 minutes</div>
            <p className="step-desc">
              Install KeepMySale on your Shopify store and we instantly sync your orders, customers, and tracking
              data. One-click OAuth — no technical skills needed.
            </p>

            <div className="mini-ui">
              <div className="shopify-connect-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #5e8e3e, #95bf47)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg viewBox="0 0 24 24" style={{ width: '18px', height: '18px', fill: '#fff' }}>
                      <path d="M15.34 3.27a.68.68 0 0 0-.6-.05.72.72 0 0 0-.33.43s-.42 1.3-.47 1.45a4.77 4.77 0 0 0-1.57-.53V3.5a.86.86 0 0 0-.26-.63.84.84 0 0 0-.64-.24c-.05 0-1.09.08-1.09.08A.62.62 0 0 0 9.85 3l-.29.92a7.18 7.18 0 0 0-1.59.46l-.51-1a.6.6 0 0 0-.52-.33.58.58 0 0 0-.2.04l-1.48.48a.6.6 0 0 0-.37.76l.5 1a4.4 4.4 0 0 0-1.12 1.15l-.97-.32a.6.6 0 0 0-.76.37l-.48 1.48a.6.6 0 0 0 .37.76l.97.31a5.4 5.4 0 0 0-.12 1.58l-.96.31a.6.6 0 0 0-.37.76l.48 1.48a.6.6 0 0 0 .76.37l.5-.16c.44 1.28 2.63 6.97 2.63 6.97a.73.73 0 0 0 .68.48h0l1.63-.01a.73.73 0 0 0 .7-.56L12 11.32l3.48-7.3a.69.69 0 0 0-.14-.75z" />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>Efo Testing Store</div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>Shopify Store Connected</div>
                  </div>
                </div>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(0, 200, 180, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg viewBox="0 0 24 24" style={{ width: '14px', height: '14px', fill: '#00e0c0' }}>
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                </div>
              </div>
              <div className="shopify-sync" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(0, 200, 180, 0.06)', border: '1px solid rgba(0, 200, 180, 0.12)', borderRadius: '10px', fontSize: '12px', fontWeight: 600, color: '#00e0c0' }}>
                <div className="sync-dot"></div>
                Connected & syncing
              </div>
            </div>
          </div>

          {/* STEP 2: Link Gmail */}
          <div className="step-card">
            <div className="step-top">
              <div className="step-number">02</div>
              <div className="step-icon-wrap">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="#0099ff">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
              <div className="step-arrow">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>
            </div>

            <div className="step-title">Link Your Gmail</div>
            <div className="step-tag" style={{ color: '#0099ff' }}>AI starts working instantly</div>
            <p className="step-desc">
              Connect your Gmail and our AI monitors every incoming email. It auto-classifies WISMO, FAQ, and
              return requests — then responds from your own email address.
            </p>

            <div className="mini-ui">
              <div className="email-campaign-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '16px', height: '16px', fill: '#0099ff' }}>
                    <svg viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>AI Inbox</div>
                </div>
                <div style={{ padding: '3px 10px', background: 'rgba(0, 150, 255, 0.1)', border: '1px solid rgba(0, 150, 255, 0.25)', borderRadius: '6px', fontSize: '10px', fontWeight: 700, color: '#0099ff', textTransform: 'uppercase' }}>Live</div>
              </div>
              <div className="recipient-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'linear-gradient(135deg, #4a1a6b, #6a2d8a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#fff' }}>LK</div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>Lisa K.</div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>Return · 12m ago</div>
                  </div>
                </div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#00e0c0' }}>Saved! ✓</div>
              </div>
            </div>
          </div>

          {/* STEP 3: Watch Growth */}
          <div className="step-card">
            <div className="step-top">
              <div className="step-number">03</div>
              <div className="step-icon-wrap">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="#00e0c0">
                  <line x1="12" y1="20" x2="12" y2="10" />
                  <line x1="18" y1="20" x2="18" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="16" />
                </svg>
              </div>
            </div>

            <div className="step-title">Watch Your Savings Grow</div>
            <div className="step-tag" style={{ color: '#00e0c0' }}>Results from day one</div>
            <p className="step-desc">
              Every intercepted return saves you €15+ in logistics. Track savings, success rates, and negotiation
              performance in real-time from your dashboard.
            </p>

            <div className="mini-ui">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#fff' }}>€4.8K</div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#00e0c0' }}>+€1.2K</div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>vs last month</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '50px', gap: '4px' }}>
                {[20, 35, 25, 45, 60, 85].map((h, i) => (
                  <div key={i} style={{ flex: 1, height: h + '%', background: i === 5 ? '#00e0c0' : 'rgba(255,255,255,0.1)', borderRadius: '2px' }}></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES GRID */}
      <section className="features-section" id="features">
        <div className="section-header">
          <div className="section-badge">Platform Features</div>
          <h2 className="section-title">Everything You Need to Scale</h2>
          <p className="section-subtitle">
            One platform to handle customer service and prevent returns — so you can focus on growing your store.
          </p>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon" style={{ backgroundColor: 'rgba(0, 224, 192, 0.1)', color: '#00e0c0' }}>
              <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            </div>
            <div className="feature-name">AI Customer Service</div>
            <p className="feature-desc">Automatically handle WISMO, FAQ, and general inquiries in 50+ languages with your store's tone.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon" style={{ backgroundColor: 'rgba(0, 153, 255, 0.1)', color: '#0099ff' }}>
              <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            </div>
            <div className="feature-name">Smart Negotiation</div>
            <p className="feature-desc">Our AI negotiator offers escalating store credit to prevent returns and keep your revenue.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon" style={{ backgroundColor: 'rgba(0, 224, 192, 0.1)', color: '#00e0c0' }}>
              <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
            </div>
            <div className="feature-name">Shopify Integration</div>
            <p className="feature-desc">Deep integration with Shopify to fetch order data, track shipments, and issue store credit instantly.</p>
          </div>
        </div>
      </section>

      {/* SPOTLIGHT SECTION */}
      <section className="spotlight-section">
        <div className="spotlight-left">
          <div className="section-badge">Core Technology</div>
          <h2 className="spotlight-headline">
            Turn Return Requests Into <span className="gradient-text">Retained Revenue</span>
          </h2>
          <p className="spotlight-desc">
            KeepMySale intercepts return requests and negotiates partial refunds with AI — saving you €15+ per
            return on logistics alone.
          </p>

          <div className="spotlight-benefits">
            <div className="benefit-item">
              <div className="benefit-icon teal">
                <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
              </div>
              <div className="benefit-text">
                <div className="benefit-name">Instant Detection</div>
                <div className="benefit-desc">AI detects return intent in seconds — before you even see the ticket.</div>
              </div>
            </div>
            <div className="benefit-item">
              <div className="benefit-icon blue">
                <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
              </div>
              <div className="benefit-text">
                <div className="benefit-name">Escalating Offers</div>
                <div className="benefit-desc">Starts with 20% store credit, then 35%, then 50% to save the sale.</div>
              </div>
            </div>
          </div>
        </div>

        <div className="spotlight-right">
          <div className="phone-mockup">
            <div className="phone-notch"></div>
            <div className="phone-inner">
              <div className="phone-store-header">
                <div className="phone-store-icon">
                  <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                </div>
                <div className="phone-store-name">KeepMySale AI</div>
                <div className="phone-store-label">Return Negotiation · #1084</div>
              </div>
              <div className="negotiation-chat">
                <div className={`chat-bubble customer ${spotlightStep >= 1 ? 'visible' : ''}`}>
                  Hi, I'd like to return my order. The color is different.
                </div>
                <div className={`chat-bubble ai ${spotlightStep >= 6 ? 'visible' : ''}`}>
                  I'm sorry! How about 20% store credit (€8.40) to keep it?
                </div>
                <div className={`chat-bubble accept ${spotlightStep >= 7 ? 'visible' : ''}`}>
                  ✓ Deal! I'll keep the item. Thanks!
                </div>
              </div>
              <div className={`saved-banner ${spotlightStep >= 7 ? 'visible' : ''}`}>
                <div className="saved-left">
                  <div className="saved-check"><svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg></div>
                  <div>
                    <div className="saved-label">Sale Saved!</div>
                    <div className="saved-sub">via 35% Store Credit</div>
                  </div>
                </div>
                <div className="saved-amount">€{savedAmount.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI ASSISTANT SECTION */}
      <section className="ai-section" id="ai-assistant">
        <div className="ai-left">
          <div className="ai-badge">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0099ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            AI-Powered Support
          </div>
          <h2 className="ai-headline">Your AI Email Assistant</h2>
          <p className="ai-subtitle">
            Our AI learns your store's tone, reads every customer email, and drafts perfect responses automatically — from your own Gmail address.
          </p>
          <div className="ai-bullets">
            <div className="ai-bullet">
              <div className="ai-bullet-icon blue">
                <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 10 10H12V2z" /><path d="M20 12a8 8 0 0 0-8-8v8h8z" opacity="0.4" /></svg>
              </div>
              <span className="ai-bullet-text">Learns your unique brand voice</span>
            </div>
            <div className="ai-bullet">
              <div className="ai-bullet-icon teal">
                <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
              </div>
              <span className="ai-bullet-text">Drafts personalized responses in seconds</span>
            </div>
            <div className="ai-bullet">
              <div className="ai-bullet-icon green">
                <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
              </div>
              <span className="ai-bullet-text">Classifies WISMO, returns, and FAQ automatically</span>
            </div>
          </div>
        </div>

        <div className="ai-right">
          <div className="ai-card">
            <div className="ai-card-header">
              <div className="ai-card-header-icon">
                <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><path d="M8 9h8" /><path d="M8 13h4" /></svg>
              </div>
              <div>
                <div className="ai-card-header-title">AI Response Generator</div>
                <div className="ai-card-header-sub">Powered by your brand voice</div>
              </div>
            </div>
            <div className="ai-card-body">
              <div className={`customer-email ${aiStep >= 1 ? 'visible' : ''}`}>
                <div className="customer-email-header">
                  <div className="email-stars">
                    {[1, 2, 3].map(i => <svg key={i} viewBox="0 0 24 24" style={{ fill: '#f5a623', width: '14px' }}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>)}
                    {[4, 5].map(i => <svg key={i} viewBox="0 0 24 24" style={{ fill: 'none', stroke: 'rgba(255,255,255,0.15)', strokeWidth: 2, width: '14px' }}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>)}
                  </div>
                  <span className="customer-email-label">Customer Email</span>
                </div>
                <div className="customer-email-text">
                  "I placed order #2847 three days ago but haven't received any shipping update yet. When can I expect my package?"
                </div>
              </div>
              <div className={`ai-draft ${aiStep >= 2 ? 'visible' : ''}`}>
                <div className="ai-draft-header">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#0099ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" /></svg>
                  <span className="ai-draft-label">AI Draft</span>
                  <span className="ai-draft-tone">— Professional</span>
                </div>
                <div className="ai-draft-text">
                  "{aiTypedMessage}"<span className={aiStep < 3 ? 'typed-cursor' : 'hidden'}></span>
                </div>
                <div className={`ai-draft-actions ${aiStep >= 3 ? 'visible' : ''}`}>
                  <button className="action-btn primary" onClick={() => alert('Demo approved!')}>Approve</button>
                  <button className="action-btn secondary">Edit</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* NICHES SECTION */}
      <section className="niches-section" id="niches">
        <div className="niches-header">
          <div className="niches-badge">Built For You</div>
          <h2 className="niches-title">Perfect for Every Shopify Niche</h2>
        </div>
        <div className="niches-grid">
          <div className={`niche-card ${activeNiche === 0 ? 'active' : ''}`}>
            <div className="niche-icon orange">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.38 3.46L16 2 12 5.5 8 2 3.62 3.46a1 1 0 0 0-.62 1.18l2.44 10.88A1 1 0 0 0 6.42 16H17.58a1 1 0 0 0 .98-.48L21 4.64a1 1 0 0 0-.62-1.18z" /><path d="M12 5.5V16" /></svg>
            </div>
            <div className="niche-text">
              <div className="niche-name">Fashion & Apparel</div>
              <div className="niche-desc">Reduce sizing-related returns by up to 60%</div>
            </div>
          </div>
          <div className={`niche-card ${activeNiche === 1 ? 'active' : ''}`}>
            <div className="niche-icon amber" style={{ background: 'rgba(240, 180, 40, 0.1)', border: '1px solid rgba(240, 180, 40, 0.2)' }}>
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="#f0b428"><rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>
            </div>
            <div className="niche-text">
              <div className="niche-name">Electronics</div>
              <div className="niche-desc">Save on costly device return shipping</div>
            </div>
          </div>
          <div className={`niche-card ${activeNiche === 2 ? 'active' : ''}`}>
            <div className="niche-icon teal">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /></svg>
            </div>
            <div className="niche-text">
              <div className="niche-name">Beauty & Skincare</div>
              <div className="niche-desc">Turn dissatisfied buyers into loyal fans</div>
            </div>
          </div>
          <div className={`niche-card ${activeNiche === 3 ? 'active' : ''}`}>
            <div className="niche-icon blue">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
            </div>
            <div className="niche-text">
              <div className="niche-name">Home & Living</div>
              <div className="niche-desc">Eliminate bulky furniture return costs</div>
            </div>
          </div>
          <div className={`niche-card ${activeNiche === 4 ? 'active' : ''}`}>
             <div className="niche-icon pink" style={{ background: 'rgba(220, 80, 180, 0.1)', border: '1px solid rgba(220, 80, 180, 0.2)' }}>
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="#dc50b4"><circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" /></svg>
            </div>
            <div className="niche-text">
              <div className="niche-name">Sports & Fitness</div>
              <div className="niche-desc">Keep fit-related returns at zero cost</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="cta-section" id="signup">
        <div className="cta-header">
          <div className="cta-badge">Start Saving Today</div>
          <h2 className="cta-title">Let's Fix Your <span className="gradient-text">Return Problem</span></h2>
          <p className="cta-subtitle">Sign up in under 5 minutes and see results from your very first return request.</p>
        </div>
        <div className="cta-panel">
          <div className="cta-panel-pre">5 minutes to set up · No obligation · Free trial</div>
          <h3 className="cta-panel-headline">Ready to stop losing money on returns?</h3>
          <p className="cta-panel-desc">Join 50+ Shopify merchants who save thousands every month with AI-powered return prevention.</p>
          <div className="cta-btn-wrap">
            <Link href="/signup" className="cta-signup-btn">
              Start Your Free Trial
              <span className="btn-arrow">→</span>
            </Link>
          </div>
          <p className="cta-panel-footer">No credit card required · Cancel anytime</p>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section className="faq-section" id="faq">
        <div className="faq-header">
          <div className="faq-badge">FAQ</div>
          <h2 className="faq-title">Frequently Asked Questions</h2>
        </div>
        <div className="faq-list">
          {[
            { q: "How does the AI negotiate returns?", a: "Our AI detects return intent and automatically offers escalating store credit — 20%, 35%, then 50%. The customer keeps the product, you keep the revenue." },
            { q: "How long does setup take?", a: "Under 5 minutes. Connect Shopify, link Gmail, and the AI starts working immediately. No technical skills required." },
            { q: "Will customers know it's AI?", a: "No. It responds from your own Gmail address using your brand tone and real order data. It's natural and indistinguishable from human support." }
          ].map((item, i) => (
            <div key={i} className={`faq-item ${activeFaq === i ? 'open' : ''}`}>
              <button className="faq-question" onClick={() => setActiveFaq(activeFaq === i ? null : i)}>
                <span className="faq-question-text">{item.q}</span>
                <div className="faq-chevron">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                </div>
              </button>
              <div className="faq-answer" style={{ maxHeight: activeFaq === i ? '200px' : '0' }}>
                <div className="faq-answer-inner">{item.a}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="site-footer">
        <div className="footer-divider"></div>
        <div className="footer-bottom" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '40px', opacity: 0.6, fontSize: '13px' }}>
          <p>© 2026 KeepMySale. All rights reserved.</p>
          <div style={{ display: 'flex', gap: '24px' }}>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
