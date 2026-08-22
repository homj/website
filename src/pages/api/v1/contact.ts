// Version-pinned alias of /api/contact. Both paths serve the same handler today;
// the point of the alias is that an integrator can pin to a surface that will not
// change shape under them - a breaking change ships as /api/v2/contact instead.
// See /docs for the deprecation policy.
//
// `prerender` is declared here rather than re-exported: Astro reads it statically
// and rejects a re-exported binding.
export const prerender = false;

export { OPTIONS, ALL, POST } from '../contact';
