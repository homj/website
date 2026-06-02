import React from 'react';
import { Icon, RowList, ExpRow, ProjRow, SOCIALS } from './ui';

// ── DotField — interactive monochrome canvas ─────────────────────────────────

export function DotField() {
  const ref = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let raf = 0, w = 0, h = 0;
    let dots: { x: number; y: number }[] = [];
    const mouse = { x: -9999, y: -9999 };
    const inkOf = () =>
      getComputedStyle(document.documentElement).getPropertyValue('--fg').trim() || '#000';
    let ink = inkOf();

    function build() {
      const rect = canvas.getBoundingClientRect();
      w = rect.width; h = rect.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      canvas.width  = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
      const gap = 24;
      dots = [];
      const ox = (w % gap) / 2 + gap / 2;
      for (let y = gap / 2; y < h; y += gap)
        for (let x = ox; x < w; x += gap)
          dots.push({ x, y });
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      const R = 130;
      for (const d of dots) {
        const dx   = d.x - mouse.x, dy = d.y - mouse.y;
        const dist = Math.hypot(dx, dy) || 1;
        const f    = Math.max(0, 1 - dist / R);
        const r    = 1 + f * 2.4;
        const off  = f * 7;
        const nx   = d.x - (dx / dist) * off;
        const ny   = d.y - (dy / dist) * off;
        ctx.globalAlpha = 0.16 + f * 0.7;
        ctx.beginPath();
        ctx.arc(nx, ny, r, 0, Math.PI * 2);
        ctx.fillStyle = ink;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function loop() { draw(); raf = requestAnimationFrame(loop); }
    build(); draw();
    if (!reduce) loop();

    const onMove  = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    const onLeave  = () => { mouse.x = -9999; mouse.y = -9999; };
    const onResize = () => { build(); draw(); };
    const obs = new MutationObserver(() => { ink = inkOf(); draw(); });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.addEventListener('pointermove', onMove, { passive: true });
    canvas.addEventListener('pointerleave', onLeave);
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      obs.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <div className="hero-dots" aria-hidden="true">
      <canvas ref={ref} />
    </div>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────────────

interface HeroProps {
  style: string;
}

export function Hero({ style }: HeroProps) {
  if (style === 'none') return null;
  if (style === 'whitespace')
    return <div className="hero-space" aria-hidden="true" />;
  if (style === 'dots') return <DotField />;
  if (style === 'statement') {
    return (
      <div className="hero-statement">
        <p>Details are the product.</p>
      </div>
    );
  }
  if (style === 'block') {
    return (
      <div className="hero-block" aria-hidden="true">
        <div className="wash" />
        <div className="wash-edge" />
        <div className="hero-block__mark">
          <span>Johannes</span><span>Homeier</span>
        </div>
      </div>
    );
  }
  // band (default)
  return (
    <div className="hero-band" aria-hidden="true">
      <div className="wash" />
      <div className="wash-edge" />
    </div>
  );
}

// ── Greeting (visitor's local time) ──────────────────────────────────────────
// Every variant is rendered statically; CSS reveals the one matching
// <html data-daypart>, which Layout.astro sets before first paint. This keeps
// the page static and avoids the greeting flashing/jumping on load.

const GREETINGS = [
  { part: 'morning', en: 'Good morning', ja: 'おはよう' },
  { part: 'day',     en: 'Hey',          ja: 'こんにちは' },
  { part: 'evening', en: 'Good evening', ja: 'こんばんは' },
  { part: 'night',   en: 'Good night',   ja: 'こんばんは' },
] as const;

function Greeting({ lang }: { lang: 'en' | 'ja' }) {
  return (
    <>
      {GREETINGS.map(g => (
        <span key={g.part} className="greet" data-greet={g.part}>{lang === 'en' ? g.en : g.ja}</span>
      ))}
    </>
  );
}

// ── Signature ────────────────────────────────────────────────────────────────

export function Signature() {
  return (
    <p className="signature" lang="ja"
      aria-label="Watashi wa Yo desu. Demo hontou wa Mi desu.">
      <Greeting lang="ja" />、私は<span className="kana">よ</span>です。でも本当は<span className="kana">み</span>です。
    </p>
  );
}

// ── Rail (sidebar layout) ────────────────────────────────────────────────────

export function Rail() {
  return (
    <aside className="home-rail">
      <div className="rail-name">Johannes Homeier</div>
      <div className="rail-role">Product engineer &amp; tech lead</div>
      <div className="rail-loc">Regensburg, DE</div>
      <div className="rail-socials">
        {SOCIALS.map(([icon, label, href]) => (
          <a key={icon} href={href} aria-label={label} target="_blank" rel="noreferrer">
            <Icon name={icon} size={18} />
          </a>
        ))}
      </div>
    </aside>
  );
}

// ── Personal ─────────────────────────────────────────────────────────────────

export function Personal() {
  return (
    <section className="section" aria-labelledby="personal-heading">
      <div className="section-head"><h2 id="personal-heading" className="kick">Personal</h2></div>
      <p className="section-updated">last updated: June 2026</p>
      <p className="personal-text measure">
        Life is full at the moment. We&rsquo;re only a few days away from becoming parents for
        the first time, and I can&rsquo;t tell you how excited I am.
      </p>
      <p className="personal-text measure">
        And I&rsquo;m still thinking back to our trip to Japan last year&hellip; I&rsquo;ve been
        learning the language for a bit now and hope to go back in November, this time as a
        family. In the same spirit, my sister recently gifted me{' '}
        <a href="https://www.scorpio-verlag.de/Buecher/579/DerJapanischeGarten.html"
          target="_blank" rel="noreferrer">Der Japanische Garten</a>, a quiet story about
        ikigai. It&rsquo;s good to be reading again, even if it&rsquo;s just a small book.
      </p>
      <p className="personal-text measure">
        And between all of it, I finally made Broccoli Casserole again this
        week. One of my partner&rsquo;s favorites.
      </p>
      <p className="personal-text measure">
        (I won&rsquo;t brag, but it slapped.)
      </p>
    </section>
  );
}

// ── Projects ─────────────────────────────────────────────────────────────────

export function Projects() {
  return (
    <section className="section" aria-labelledby="projects-heading">
      <div className="section-head"><h2 id="projects-heading" className="kick">Projects</h2></div>
      <RowList>
        <ProjRow
          title="siteboard"
          desc="Website-analysis platform for SEO, performance, accessibility & security"
          href="https://siteboard.io/en" />
        <ProjRow
          title="Composables"
          desc="Signal-based composable functions for Angular"
          meta="GitHub"
          href="https://github.com/homj/angular-extensions/tree/main/libs/composables" />
      </RowList>
    </section>
  );
}

// ── Experience ───────────────────────────────────────────────────────────────

export function Experience() {
  const [openIdx, setOpenIdx] = React.useState(0);
  const toggle = (i: number) => setOpenIdx(cur => (cur === i ? -1 : i));

  return (
    <section className="section" aria-labelledby="experience-heading">
      <div className="section-head"><h2 id="experience-heading" className="kick">Experience</h2></div>
      <RowList>
        <ExpRow role="Product engineer" co="Freelance" meta="2026 - now"
          open={openIdx === 0} onToggle={() => toggle(0)}>
          <p>
            Senior engineering across several concurrent client projects. Lately a mail
            client and offer wizard for a B2B parcel-delivery company&rsquo;s CRM, and a
            custom web component for distributing construction-material catalogs to dealer
            networks. I pair hands-on engineering with architecture and product feedback.
          </p>
        </ExpRow>

        <ExpRow role="CTO &amp; co-founder" co="siteboard" meta="2025"
          open={openIdx === 1} onToggle={() => toggle(1)}>
          <p>
            Spun an internal bynary tool out into a standalone SaaS, and came along as
            co-founder and CTO with the ten-person team. A website-analysis platform for
            SEO, performance, accessibility, security, and best practices - 10M+ audits
            across 2,000+ sites. I owned the full lifecycle and joined sales calls as
            technical lead.
          </p>
        </ExpRow>

        <ExpRow role="CEO &amp; co-founder" co="bynary" meta="2016 - 2025"
          open={openIdx === 2} onToggle={() => toggle(2)}>
          <p>
            Co-founded and ran a development agency for ten years, growing it to ten
            people. Shipped 100+ projects across adtech, healthcare, biotech, fintech,
            e-commerce, and travel. I led the web-app division and owned customer
            relationships end to end.
          </p>
        </ExpRow>

        <ExpRow role="Owner" co="twoid" meta="2012 - 2016"
          open={openIdx === 3} onToggle={() => toggle(3)}>
          <p>
            A side business while studying. Built native Android apps for local and
            international clients, and ran usability tests to validate UX changes and
            inform future work.
          </p>
        </ExpRow>

        <ExpRow role="Working student, QA" co="Infineon" meta="2012 - 2013"
          open={openIdx === 4} onToggle={() => toggle(4)}>
          <p>
            Supported the QA team handling supplier audits through data analysis, fault
            documentation, and reporting. Built VBA automations in Excel to replace
            repetitive data handling, and worked with SAP for reporting.
          </p>
        </ExpRow>
      </RowList>
    </section>
  );
}

// ── Contact ──────────────────────────────────────────────────────────────────

// Public sitekey for the Friendly Captcha widget. When unset (e.g. local dev
// without secrets) the captcha is skipped on both client and server.
const FRC_SITEKEY = import.meta.env.PUBLIC_FRIENDLY_CAPTCHA_SITEKEY as string | undefined;
const NOTE_MAX = 5000; // keep in sync with MAX_LEN in src/pages/api/contact.ts

export function Contact() {
  const [note, setNote] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [revealed, setRevealed] = React.useState(false);
  const [captcha, setCaptcha] = React.useState('');
  const [captchaFailed, setCaptchaFailed] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState('');

  const CAPTCHA_WAIT = 'Hang on, finishing the bot check...';
  const CAPTCHA_FAILED = 'The bot check could not load. Please reload the page and try again.';

  const emailRef = React.useRef<HTMLInputElement>(null);
  const captchaRef = React.useRef<HTMLDivElement>(null);

  // Mount the Friendly Captcha widget once the extra fields are revealed.
  // Loaded lazily so the SDK never runs during server-side rendering.
  React.useEffect(() => {
    if (!revealed || !FRC_SITEKEY || !captchaRef.current) return;
    let widget: { destroy(): void } | undefined;
    let cancelled = false;
    import('@friendlycaptcha/sdk')
      .then(({ FriendlyCaptchaSDK }) => {
        if (cancelled || !captchaRef.current) return;
        const sdk = new FriendlyCaptchaSDK();
        const w = sdk.createWidget({
          element: captchaRef.current,
          sitekey: FRC_SITEKEY,
          startMode: 'auto',
        });
        widget = w;
        w.addEventListener('frc:widget.complete', e => { setCaptcha(e.detail.response); setCaptchaFailed(false); });
        w.addEventListener('frc:widget.error', () => { setCaptcha(''); setCaptchaFailed(true); });
        w.addEventListener('frc:widget.expire', () => setCaptcha(''));
      })
      // The SDK chunk itself failed to load (offline / blocked). Surface it so
      // the user isn't stuck staring at a "finishing the bot check" message.
      .catch(() => { if (!cancelled) setCaptchaFailed(true); });
    return () => { cancelled = true; widget?.destroy(); };
  }, [revealed]);

  // Reveal the optional reply-to field (and captcha) below the textarea.
  const reveal = () => {
    if (!note.trim()) return;
    setRevealed(true);
    requestAnimationFrame(() => emailRef.current?.focus());
  };

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = note.trim();
    if (!trimmed || sending) return;
    if (FRC_SITEKEY && !captcha) {
      setError(captchaFailed ? CAPTCHA_FAILED : CAPTCHA_WAIT);
      return;
    }
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note: trimmed,
          email: email.trim() || undefined,
          frcCaptchaResponse: captcha || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? 'Something went wrong.');
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSending(false);
    }
  };

  // Keep the captcha wait message from lingering: once the token resolves,
  // clear it; if the widget errored, swap it for the failure note. Never
  // auto-sends - the visitor stays in control and clicks Send when ready.
  React.useEffect(() => {
    if (captcha) setError(prev => (prev === CAPTCHA_WAIT ? '' : prev));
    else if (captchaFailed) setError(prev => (prev === CAPTCHA_WAIT ? CAPTCHA_FAILED : prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captcha, captchaFailed]);

  // First Enter reveals the optional reply-to field; a second one sends.
  const onNoteKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!revealed) reveal();
      else submit();
    }
  };

  const onEmailKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
  };

  return (
    <section className="section contact">
      <div className="measure">
        {sent ? (
          <p className="contact-done">Thanks - your note is on its way.</p>
        ) : (
          <form className="note-form" onSubmit={submit}>
            <label className="note-label" htmlFor="note">Leave me a note</label>
            <textarea
              id="note" className="note-field" rows={3} value={note}
              maxLength={NOTE_MAX} disabled={sending}
              onChange={e => setNote(e.target.value)} onKeyDown={onNoteKey} />
            {revealed && (
              <>
                <input
                  ref={emailRef} id="note-email" className="note-name" type="email"
                  placeholder="Your email (optional)" value={email} disabled={sending}
                  onChange={e => setEmail(e.target.value)} onKeyDown={onEmailKey} />
                {FRC_SITEKEY && <div ref={captchaRef} className="note-captcha" />}
              </>
            )}
            <div className="note-row">
              <button
                type={revealed ? 'submit' : 'button'}
                className="note-send"
                disabled={sending || !note.trim()}
                onClick={revealed ? undefined : reveal}>
                {sending ? 'Sending…' : revealed ? 'Send' : 'Continue'}
              </button>
              {error && <span className="note-hint" role="alert">{error}</span>}
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

// ── Home ─────────────────────────────────────────────────────────────────────

interface HomeProps {
  heroStyle: string;
}

export function Home({ heroStyle }: HomeProps) {
  return (
    <div className="page wrap">
      <div className="home">
        <Rail />
        <div className="home-main">
          <h1 className="sr-only">Johannes Homeier - product engineer and tech lead based in Regensburg, Germany</h1>
          <div className="measure intro">
            <p className="lead">
              <Greeting lang="en" />, I&rsquo;m Johannes - a product engineer and tech lead based in Regensburg.
              I&rsquo;ve spent the last 13 years building software, shaping interfaces, and
              leading small teams.
            </p>
            <p className="lead">
              I studied Media Informatics &amp; Information Science with a strong focus on
              Human-Computer Interaction and Usability Engineering, so I tend to bridge design,
              engineering, and what users actually need rather than pick a side.
            </p>
            <p className="lead">I care about the details most people skip.</p>
            <Signature />
          </div>
          <Hero style={heroStyle || 'whitespace'} />
          <Projects />
          <Experience />
          <Personal />
          <Contact />
        </div>
      </div>
    </div>
  );
}
