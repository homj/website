import { Nav, Footer, useTheme } from './ui';
import { Home } from './sections';

export default function HomeApp() {
  const [theme, setTheme] = useTheme();

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
