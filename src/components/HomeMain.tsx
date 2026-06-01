import { Home } from './sections';

// Page content (intro, projects, experience, personal, contact). Hydrated with
// client:load so it is server-rendered for SEO and interactive on the client.
export default function HomeMain() {
  return <Home heroStyle="whitespace" />;
}
