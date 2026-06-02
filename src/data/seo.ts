// Canonical site metadata + JSON-LD building blocks, shared across pages.

export const SITE = {
  url: 'https://johanneshomeier.com',
  name: 'Johannes Homeier',
  title: 'Johannes Homeier - Product engineer & tech lead',
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
  jobTitle: 'Product engineer & tech lead',
  description: SITE.description,
  email: 'hello@johanneshomeier.com',
  address: { '@type': 'PostalAddress', addressLocality: 'Regensburg', addressCountry: 'DE' },
  worksFor: { '@type': 'Organization', name: 'Freelance' },
  knowsAbout: [
    'Software engineering', 'Product engineering', 'Web development', 'Frontend architecture',
    'Human-Computer Interaction', 'Usability engineering', 'Web accessibility', 'SEO',
    'Web performance', 'TypeScript', 'React', 'Angular', 'Astro', 'Node.js',
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

export function articleJsonLd(opts: {
  title: string; description: string; path: string; datePublished: string;
}) {
  const url = `${SITE.url}${opts.path}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: opts.title,
    description: opts.description,
    datePublished: opts.datePublished,
    inLanguage: 'en',
    image: `${SITE.url}/og.png`,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    author: { '@type': 'Person', name: SITE.name, url: SITE.url },
    publisher: { '@type': 'Person', name: SITE.name, url: SITE.url },
  };
}
