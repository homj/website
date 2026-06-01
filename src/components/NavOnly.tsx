import React from 'react';
import { Nav } from './ui';

export default function NavOnly() {
  const [theme, setTheme] = React.useState<string>(
    () => (typeof localStorage !== 'undefined' ? localStorage.getItem('jh-theme') || 'light' : 'light')
  );

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

  return <Nav theme={theme} setTheme={setTheme} />;
}
