// Canonical site metadata + JSON-LD building blocks, shared across pages.

import { EXPERIENCE, PROJECTS } from './content';

export const SITE = {
  url: 'https://johanneshomeier.com',
  name: 'Johannes Homeier',
  title: 'Johannes Homeier',
  description:
    'Johannes Homeier is a product engineer and tech lead based in Regensburg, Germany - 13+ years building software, shaping interfaces, and leading small teams.',
  locale: 'en_US',
  twitter: '@homiathome',
};

export const SAME_AS = [
  'https://github.com/homj',
  'https://twitter.com/homiathome',
  'https://www.linkedin.com/in/johannes-homeier/',
];

const REGENSBURG = {
  '@type': 'Place',
  address: { '@type': 'PostalAddress', addressLocality: 'Regensburg', addressCountry: 'DE' },
};

// Employment history as schema.org Roles, so each entry keeps its own dates
// instead of collapsing into a single "worksFor".
const ROLES = EXPERIENCE.map(e => ({
  '@type': 'OrganizationRole',
  roleName: e.role,
  startDate: e.start,
  ...(e.end ? { endDate: e.end } : {}),
  description: e.summary,
  worksFor: { '@type': 'Organization', name: e.co },
}));

const PERSON = {
  '@type': 'Person',
  '@id': `${SITE.url}/#person`,
  name: 'Johannes Homeier',
  givenName: 'Johannes',
  familyName: 'Homeier',
  url: SITE.url,
  mainEntityOfPage: { '@id': `${SITE.url}/#profilepage` },
  image: `${SITE.url}/og.png`,
  jobTitle: 'Product Engineer & Tech Lead',
  description: SITE.description,
  email: 'hello@johanneshomeier.com',
  address: { '@type': 'PostalAddress', addressLocality: 'Regensburg', addressCountry: 'DE' },
  homeLocation: REGENSBURG,
  workLocation: REGENSBURG,
  worksFor: ROLES,
  hasOccupation: {
    '@type': 'Occupation',
    name: 'Product Engineer & Tech Lead',
    occupationalCategory: '15-1252.00', // O*NET: Software Developers
    description: SITE.description,
  },
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'Business inquiries',
    email: 'hello@johanneshomeier.com',
    url: `${SITE.url}/#contact-heading`,
    availableLanguage: ['en', 'de'],
  },
  knowsAbout: [
    'Software engineering', 'Product engineering', 'Web development', 'Frontend architecture',
    'Software Architecture', 'Domain-Driven Design (DDD)', 'Spec-Driven Development (SDD)',
    'AI-driven development', 'Human-Computer Interaction', 'Usability engineering',
    'Web accessibility', 'Web performance', 'TypeScript', 'React', 'Next.js', 'Angular',
    'NestJS', 'Node.js', 'Nx Workspace', 'Astro',
  ],
  knowsLanguage: ['English', 'German'],
  sameAs: SAME_AS,
};

const WEBSITE = {
  '@type': 'WebSite',
  '@id': `${SITE.url}/#website`,
  name: SITE.name,
  url: SITE.url,
  inLanguage: 'en',
  publisher: { '@id': `${SITE.url}/#person` },
  author: { '@id': `${SITE.url}/#person` },
};

// The projects listed on the home page, so an agent can enumerate them without
// parsing the rendered markup. Typed as both, because the ProfilePage references
// it through `hasPart`, whose range is CreativeWork - an ItemList alone is an
// Intangible, so a validator flags the edge and a typed consumer drops it.
const PROJECT_LIST = {
  '@type': ['CreativeWork', 'ItemList'],
  '@id': `${SITE.url}/#projects`,
  name: 'Projects',
  numberOfItems: PROJECTS.length,
  itemListOrder: 'https://schema.org/ItemListUnordered',
  itemListElement: PROJECTS.map((p, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    item: {
      '@type': 'CreativeWork',
      name: p.title,
      description: p.desc,
      url: p.href,
      author: { '@id': `${SITE.url}/#person` },
    },
  })),
};

/** Breadcrumb trail for a second-level page. */
function breadcrumb(path: string, name: string) {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${SITE.url}${path}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE.url },
      { '@type': 'ListItem', position: 2, name, item: `${SITE.url}${path}` },
    ],
  };
}

// Home page: Person + WebSite + ProfilePage + projects, linked via @id.
export const homeJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    PERSON,
    WEBSITE,
    PROJECT_LIST,
    {
      '@type': 'ProfilePage',
      '@id': `${SITE.url}/#profilepage`,
      url: SITE.url,
      name: SITE.title,
      description: SITE.description,
      inLanguage: 'en',
      isPartOf: { '@id': `${SITE.url}/#website` },
      about: { '@id': `${SITE.url}/#person` },
      mainEntity: { '@id': `${SITE.url}/#person` },
      hasPart: { '@id': `${SITE.url}/#projects` },
    },
  ],
};

/** WebPage + breadcrumb graph for the imprint and privacy pages. */
export function legalPageJsonLd(path: string, name: string, description: string) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${SITE.url}${path}#webpage`,
        url: `${SITE.url}${path}`,
        name,
        description,
        inLanguage: 'en',
        isPartOf: { '@id': `${SITE.url}/#website` },
        about: { '@id': `${SITE.url}/#person` },
        publisher: { '@id': `${SITE.url}/#person` },
        breadcrumb: { '@id': `${SITE.url}${path}#breadcrumb` },
      },
      breadcrumb(path, name),
    ],
  };
}
