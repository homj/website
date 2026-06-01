import React from 'react';
import { Nav, Footer } from './ui';
import { Home } from './sections';

export default function HomeApp() {
  const [theme, setTheme] = React.useState<string>(
    () => (typeof localStorage !== 'undefined' ? localStorage.getItem('jh-theme') || 'light' : 'light')
  );

  // Theme: 'light' | 'dark' | 'auto' — resolved to data-theme on <html>
  React.useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const resolved = theme === 'auto' ? (mql.matches ? 'dark' : 'light') : theme;
      document.documentElement.setAttribute('data-theme', resolved);
    };
    apply();
    localStorage.setItem('jh-theme', theme);
    if (theme === 'auto') {
      mql.addEventListener('change', apply);
      return () => mql.removeEventListener('change', apply);
    }
  }, [theme]);

  return (
    <div className="site">
      <Nav theme={theme} setTheme={setTheme} />
      <main>
        <Home heroStyle="whitespace" />
      </main>
      <Footer />
    </div>
  );
}
