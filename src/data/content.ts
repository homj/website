// Single source of truth for the page content that is also published in
// machine-readable form (/llms.txt, /llms-full.txt, the .md alternates).
//
// sections.tsx renders PROJECTS and EXPERIENCE directly, so the human page and
// the agent-facing files cannot drift apart. INTRO and PERSONAL mirror prose
// that stays in JSX because it carries inline markup (the local-time greeting,
// ruby annotations, links) that plain strings cannot express - keep both sides
// in step when editing.

export interface Project {
  title: string;
  desc: string;
  href: string;
  meta?: string;
}

export const PROJECTS: Project[] = [
  {
    title: 'Elterngeld Kompass (🇩🇪 + Invite only)',
    desc: 'Financial insights for becoming parents.',
    href: 'https://elterngeld-kompass.de',
  },
  {
    title: 'Kritzel',
    desc: 'Procedurally generated doodle heads. Built for Elterngeld Kompass.',
    href: 'https://kritzel.johanneshomeier.com',
  },
  {
    title: 'siteboard',
    desc: 'Website-analysis platform for SEO, performance, accessibility & security',
    href: 'https://siteboard.io/en',
  },
  {
    title: 'Composables',
    desc: 'Signal-based composable functions for Angular',
    href: 'https://github.com/homj/angular-extensions/tree/main/libs/composables',
  },
];

export interface Role {
  role: string;
  co: string;
  meta: string;
  /** Machine-readable form of `meta`, for structured data. */
  start: string;
  end?: string;
  summary: string;
}

export const EXPERIENCE: Role[] = [
  {
    role: 'Product engineer',
    co: 'Freelance',
    meta: '2026 - now',
    start: '2026',
    summary:
      'Senior engineering across several concurrent client projects. Lately a mail client and offer wizard for a B2B parcel-delivery company’s CRM, and a custom web component for distributing construction-material catalogs to dealer networks. I pair hands-on engineering with architecture and product feedback.',
  },
  {
    role: 'CTO & co-founder',
    co: 'siteboard',
    meta: '2025',
    start: '2025',
    end: '2025',
    summary:
      'Spun an internal bynary tool out into a standalone SaaS, and came along as co-founder and CTO with the ten-person team. A website-analysis platform for SEO, performance, accessibility, security, and best practices - 10M+ audits across 2,000+ sites. I owned the full lifecycle and joined sales calls as technical lead.',
  },
  {
    role: 'CEO & co-founder',
    co: 'bynary',
    meta: '2016 - 2025',
    start: '2016',
    end: '2025',
    summary:
      'Co-founded and ran a development agency for ten years, growing it to ten people. Shipped 100+ projects across adtech, healthcare, biotech, fintech, e-commerce, and travel. I led the web-app division and owned customer relationships end to end.',
  },
  {
    role: 'Owner',
    co: 'twoid',
    meta: '2012 - 2016',
    start: '2012',
    end: '2016',
    summary:
      'A side business while studying. Built native Android apps for local and international clients, and ran usability tests to validate UX changes and inform future work.',
  },
  {
    role: 'Working student, QA',
    co: 'Infineon',
    meta: '2012 - 2013',
    start: '2012',
    end: '2013',
    summary:
      'Supported the QA team handling supplier audits through data analysis, fault documentation, and reporting. Built VBA automations in Excel to replace repetitive data handling, and worked with SAP for reporting.',
  },
];

/**
 * Date of the last edit to anything on the home page other than the Personal
 * note - PROJECTS, EXPERIENCE or INTRO. Bump it whenever you touch one of them.
 * The home page's <lastmod> is the later of this and `PERSONAL.updatedISO`, so a
 * new project moves the date even though the Personal note did not change.
 */
export const CONTENT_UPDATED_ISO = '2026-08-27';

/**
 * Last edit to each standalone page, tracked separately from the home page's
 * date. Sharing CONTENT_UPDATED_ISO with them would move their <lastmod> every
 * time a project or role changed, and would leave it frozen when the page's own
 * prose was edited - both of which teach a crawler to distrust the sitemap.
 * Bump the entry for a page when you edit that page.
 */
export const PAGE_UPDATED_ISO = {
  '/about/': '2026-08-22',
  '/contact/': '2026-08-22',
  '/docs/': '2026-08-22',
} as const;

/** Plain-text mirror of the intro paragraphs rendered in sections.tsx. */
export const INTRO: string[] = [
  'Hey, I’m Johannes - a product engineer and tech lead based in Regensburg, Germany. I’ve spent the last 13 years building software, shaping interfaces, and leading small teams.',
  'I studied Media Informatics & Information Science with a strong focus on Human-Computer Interaction (HCI) and usability engineering. I see myself as someone who bridges user needs, design and engineering rather than pick a side.',
  'I care about the details most people skip.',
];

/** Plain-text mirror of the Personal section, with its own updated date. */
export const PERSONAL = {
  updated: 'June 02, 2026',
  /** Same date as `updated`, for <lastmod> and structured data. */
  updatedISO: '2026-06-02',
  paragraphs: [
    'I’m still thinking back to our trip to Japan last year… I’ve been learning the language for a bit now and hope to go back in November, this time as a family.',
    'In the same spirit, my sister recently gifted me Der Japanische Garten (https://www.scorpio-verlag.de/Buecher/579/DerJapanischeGarten.html), a quiet story about ikigai. It’s good to be reading again, even if it’s just a small book.',
    'And between all of it, I finally made Broccoli Casserole again this week! One of my partner’s favorites.',
    '(I don’t want to brag, but it slapped)',
  ],
};
