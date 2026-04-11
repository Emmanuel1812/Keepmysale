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
      threshold: 0.1, // Lower threshold for better trigger reliability
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

    // Observe all reveal-enabled elements
    const elementsToReveal = document.querySelectorAll(".reveal, .section-badge, .section-title, .feature-card, .step-card, .niche-card, .faq-item");

    elementsToReveal.forEach((el) => observer.observe(el));

    // Force trigger for elements already in view (like Hero)
    setTimeout(() => {
      elementsToReveal.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight) {
          el.classList.add("visible");
        }
      });
    }, 100);

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
      <div className="particles" id="particles"></div>      {/* HERO SECTION */}
      <section className="hero">
        <div className="hero-left reveal">
          <div className="hero-badge">
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

          <div className="nav-right" style={{ justifyContent: 'flex-start', marginTop: '36px' }}>
             <Link href="/signup" className="nav-cta" style={{ padding: '14px 32px', fontSize: '16px' }}>
              Start Free Trial
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '10px' }}>
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </Link>
          </div>
        </div>

        <div className="hero-right reveal">
          <div className="dashboard-card">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="card-icon">
                  <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700 }}>Return Dashboard</div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Real-time savings</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: '#00e0c0' }}>
                 <div style={{ width: '6px', height: '6px', background: '#00e0c0', borderRadius: '50%' }}></div>
                 Active
              </div>
            </div>

            <div className="stats-grid">
              <div className="stat-box">
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Intercepted</div>
                <div className="stat-value">47</div>
              </div>
              <div className="stat-box">
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Saved Revenue</div>
                <div className="stat-value">€2,847</div>
              </div>
              <div className="stat-box">
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Success Rate</div>
                <div className="stat-value">89%</div>
              </div>
            </div>

            <div className="email-preview">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div className="email-avatar">LV</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', fontWeight: 700 }}>Lisa V.</div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>Return Request · Order #1084</div>
                </div>
                <div style={{ padding: '4px 8px', background: 'rgba(0,150,255,0.1)', border: '1px solid rgba(0,150,255,0.2)', borderRadius: '6px', fontSize: '10px', fontWeight: 700, color: '#0099ff' }}>
                  Negotiating
                </div>
              </div>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
                "Hi, I'd like to return order #1084. The size doesn't fit me well..."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS SECTION */}
      <section className="how-it-works" id="how-it-works">
        <div className="section-header reveal">
          <div className="section-badge">How It Works</div>
          <h2 className="section-title">Up and Running in Minutes</h2>
          <p className="hero-subtitle" style={{ margin: '0 auto' }}>
            No complex setup. No training required. Just connect and start saving on returns.
          </p>
        </div>

        <div className="steps-grid">
          {/* STEP 1: Connect Shopify */}
          <div className="step-card reveal">
            <div className="step-icon-wrap">
              <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '10px' }}>Connect Shopify</div>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, marginBottom: '20px' }}>
              Install KeepMySale and we instantly sync your orders and customers.
            </p>
            <div className="mini-ui">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="shopify-logo">
                  <svg viewBox="0 0 24 24">
                    <path d="M15.34 3.27a.68.68 0 0 0-.6-.05.72.72 0 0 0-.33.43s-.42 1.3-.47 1.45a4.77 4.77 0 0 0-1.57-.53V3.5a.86.86 0 0 0-.26-.63.84.84 0 0 0-.64-.24c-.05 0-1.09.08-1.09.08A.62.62 0 0 0 9.85 3l-.29.92a7.18 7.18 0 0 0-1.59.46l-.51-1a.6.6 0 0 0-.52-.33.58.58 0 0 0-.2.04l-1.48.48a.6.6 0 0 0-.37.76l.5 1a4.4 4.4 0 0 0-1.12 1.15l-.97-.32a.6.6 0 0 0-.76.37l-.48 1.48a.6.6 0 0 0 .37.76l.97.31a5.4 5.4 0 0 0-.12 1.58l-.96.31a.6.6 0 0 0-.37.76l.48 1.48a.6.6 0 0 0 .76.37l.5-.16c.44 1.28 2.63 6.97 2.63 6.97a.73.73 0 0 0 .68.48h0l1.63-.01a.73.73 0 0 0 .7-.56L12 11.32l3.48-7.3a.69.69 0 0 0-.14-.75z" />
                  </svg>
                </div>
                <div>
                   <div style={{ fontSize: '12px', fontWeight: 600 }}>Syncing...</div>
                   <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>Order #2847 fetched</div>
                </div>
              </div>
            </div>
          </div>

          {/* STEP 2: Link Gmail */}
          <div className="step-card reveal">
            <div className="step-icon-wrap" style={{ background: 'rgba(0,150,255,0.1)', borderColor: 'rgba(0,150,255,0.2)' }}>
              <svg viewBox="0 0 24 24" stroke="#0099ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '10px' }}>Link Your Gmail</div>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, marginBottom: '20px' }}>
              Connect your inbox and our AI monitors every incoming return request.
            </p>
            <div className="mini-ui">
               <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 700, color: '#0099ff' }}>
                 <div style={{ width: '6px', height: '6px', background: '#0099ff', borderRadius: '50%' }}></div>
                 Inbox Polling
               </div>
            </div>
          </div>

          {/* STEP 3: Save Revenue */}
          <div className="step-card reveal">
            <div className="step-icon-wrap" style={{ background: 'rgba(255,160,50,0.1)', borderColor: 'rgba(255,160,50,0.2)' }}>
              <svg viewBox="0 0 24 24" stroke="#ffa032" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="20" x2="12" y2="10" />
                <line x1="18" y1="20" x2="18" y2="4" />
                <line x1="6" y1="20" x2="6" y2="16" />
              </svg>
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '10px' }}>Save Revenue</div>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, marginBottom: '20px' }}>
              Watch your savings grow as AI keeps your revenue in the store.
            </p>
            <div className="mini-ui">
               <div style={{ fontSize: '16px', fontWeight: 800, color: '#00e0c0' }}>+€1,240</div>
               <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>Saved this month</div>
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
        <div className="spotlight-left reveal">
          <div className="section-badge">Return Prevention</div>
          <h2 className="section-title" style={{ textAlign: 'left' }}>
            Turn Returns Into <span className="gradient-text">Retained Revenue</span>
          </h2>
          <p className="hero-subtitle" style={{ textAlign: 'left' }}>
            Negotiate partial refunds automatically with AI — saving you €15+ per return on logistics alone.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '30px' }}>
            <div className="reveal" style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
               <div className="feature-icon teal" style={{ width: '42px', height: '42px', flexShrink: 0 }}>
                 <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
               </div>
               <div>
                  <div style={{ fontSize: '15px', fontWeight: 700 }}>Instant Detection</div>
                  <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>AI detects return intent in seconds.</div>
               </div>
            </div>
            <div className="reveal" style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
               <div className="feature-icon teal" style={{ width: '42px', height: '42px', flexShrink: 0, background: 'rgba(0,150,255,0.1)', borderColor: 'rgba(0,150,255,0.2)' }}>
                 <svg viewBox="0 0 24 24" stroke="#0099ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /></svg>
               </div>
               <div>
                  <div style={{ fontSize: '15px', fontWeight: 700 }}>Escalating Offers</div>
                  <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>Starts with 20% credit, then 35%, then 50%.</div>
               </div>
            </div>
          </div>
        </div>

        <div className="spotlight-right">
          <div className="phone-mockup reveal">
            <div className="phone-inner">
              <div className="phone-store-header">
                <div className="phone-store-icon">
                  <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                </div>
                <div style={{ fontSize: '12px', fontWeight: 700 }}>Return Negotiations</div>
                <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>Order #1084</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', height: '220px', marginTop: '10px' }}>
                <div className={`chat-bubble customer ${spotlightStep >= 1 ? 'visible' : ''}`}>
                  Hi, I'd like to return order #1084...
                </div>
                <div className={`chat-bubble ai ${spotlightStep >= 6 ? 'visible' : ''}`}>
                  How about 35% store credit (€14.70) to keep the product?
                </div>
                <div className={`chat-bubble customer ${spotlightStep >= 7 ? 'visible' : ''}`} style={{ alignSelf: 'flex-start', background: 'rgba(0,200,180,0.1)', borderColor: 'rgba(0,200,180,0.2)' }}>
                  ✓ Deal! I'll keep it.
                </div>
              </div>

              <div className={`saved-banner ${spotlightStep >= 7 ? 'visible' : ''}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className="saved-check">
                    <svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 800 }}>Sale Saved!</div>
                    <div style={{ fontSize: '9px', color: '#00e0c0', opacity: 0.7 }}>via Store Credit</div>
                  </div>
                </div>
                <div className="saved-amount">€{savedAmount.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI ASSISTANT SECTION */}
      <section className="ai-assistant-section">
        <div className="ai-left reveal">
          <div className="section-badge">AI Assistant</div>
          <h2 className="section-title" style={{ textAlign: 'left' }}>Your AI Inbox Helper</h2>
          <p className="hero-subtitle" style={{ textAlign: 'left' }}>
            Our AI reads every customer email and drafts perfect responses automatically — from your own business address.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px' }}>
             <div className="reveal" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
               <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0099ff' }}></div>
               <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>Learns your brand voice</span>
             </div>
             <div className="reveal" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
               <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00e0c0' }}></div>
               <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>Drafts responses in seconds</span>
             </div>
          </div>
        </div>

        <div className="ai-right">
          <div className="ai-card reveal">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
               <div className="ai-card-header-icon">
                 <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
               </div>
               <div>
                  <div style={{ fontSize: '14px', fontWeight: 700 }}>AI Email Draft</div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Powered by brand voice</div>
               </div>
            </div>

            <div className={`customer-email ${aiStep >= 1 ? 'visible' : ''}`}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.3)', marginBottom: '6px' }}>CUSTOMER EMAIL</div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
                  "When can I expect order #2847? Starting to get worried."
                </div>
            </div>

            <div className={`ai-draft ${aiStep >= 2 ? 'visible' : ''}`}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#0099ff', marginBottom: '6px' }}>AI SUGGESTION — PROFESSIONAL TONE</div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>
                   {aiTypedMessage}<span className="typed-cursor"></span>
                </div>
                <div className={`ai-draft-actions ${aiStep >= 3 ? 'visible' : ''}`}>
                    <button className="action-btn primary">Approve</button>
                    <button className="action-btn secondary">Edit</button>
                </div>
            </div>
          </div>
        </div>
      </section>

      {/* NICHES SECTION */}
      <section className="niches-section" id="niches">
        <div className="section-header reveal">
           <div className="section-badge">Built For You</div>
           <h2 className="section-title">Perfect for Every Shopify Niche</h2>
        </div>
        <div className="niches-grid">
          {[
            { id: 0, name: "Fashion & Apparel", desc: "Reduce sizing returns by 60%", icon: "orange", path: "M20.38 3.46L16 2 12 5.5 8 2 3.62 3.46a1 1 0 0 0-.62 1.18l2.44 10.88A1 1 0 0 0 6.42 16H17.58a1 1 0 0 0 .98-.48L21 4.64a1 1 0 0 0-.62-1.18z" },
            { id: 1, name: "Electronics", desc: "Save on device return costs", icon: "amber", path: "M5 2h14a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" },
            { id: 2, name: "Beauty & Skincare", desc: "Turn churn into loyal fans", icon: "teal", path: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" },
            { id: 3, name: "Home & Living", desc: "Eliminate bulky return logistics", icon: "blue", path: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" },
            { id: 4, name: "Sports & Fitness", desc: "Keep profit in your store", icon: "pink", path: "M12 8v4l3 3" }
          ].map((niche) => (
            <div key={niche.id} className={`niche-card reveal ${activeNiche === niche.id ? 'active' : ''}`}>
              <div className={`niche-icon ${niche.icon}`}>
                <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={niche.path} />
                </svg>
              </div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>{niche.name}</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>{niche.desc}</div>
            </div>
          ))}
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
      <footer className="footer reveal">
        <div className="footer-grid">
           <div>
              <Link href="/" className="nav-logo" style={{ marginBottom: '20px' }}>
                <div className="nav-logo-icon">K</div>
                <div className="nav-logo-text">Keep<span>My</span>Sale</div>
              </Link>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
                The AI helpdesk that handles your tickets and keeps your revenue.
              </p>
           </div>
           <div>
              <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '20px' }}>Product</div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>
                <li><a href="#features">Features</a></li>
                <li><a href="#how-it-works">How It Works</a></li>
                <li><a href="#pricing">Pricing</a></li>
              </ul>
           </div>
           <div>
              <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '20px' }}>Company</div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>
                <li><a href="#">About Us</a></li>
                <li><a href="#">Contact</a></li>
                <li><a href="/privacy">Privacy Policy</a></li>
              </ul>
           </div>
           <div>
              <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '20px' }}>Support</div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>
                <li><a href="#faq">FAQ</a></li>
                <li><a href="#">Documentation</a></li>
                <li><a href="#">API Status</a></li>
              </ul>
           </div>
        </div>
        <div style={{ marginTop: '60px', paddingTop: '30px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>
           <p>© 2026 KeepMySale. All rights reserved.</p>
           <div style={{ display: 'flex', gap: '20px' }}>
              <a href="#">Twitter</a>
              <a href="#">LinkedIn</a>
           </div>
        </div>
      </footer>
    </div>
  );
}
