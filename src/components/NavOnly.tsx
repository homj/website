import { Nav, useTheme } from './ui';

export default function NavOnly() {
  const [theme, setTheme] = useTheme();
  return <Nav theme={theme} setTheme={setTheme} />;
}
