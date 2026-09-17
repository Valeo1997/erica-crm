"use client";

import React from "react";
import Link from "next/link";

// Inline Button Component
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "ghost" | "gradient";
  size?: "default" | "sm" | "lg";
  children: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "default", size = "default", className = "", children, ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

    const variants = {
      default: "bg-white text-black hover:bg-gray-100",
      secondary: "bg-gray-800 text-white hover:bg-gray-700",
      ghost: "hover:bg-gray-800/50 text-white",
      gradient: "bg-gradient-to-b from-white via-white/95 to-white/60 text-black hover:scale-105 active:scale-95"
    };

    const sizes = {
      default: "h-10 px-4 py-2 text-sm",
      sm: "h-10 px-5 text-sm",
      lg: "h-12 px-8 text-base"
    };

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

// Icons
const ArrowRight = ({ className = "", size = 16 }: { className?: string; size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

const Menu = ({ className = "", size = 24 }: { className?: string; size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <line x1="4" x2="20" y1="12" y2="12" />
    <line x1="4" x2="20" y1="6" y2="6" />
    <line x1="4" x2="20" y1="18" y2="18" />
  </svg>
);

const X = ({ className = "", size = 24 }: { className?: string; size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

const CopyIcon = ({ className = "", size = 16 }: { className?: string; size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </svg>
);

const CheckIcon = ({ className = "", size = 16 }: { className?: string; size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const ExternalIcon = ({ className = "", size = 16 }: { className?: string; size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M15 3h6v6" />
    <path d="M10 14 21 3" />
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </svg>
);

// Copy-to-clipboard button with "Copied" feedback
const CopyButton = ({ text, label = "Copy" }: { text: string; label?: string }) => {
  const [copied, setCopied] = React.useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors cursor-pointer"
    >
      {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
      {copied ? "Copied" : label}
    </button>
  );
};

// Navigation Component
const Navigation = React.memo(() => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const links = [
    { href: "#getting-started", label: "Getting started" },
    { href: "#components", label: "Components" },
    { href: "#documentation", label: "Documentation" },
  ];

  return (
    <header className="fixed top-0 w-full z-50 border-b border-gray-800/50 bg-black/80 backdrop-blur-md">
      <nav className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <a href="#top" className="text-xl font-semibold text-white hover:text-white/80 transition-colors">
            Logo
          </a>

          <div className="hidden md:flex items-center justify-center gap-8 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            {links.map((l) => (
              <a key={l.href} href={l.href} className="text-sm text-white/60 hover:text-white transition-colors">
                {l.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-4">
            <Link href="/login">
              <Button type="button" variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
            <Link href="/signup">
              <Button type="button" variant="default" size="sm">
                Sign Up
              </Button>
            </Link>
          </div>

          <button
            type="button"
            className="md:hidden text-white cursor-pointer"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="md:hidden bg-black/95 backdrop-blur-md border-t border-gray-800/50 animate-[slideDown_0.3s_ease-out]">
          <div className="px-6 py-4 flex flex-col gap-4">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm text-white/60 hover:text-white transition-colors py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                {l.label}
              </a>
            ))}
            <div className="flex flex-col gap-2 pt-4 border-t border-gray-800/50">
              <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                <Button type="button" variant="ghost" size="sm" className="w-full">
                  Sign in
                </Button>
              </Link>
              <Link href="/signup" onClick={() => setMobileMenuOpen(false)}>
                <Button type="button" variant="default" size="sm" className="w-full">
                  Sign Up
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
});

Navigation.displayName = "Navigation";

// Hero Component
const Hero = React.memo(() => {
  const scrollToStart = () => {
    document.querySelector("#getting-started")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section
      className="relative min-h-screen flex flex-col items-center justify-start px-6 py-20 md:py-24"
      style={{
        animation: "fadeIn 0.6s ease-out"
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');

        * {
          font-family: 'Poppins', sans-serif;
        }

        html {
          scroll-behavior: smooth;
        }

        section[id] {
          scroll-margin-top: 96px;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      <aside className="mb-8 inline-flex flex-wrap items-center justify-center gap-2 px-4 py-2 rounded-full border border-gray-700 bg-gray-800/50 backdrop-blur-sm max-w-full">
        <span className="text-xs text-center whitespace-nowrap" style={{ color: '#9ca3af' }}>
          New version of template is out!
        </span>
        <a
          href="#new-version"
          className="flex items-center gap-1 text-xs hover:text-white transition-all active:scale-95 whitespace-nowrap"
          style={{ color: '#9ca3af' }}
          aria-label="Read more about the new version"
        >
          Read more
          <ArrowRight size={12} />
        </a>
      </aside>

      <h1
        className="text-4xl md:text-5xl lg:text-6xl font-medium text-center max-w-3xl px-6 leading-tight mb-6"
        style={{
          background: "linear-gradient(to bottom, #ffffff, #ffffff, rgba(255, 255, 255, 0.6))",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          letterSpacing: "-0.05em"
        }}
      >
        Give your big idea <br />the website it deserves
      </h1>

      <p className="text-sm md:text-base text-center max-w-2xl px-6 mb-10" style={{ color: '#9ca3af' }}>
        Landing page kit template with React, Shadcn/ui and Tailwind <br />that you can copy/paste into your project.
      </p>

      <div className="flex items-center gap-4 relative z-10 mb-16">
        <Button
          type="button"
          variant="gradient"
          size="lg"
          className="rounded-lg flex items-center justify-center"
          aria-label="Get started with the template"
          onClick={scrollToStart}
        >
          Get started
          <ArrowRight size={16} />
        </Button>
      </div>

      <div className="w-full max-w-5xl relative pb-20">
        <div
          className="absolute left-1/2 w-[90%] pointer-events-none z-0"
          style={{
            top: "-23%",
            transform: "translateX(-50%)"
          }}
          aria-hidden="true"
        >
          <img
            src="https://i.postimg.cc/Ss6yShGy/glows.png"
            alt=""
            className="w-full h-auto"
            loading="eager"
          />
        </div>

        <div className="relative z-10">
          <img
            src="https://i.postimg.cc/SKcdVTr1/Dashboard2.png"
            alt="Dashboard preview showing analytics and metrics interface"
            className="w-full h-auto rounded-lg shadow-2xl"
            loading="eager"
          />
        </div>
      </div>
    </section>
  );
});

Hero.displayName = "Hero";

// Section shell
const Section = ({ id, kicker, title, children }: { id: string; kicker: string; title: string; children: React.ReactNode }) => (
  <section id={id} className="relative max-w-5xl mx-auto px-6 py-20 md:py-28">
    <p className="text-xs uppercase tracking-[0.2em] mb-3" style={{ color: '#6b7280' }}>{kicker}</p>
    <h2 className="text-2xl md:text-4xl font-medium text-white mb-10" style={{ letterSpacing: "-0.03em" }}>{title}</h2>
    {children}
  </section>
);

// What's new (#new-version — target of the hero pill "Read more")
const WhatsNew = () => {
  const items = [
    { version: "v2.0", title: "Dashboard blocks", body: "A full analytics dashboard example with charts, stat cards and a sidebar layout — the preview image above." },
    { version: "v1.4", title: "Poppins type system", body: "The whole kit moved to Poppins with a tighter heading scale and gradient headline treatment." },
    { version: "v1.2", title: "Mobile navigation", body: "The header gained an animated slide-down menu for small screens." },
  ];
  return (
    <Section id="new-version" kicker="Changelog" title="What's new in the kit">
      <div className="flex flex-col gap-4">
        {items.map((it) => (
          <div key={it.version} className="rounded-xl border border-gray-800 bg-gray-900/40 p-6 hover:border-gray-700 transition-colors">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs px-2 py-0.5 rounded-full border border-gray-700 text-white/70">{it.version}</span>
              <h3 className="text-white font-medium">{it.title}</h3>
            </div>
            <p className="text-sm" style={{ color: '#9ca3af' }}>{it.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
};

// Getting started (#getting-started — nav + hero button target)
const GettingStarted = () => {
  const steps = [
    { n: "1", title: "Pick a component", body: "Browse the components below and find the block you need." },
    { n: "2", title: "Copy the code", body: "Hit the copy button on any card — the snippet lands on your clipboard." },
    { n: "3", title: "Paste & ship", body: "Drop it into your app. It's plain React + Tailwind, no lock-in." },
  ];
  return (
    <Section id="getting-started" kicker="Getting started" title="Up and running in three steps">
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        {steps.map((s) => (
          <div key={s.n} className="rounded-xl border border-gray-800 bg-gray-900/40 p-6 hover:border-gray-700 transition-colors">
            <div className="w-8 h-8 rounded-full bg-white text-black text-sm font-semibold flex items-center justify-center mb-4">{s.n}</div>
            <h3 className="text-white font-medium mb-2">{s.title}</h3>
            <p className="text-sm" style={{ color: '#9ca3af' }}>{s.body}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-gray-800 bg-black p-5 flex items-center justify-between gap-4">
        <code className="text-sm text-white/80 overflow-x-auto whitespace-nowrap">npx shadcn@latest add button</code>
        <CopyButton text="npx shadcn@latest add button" />
      </div>
    </Section>
  );
};

// Components showcase (#components — nav target)
const ComponentsShowcase = () => {
  const demos: { name: string; snippet: string; el: React.ReactNode }[] = [
    { name: "Default", snippet: `<Button variant="default">Click me</Button>`, el: <Button variant="default">Click me</Button> },
    { name: "Secondary", snippet: `<Button variant="secondary">Click me</Button>`, el: <Button variant="secondary">Click me</Button> },
    { name: "Ghost", snippet: `<Button variant="ghost">Click me</Button>`, el: <Button variant="ghost">Click me</Button> },
    { name: "Gradient", snippet: `<Button variant="gradient" size="lg">Click me</Button>`, el: <Button variant="gradient" size="lg" className="rounded-lg">Click me</Button> },
  ];
  return (
    <Section id="components" kicker="Components" title="The building blocks, live">
      <div className="grid sm:grid-cols-2 gap-4">
        {demos.map((d) => (
          <div key={d.name} className="rounded-xl border border-gray-800 bg-gray-900/40 p-6 hover:border-gray-700 transition-colors">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white font-medium">{d.name}</h3>
              <CopyButton text={d.snippet} label="Copy code" />
            </div>
            <div className="flex items-center justify-center min-h-16 rounded-lg border border-dashed border-gray-800 bg-black/40 py-6">
              {d.el}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
};

// Documentation (#documentation — nav target; real external destinations)
const DocsSection = () => {
  const docs = [
    { name: "Next.js", body: "The React framework this page runs on.", href: "https://nextjs.org/docs" },
    { name: "Tailwind CSS", body: "Utility-first styling used by every block.", href: "https://tailwindcss.com/docs" },
    { name: "shadcn/ui", body: "The component pattern this kit follows.", href: "https://ui.shadcn.com" },
    { name: "21st.dev", body: "Where this template came from.", href: "https://21st.dev" },
  ];
  return (
    <Section id="documentation" kicker="Documentation" title="Read the real docs">
      <div className="grid sm:grid-cols-2 gap-4">
        {docs.map((d) => (
          <a
            key={d.name}
            href={d.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-xl border border-gray-800 bg-gray-900/40 p-6 hover:border-gray-600 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-white font-medium">{d.name}</h3>
              <ExternalIcon size={14} className="text-white/40 group-hover:text-white transition-colors" />
            </div>
            <p className="text-sm" style={{ color: '#9ca3af' }}>{d.body}</p>
          </a>
        ))}
      </div>
    </Section>
  );
};

// Footer
const Footer = () => (
  <footer className="border-t border-gray-800/50">
    <div className="max-w-5xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
      <a href="#top" className="text-white font-semibold hover:text-white/80 transition-colors">Logo</a>
      <div className="flex items-center gap-6">
        <a href="#getting-started" className="text-xs text-white/60 hover:text-white transition-colors">Getting started</a>
        <a href="#components" className="text-xs text-white/60 hover:text-white transition-colors">Components</a>
        <a href="#documentation" className="text-xs text-white/60 hover:text-white transition-colors">Documentation</a>
      </div>
      <p className="text-xs" style={{ color: '#6b7280' }}>Template preview — running at /preview</p>
    </div>
  </footer>
);

// Main Component
export default function Component() {
  return (
    <main id="top" className="min-h-screen bg-black text-white">
      <Navigation />
      <Hero />
      <WhatsNew />
      <GettingStarted />
      <ComponentsShowcase />
      <DocsSection />
      <Footer />
    </main>
  );
}
