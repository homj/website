// Builders for the machine-readable mirrors of this site: /llms.txt (a short
// index in the llms.txt convention), /llms-full.txt (the same content in full)
// and the Markdown alternate at /index.md. All of them read src/data/content.ts
// and src/data/seo.ts, so they follow the rendered page automatically.

import { EXPERIENCE, INTRO, PERSONAL, PROJECTS } from '../data/content';
import { CONTROLLER } from '../data/legal';
import { SITE } from '../data/seo';

const { url } = SITE;

/** Markdown list of the projects, newest-facing first. */
function projectLines(): string[] {
  return PROJECTS.map(p => {
    const meta = p.meta ? ` (${p.meta})` : '';
    return `- [${p.title}](${p.href})${meta}: ${p.desc}`;
  });
}

/** Markdown for the experience timeline. */
function experienceLines(): string[] {
  return EXPERIENCE.flatMap(e => [
    `### ${e.role} — ${e.co} (${e.meta})`,
    '',
    e.summary,
    '',
  ]);
}

/**
 * The home page as Markdown. Served at /index.md and embedded in
 * /llms-full.txt so an agent can take either route to the same content.
 */
export function homeMarkdown(): string {
  return [
    '# Johannes Homeier',
    '',
    '> Product engineer and tech lead based in Regensburg, Germany. 13+ years',
    '> building software, shaping interfaces, and leading small teams.',
    '',
    '## About',
    '',
    ...INTRO.flatMap(p => [p, '']),
    '## Projects',
    '',
    ...projectLines(),
    '',
    '## Experience',
    '',
    ...experienceLines(),
    '## Personal',
    '',
    `_Updated ${PERSONAL.updated}._`,
    '',
    ...PERSONAL.paragraphs.flatMap(p => [p, '']),
    '## Contact',
    '',
    `- Email: ${CONTROLLER.email}`,
    `- Location: ${CONTROLLER.city}, ${CONTROLLER.country}`,
    `- Contact form: ${url}/#contact-heading`,
    `- Contact API: POST ${url}/api/contact (see ${url}/openapi.json)`,
    '',
    '## Elsewhere',
    '',
    '- [GitHub](https://github.com/homj)',
    '- [LinkedIn](https://www.linkedin.com/in/johannes-homeier/)',
    '- [X](https://twitter.com/homiathome)',
    '',
  ].join('\n');
}

/**
 * /llms.txt — a short, link-first index. Points at the full text rather than
 * inlining it, which is what the convention asks for.
 */
export function llmsTxt(): string {
  return [
    '# Johannes Homeier',
    '',
    '> Personal site of Johannes Homeier, a product engineer and tech lead based',
    '> in Regensburg, Germany, with 13+ years building software, shaping',
    '> interfaces, and leading small teams.',
    '',
    'This site is a single-page profile plus two legal pages. Everything below is',
    'available as plain Markdown; no JavaScript is required to read any of it.',
    '',
    '## Pages',
    '',
    `- [Home (Markdown)](${url}/index.md): profile, projects, experience, personal notes, contact.`,
    `- [Home (HTML)](${url}/): the same content as rendered for people.`,
    `- [Imprint](${url}/imprint): operator identity, address, and VAT ID (German DDG § 5).`,
    `- [Privacy policy](${url}/privacy): GDPR disclosures for this site.`,
    '',
    '## Full text',
    '',
    `- [llms-full.txt](${url}/llms-full.txt): the complete site content in one file.`,
    '',
    '## Machine-readable',
    '',
    `- [openapi.json](${url}/openapi.json): the public contact endpoint.`,
    `- [sitemap.xml](${url}/sitemap.xml): every canonical URL with a last-modified date.`,
    `- [security.txt](${url}/.well-known/security.txt): how to report a vulnerability.`,
    '',
    '## Projects',
    '',
    ...projectLines(),
    '',
    '## Contact',
    '',
    `- Email: ${CONTROLLER.email}`,
    `- Location: ${CONTROLLER.city}, ${CONTROLLER.country}`,
    '',
  ].join('\n');
}

/** /llms-full.txt — the whole site content in one fetch. */
export function llmsFullTxt(): string {
  return [
    homeMarkdown(),
    '## Legal',
    '',
    `Operator and data controller: ${CONTROLLER.name}, ${CONTROLLER.street},`,
    `${CONTROLLER.postalCode} ${CONTROLLER.city}, ${CONTROLLER.country}.`,
    `VAT ID: ${CONTROLLER.vatId}.`,
    '',
    `The full imprint (${url}/imprint) and privacy policy (${url}/privacy) are`,
    'published as HTML only, so that the binding legal text has exactly one',
    'authoritative wording.',
    '',
  ].join('\n');
}
