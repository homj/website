// Canonical site metadata + JSON-LD building blocks, shared across pages.

export const SITE = {
  url: 'https://johanneshomeier.com',
  name: 'Johannes Homeier',
  title: 'Johannes Homeier',
  description:
    'Johannes Homeier is a product engineer and tech lead based in Regensburg, Germany - 13+ years building software, shaping interfaces, and leading small teams.',
  locale: 'en_US',
  twitter: '@homiathome',
};

const PERSON = {
  '@type': 'Person',
  '@id': `${SITE.url}/#person`,
  name: 'Johannes Homeier',
  url: SITE.url,
  image: `${SITE.url}/og.png`,
  jobTitle: 'Product Engineer & Tech Lead',
  description: SITE.description,
  email: 'hello@johanneshomeier.com',
  address: { '@type': 'PostalAddress', addressLocality: 'Regensburg', addressCountry: 'DE' },
  worksFor: { '@type': 'Organization', name: 'Freelance' },
  knowsAbout: [
    'Software engineering', 'Product engineering', 'Web development', 'Frontend architecture',
    'Software Architecture', 'Domain-Driven Design (DDD)', 'Spec-Driven Development (SDD)',
    'AI-driven development', 'Human-Computer Interaction', 'Usability engineering',
    'Web accessibility', 'Web performance', 'TypeScript', 'React', 'Next.js', 'Angular',
    'NestJS', 'Node.js', 'Nx Workspace', 'Astro',
  ],
  knowsLanguage: ['English', 'German'],
  sameAs: [
    'https://github.com/homj',
    'https://twitter.com/homiathome',
    'https://www.linkedin.com/in/johannes-homeier/',
  ],
};

const WEBSITE = {
  '@type': 'WebSite',
  '@id': `${SITE.url}/#website`,
  name: SITE.name,
  url: SITE.url,
  inLanguage: 'en',
  publisher: { '@id': `${SITE.url}/#person` },
};

// Home page: Person + WebSite + ProfilePage, linked via @id in one graph.
export const homeJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    PERSON,
    WEBSITE,
    {
      '@type': 'ProfilePage',
      '@id': `${SITE.url}/#profilepage`,
      url: SITE.url,
      name: SITE.title,
      isPartOf: { '@id': `${SITE.url}/#website` },
      mainEntity: { '@id': `${SITE.url}/#person` },
    },
  ],
};
