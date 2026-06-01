import React from 'react';

// ── Icons (inline Lucide paths, MIT) ────────────────────────────────────────

const ICON_PATHS: Record<string, string> = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M12 3a6.36 6.36 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  github: '<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/>',
  twitter: '<path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/>',
  linkedin: '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/>',
  arrowUpRight: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
  arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  arrowLeft: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  monitor: '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
};

interface IconProps {
  name: string;
  size?: number;
  strokeWidth?: number;
  style?: React.CSSProperties;
}

export function Icon({ name, size = 18, strokeWidth = 2, style }: IconProps) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round"
      style={style} aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] || '' }}
    />
  );
}

// External link with arrow — nowrap keeps the arrow glued to its label
interface ExtProps {
  href: string;
  children: React.ReactNode;
}
export function Ext({ href, children }: ExtProps) {
  return (
    <a href={href} target="_blank" rel="noreferrer" style={{ whiteSpace: 'nowrap' }}>
      {children}
      <Icon name="arrowUpRight" size={15} strokeWidth={2.2}
        style={{ verticalAlign: '-1px', marginLeft: '3px', opacity: 0.5 }} />
    </a>
  );
}

export const SOCIALS: [string, string, string][] = [
  ['github',   'GitHub',   'https://github.com/homj'],
  ['twitter',  'X',        'https://twitter.com/homiathome'],
  ['linkedin', 'LinkedIn', 'https://www.linkedin.com/in/johannes-homeier/'],
];

// ── useTheme ─────────────────────────────────────────────────────────────────
// Theme preference: 'light' | 'dark' | 'auto' (auto follows the OS). Default 'auto'.
// State starts at a deterministic default so SSR and the first client render
// agree (no hydration mismatch); the stored preference is loaded in an effect
// after mount. Persistence happens on user choice only — never as a render
// side-effect — so the initial render can't clobber the saved value.
export function useTheme() {
  const [theme, setTheme] = React.useState<string>('auto');

  // Load the saved preference once, after hydration.
  React.useEffect(() => {
    const stored = localStorage.getItem('jh-theme');
    if (stored && stored !== theme) setTheme(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resolve to data-theme on <html> whenever the preference changes.
  React.useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const resolved = theme === 'auto' ? (mql.matches ? 'dark' : 'light') : theme;
      document.documentElement.setAttribute('data-theme', resolved);
    };
    apply();
    if (theme === 'auto') {
      mql.addEventListener('change', apply);
      return () => mql.removeEventListener('change', apply);
    }
  }, [theme]);

  const choose = React.useCallback((t: string) => {
    localStorage.setItem('jh-theme', t);
    setTheme(t);
  }, []);

  return [theme, choose] as const;
}

// ── Theme menu ───────────────────────────────────────────────────────────────

interface ThemeMenuProps {
  theme: string;
  setTheme: (t: string) => void;
}

export function ThemeMenu({ theme, setTheme }: ThemeMenuProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const opts: [string, string, string][] = [
    ['light', 'Light',  'sun'],
    ['dark',  'Dark',   'moon'],
    ['auto',  'System', 'monitor'],
  ];
  const cur = theme === 'auto' ? 'monitor' : theme === 'dark' ? 'moon' : 'sun';

  return (
    <div className="theme-menu" ref={ref}>
      <button className="ctrl-btn" aria-haspopup="menu" aria-expanded={open}
        aria-label="Theme" onClick={() => setOpen(o => !o)}>
        <Icon name={cur} size={16} />
      </button>
      {open && (
        <div className="menu" role="menu">
          {opts.map(([id, label, icon]) => (
            <button key={id}
              className={'menu-item' + (theme === id ? ' is-active' : '')}
              role="menuitemradio" aria-checked={theme === id}
              onClick={() => { setTheme(id); setOpen(false); }}>
              <Icon name={icon} size={15} />
              <span>{label}</span>
              {theme === id && (
                <Icon name="check" size={15}
                  style={{ marginLeft: 'auto', opacity: 0.55 }} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Nav ──────────────────────────────────────────────────────────────────────

interface NavProps {
  theme: string;
  setTheme: (t: string) => void;
}

export function Nav({ theme, setTheme }: NavProps) {
  return (
    <header className="wrap">
      <nav className="nav">
        <a className="brand" href="/">Johannes Homeier</a>
        <div className="nav-links">
          <ThemeMenu theme={theme} setTheme={setTheme} />
        </div>
      </nav>
    </header>
  );
}

// ── RowList — sliding highlight between rows ─────────────────────────────────

interface RowListProps {
  children: React.ReactNode;
}

export function RowList({ children }: RowListProps) {
  const ref      = React.useRef<HTMLDivElement>(null);
  const hlRef    = React.useRef<HTMLDivElement>(null);
  const curRef   = React.useRef<HTMLElement | null>(null);

  const move = (e: React.MouseEvent) => {
    const hit = (e.target as HTMLElement).closest('.exp, .rrow') as HTMLElement | null;
    if (!hit || !ref.current || !ref.current.contains(hit)) return;
    const item = (hit.closest('.exp') as HTMLElement | null) || hit;
    curRef.current = item;
    const hl = hlRef.current!;
    const top = item.offsetTop;
    const h   = item.offsetHeight;
    const first = hl.style.opacity === '' || hl.style.opacity === '0';
    if (first) {
      hl.style.transition = 'opacity var(--dur-fast) var(--ease)';
      hl.style.transform  = `translateY(${top}px)`;
      hl.style.height     = `${h}px`;
      void hl.offsetHeight; // force reflow
      hl.style.opacity = '1';
    } else {
      hl.style.transition = '';
      hl.style.transform  = `translateY(${top}px)`;
      hl.style.height     = `${h}px`;
      hl.style.opacity    = '1';
    }
  };

  const press = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.exp, .rrow') && hlRef.current)
      hlRef.current.classList.add('is-pressed');
  };
  const release = () => { hlRef.current?.classList.remove('is-pressed'); };
  const leave   = () => {
    if (hlRef.current) hlRef.current.style.opacity = '0';
    curRef.current = null;
    release();
  };

  React.useEffect(() => {
    document.addEventListener('mouseup', release);
    return () => document.removeEventListener('mouseup', release);
  }, []);

  // Grow the highlight when an item expands (no lag)
  React.useEffect(() => {
    if (!ref.current || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const item = curRef.current, hl = hlRef.current;
      if (!item || !hl || hl.style.opacity !== '1') return;
      hl.style.transition = 'none';
      hl.style.transform  = `translateY(${item.offsetTop}px)`;
      hl.style.height     = `${item.offsetHeight}px`;
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="rows" ref={ref}
      onMouseOver={move} onFocus={move}
      onMouseDown={press} onMouseLeave={leave}>
      <div className="rows-hl" ref={hlRef} aria-hidden="true" />
      {children}
    </div>
  );
}

// ── ExpRow — expandable experience row ───────────────────────────────────────

interface ExpRowProps {
  role: string;
  co: string;
  meta: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export function ExpRow({ role, co, meta, open, onToggle, children }: ExpRowProps) {
  return (
    <div className={'exp' + (open ? ' open' : '')}>
      <button className="rrow exp-head" aria-expanded={!!open} onClick={onToggle}>
        <span className="rrow-lead">
          <span className="rrow-main">
            <span className="rrow-title">
              {co || role}
              {co && <span className="exp-co"> · {role}</span>}
            </span>
          </span>
        </span>
        <span className="rrow-end">
          <span className="rrow-meta">{meta}</span>
          <span className="exp-chev" aria-hidden="true">
            <Icon name="chevronRight" size={16} strokeWidth={2.2} />
          </span>
        </span>
      </button>
      <div className="exp-body">
        <div className="exp-inner">{children}</div>
      </div>
    </div>
  );
}

// ── ProjRow — project link row ────────────────────────────────────────────────

interface ProjRowProps {
  title: string;
  desc?: string;
  meta?: string;
  href?: string;
  onClick?: () => void;
}

export function ProjRow({ title, desc, meta, href, onClick }: ProjRowProps) {
  const external = !!href;
  const inner = (
    <>
      <span className="rrow-lead">
        <span className="rrow-main">
          <span className="rrow-title">{title}</span>
          {desc && <span className="rrow-desc">{desc}</span>}
        </span>
      </span>
      <span className="rrow-end">
        {meta && <span className="rrow-meta">{meta}</span>}
        {external && (
          <Icon name="arrowUpRight" size={15} strokeWidth={2}
            style={{ color: 'var(--fg-faint)', flex: 'none' }} />
        )}
      </span>
    </>
  );
  if (href)
    return <a className="rrow proj-row" href={href} target="_blank" rel="noreferrer">{inner}</a>;
  if (onClick)
    return <button className="rrow proj-row" onClick={onClick}>{inner}</button>;
  return <div className="rrow proj-row proj-row--static">{inner}</div>;
}

// ── Footer ───────────────────────────────────────────────────────────────────

export function Footer() {
  return (
    <footer className="wrap">
      <div className="foot">
        <span className="foot-copy">© 2026 · Regensburg</span>
        <div className="foot-right">
          <div className="foot-links">
            {SOCIALS.map(([icon, label, href]) => (
              <a key={icon} href={href} target="_blank" rel="noreferrer">{label}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
