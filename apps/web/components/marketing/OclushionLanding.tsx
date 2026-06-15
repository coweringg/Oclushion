"use client";

import { useLocale, useTranslations } from "next-intl";
import type { CSSProperties, FormEvent, KeyboardEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const MAX_DEMO_PROMPTS = 10;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function OclushionLanding() {
  const t = useTranslations();
  const locale = useLocale();
  const features = t.raw("features.items") as Array<{ eyebrow: string; title: string; copy: string }>;

  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [demoCount, setDemoCount] = useState(0);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("oclushion_demo_count");
      if (raw) {
        const payload = JSON.parse(raw) as { date: string; count: number };
        if (payload.date === getTodayKey()) {
          setDemoCount(payload.count);
        }
      }
    } catch {
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("oclushion_demo_count", JSON.stringify({ date: getTodayKey(), count: demoCount }));
  }, [demoCount]);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [chat]);

  const handleSend = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;
      if (demoCount >= MAX_DEMO_PROMPTS) {
        setChat((prev) => [
          ...prev,
          {
            id: generateId(),
            role: "assistant",
            content: t("demo.limitReached") ||
              "Daily demo limit reached (10 prompts). Download the desktop app for unlimited access.",
            timestamp: new Date().toISOString(),
          },
        ]);
        return;
      }

      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: trimmed,
        timestamp: new Date().toISOString(),
      };

      setChat((prev) => [...prev, userMsg]);
      setInputValue("");
      setIsLoading(true);
      setDemoCount((c) => c + 1);

      setTimeout(() => {
        const botMsg: ChatMessage = {
          id: generateId(),
          role: "assistant",
          content:
            t("demo.mockResponse") ||
            "This is a live demo — responses are simulated. In the full app, your message would go through SanoShield proxy for PII masking, then to the LLM, and back with Safe Diff applied.",
          timestamp: new Date().toISOString(),
        };
        setChat((prev) => [...prev, botMsg]);
        setIsLoading(false);
        inputRef.current?.focus();
      }, 1200);
    },
    [isLoading, demoCount, t]
  );

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleSend(inputValue);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(inputValue);
    }
  };

  useEffect(() => {
    const elements = [...document.querySelectorAll<HTMLElement>("[data-reveal]")];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 }
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <main className="ocl-page">
      {}
      <nav aria-label={t("nav.aria")} className="navbar">
        <a aria-label={t("nav.homeAria")} className="brand" href="#top">
          <img alt="" aria-hidden="true" className="brand-logo" src="/brand/logo.png" />
          <span>Oclushion</span>
        </a>
        <div aria-label={t("nav.aria")} className="nav-links">
          <a href="#producto">{t("nav.product")}</a>
          <a href="#workflow">{t("nav.workflow")}</a>
          <a href="#seguridad">{t("nav.security")}</a>
          <a href="#precios">{t("nav.pricing")}</a>
          <a href="#recursos">{t("nav.resources")}</a>
        </div>
        <div className="nav-actions">
          <LanguageSwitcher />
          <a className="demo-button" href="#download">
            <DownloadIcon />
            <span>Download for Windows</span>
          </a>
        </div>
      </nav>

      {}
      <section className="hero" id="top">
        <img alt="" aria-hidden="true" className="background-asset" src="/brand/home-background.png" />
        <div className="content">
          <div className="badge ocl-stagger-1">
            <span aria-hidden="true" className="badge-dot" />
            <span>{t("hero.kicker")}</span>
          </div>
          <h1 className="ocl-stagger-2">
            {t("hero.line1")}
            <br />
            {t("hero.line2Prefix")} <span>{t("hero.line2Accent")}</span>
          </h1>
          <p className="subtitle ocl-stagger-3">{t("hero.description")}</p>
          <div className="cta-row ocl-stagger-4">
            <a className="primary-cta" href="#download">
              <DownloadIcon />
              <span>Download for Windows</span>
            </a>
            <a className="secondary-cta" href={`/${locale}/demo`}>
              <PlayIcon />
              <span>Try live demo</span>
            </a>
          </div>
          <div aria-label="Oclushion features" className="feature-pills ocl-stagger-5">
            <span className="pill purple"><CubeIcon />{t("hero.featureSkillpacks")}</span>
            <span className="pill violet"><GraphIcon />{t("hero.featureRepoGraph")}</span>
            <span className="pill cyan"><SparkIcon />{t("hero.featureTokenOptimizer")}</span>
            <span className="pill purple"><CodeIcon />{t("hero.featureSafeDiff")}</span>
            <span className="pill mint"><ShieldIcon />{t("hero.featureSanoProtection")}</span>
          </div>
        </div>
      </section>

      {}
      <section className="premium-section demo-section section-grid-bg" id="demo" data-reveal>
        <div className="section-heading centered">
          <span className="demo-kicker">Live Demo</span>
          <h2>Try Oclushion in your browser</h2>
          <p>No installation required. {MAX_DEMO_PROMPTS - demoCount} prompts remaining today.</p>
        </div>
        <div className="demo-chat-container">
          <div className="demo-chat" ref={chatRef}>
            {chat.length === 0 && (
              <div className="demo-empty">
                <p>Send your first prompt to see Oclushion in action.</p>
                <ul>
                  <li>"Explain this React component"</li>
                  <li>"Refactor this function to TypeScript"</li>
                  <li>"What security issues do you see?"</li>
                </ul>
              </div>
            )}
            {chat.map((msg) => (
              <div key={msg.id} className={`demo-message ${msg.role}`}>
                <div className="demo-message-avatar">{msg.role === "user" ? "You" : "AI"}</div>
                <div className="demo-message-content">
                  <p>{msg.content}</p>
                  <time dateTime={msg.timestamp}>
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </time>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="demo-message assistant loading">
                <div className="demo-message-avatar">AI</div>
                <div className="demo-message-content">
                  <span className="demo-dots">Thinking</span>
                </div>
              </div>
            )}
          </div>
          <form className="demo-input-bar" onSubmit={onSubmit}>
            <textarea
              ref={inputRef}
              rows={1}
              placeholder="Ask Oclushion anything..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={isLoading || demoCount >= MAX_DEMO_PROMPTS}
            />
            <button type="submit" disabled={isLoading || !inputValue.trim()}>
              <ArrowRightIcon />
            </button>
          </form>
          <div className="demo-install-bar">
            <span>Want the full experience?</span>
            <a href="#download" className="primary-cta compact">
              <DownloadIcon /> Install Desktop App
            </a>
          </div>
        </div>
      </section>

      {}
      <section className="premium-section product-section section-grid-bg" id="producto">
        <div className="section-heading feature-heading" data-reveal>
          <span>{t("features.kicker")}</span>
          <h2>
            {t("features.headlinePrefix")} <strong>{t("features.headlineAccent")}</strong>
          </h2>
          <p>{t("features.description")}</p>
        </div>
        <div className="features-grid">
          {features.map(({ eyebrow, title, copy }, index) => {
            const isTopDifferentiator = index < 4;
            return (
              <article
                className={`feature-card ${isTopDifferentiator ? "feature-card--top" : ""}`}
                data-reveal
                key={title}
                style={{ "--delay": `${index * 70}ms` } as CSSProperties}
              >
                {isTopDifferentiator ? <span className="feature-badge">Top Differentiator</span> : null}
                <div className="feature-icon">{featureIcon(index)}</div>
                <h3>{title}</h3>
                <p>{copy}</p>
                <a href="#workflow">{t("features.learnMore")} <ArrowRightIcon /></a>
                <span aria-hidden="true" className="feature-number">{eyebrow}</span>
              </article>
            );
          })}
        </div>
      </section>

      {}
      {
}

      <footer className="site-footer">
        <div className="footer-brand">
          <a className="brand" href="#top">
            <span aria-hidden="true" className="brand-mark" />
            <span>Oclushion</span>
          </a>
          <p>{t("footer.copyright")}</p>
        </div>
      </footer>
    </main>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
    </svg>
  );
}
function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="m10 8 6 4-6 4V8z" />
    </svg>
  );
}
function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2v5M12 17v5M4.2 4.2l3.6 3.6M16.2 16.2l3.6 3.6M2 12h5M17 12h5M4.2 19.8l3.6-3.6M16.2 7.8l3.6-3.6" />
    </svg>
  );
}
function CubeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3zM4 7.5l8 4.5 8-4.5M12 12v9" />
    </svg>
  );
}
function GraphIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="6" cy="18" r="2" />
      <circle cx="12" cy="6" r="2" />
      <circle cx="18" cy="18" r="2" />
      <path d="m7 16 4-10M13 6l4 10" />
    </svg>
  );
}
function CodeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m8 8-4 4 4 4M16 8l4 4-4 4" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 5 6v5c0 4.4 2.8 8.3 7 10 4.2-1.7 7-5.6 7-10V6l-7-3z" />
      <path d="m9 12 2 2 4-5" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
    </svg>
  );
}
function ArrowRightIcon() {
  return (
    <svg viewBox="0 0  
24 24" aria-hidden="true">
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}
function featureIcon(index: number) {
  const icons = [
    <ShieldIcon key="shield" />,
    <CodeIcon key="terminal" />,
    <GraphIcon key="chats" />,
    <CodeIcon key="diff" />,
    <LockIcon key="ownership" />,
    <CubeIcon key="skillpacks" />,
    <SparkIcon key="voice" />,
    <ShieldIcon key="kanban" />,
    <GraphIcon key="multiplayer" />,
    <CodeIcon key="deploy" />,
  ];
  return icons[index] ?? <SparkIcon />;
}
