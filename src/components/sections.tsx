import React from 'react';
import { ExpRow, ProjRow, RowList } from './ui';

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
      aria-label="Boku wa Yo desu. Demo hontou wa Mi desu.">
      <Greeting lang="ja" />、<ruby>僕<rt>ぼく</rt></ruby>は<span className="kana">よ</span>です。でも<ruby>本当<rt>ほんとう</rt></ruby>は<span className="kana">み</span>です。
    </p>
  );
}

// ── Personal ─────────────────────────────────────────────────────────────────

export function Personal() {
  return (
    <section className="section" aria-labelledby="personal-heading">
      <div className="section-head"><h2 id="personal-heading" className="kick">Personal</h2></div>
      <p className="section-updated">updated June 02, 2026</p>
      <p className="personal-text measure">
        I&rsquo;m still thinking back to our trip to Japan last year&hellip; I&rsquo;ve been
        learning the language for a bit now and hope to go back in November, this time as a
        family.
      </p>
      <p className="personal-text measure">
         In the same spirit, my sister recently gifted me{' '}
        <a href="https://www.scorpio-verlag.de/Buecher/579/DerJapanischeGarten.html"
          target="_blank" rel="noreferrer">Der Japanische Garten</a>, a quiet story about
        ikigai. It&rsquo;s good to be reading again, even if it&rsquo;s just a small book.
      </p>
      <p className="personal-text measure">
        And between all of it, I finally made Broccoli Casserole again this
        week! One of my partner&rsquo;s favorites.
      </p>
      <p className="personal-text personal-aside measure">
        (I don&rsquo;t want to brag, but it slapped)
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

// ── Page compositions ────────────────────────────────────────────────────────
// The page's wrapper divs (.page.wrap > .home > .home-main) live in
// src/pages/index.astro. These components split the old page-wide `Home` at
// the hydration boundary: HomeStatic and Personal render without a `client:`
// directive (server-only, zero JS), while Work and Contact are small islands.

// Intro block: sr-only h1, lead paragraphs with greeting/signature, hero
// whitespace. Static — rendered to HTML on the server, never hydrated.
export function HomeStatic() {
  return (
    <>
      <h1 className="sr-only">Johannes Homeier - product engineer and tech lead based in Regensburg, Germany</h1>
      <div className="measure intro">
        <p className="lead">
          <Greeting lang="en" />, I&rsquo;m Johannes - a product engineer and tech lead based in Regensburg, Germany.
          I&rsquo;ve spent the last 13 years building software, shaping interfaces, and
          leading small teams.
        </p>
        <p className="lead">
          I studied Media Informatics &amp; Information Science with a strong focus on Human-Computer Interaction (HCI) and usability engineering.
          I see myself as someone who bridges user needs, design and engineering rather than pick a side.
        </p>
        <p className="lead">I care about the details most people skip.</p>
        <Signature />
      </div>
      <div className="hero-space" aria-hidden="true" />
    </>
  );
}

// Projects + Experience share one island: both use the RowList hover
// highlight, and Experience adds the accordion state.
export function Work() {
  return (
    <>
      <Projects />
      <Experience />
    </>
  );
}
