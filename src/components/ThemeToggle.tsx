import { useTheme, ThemeMenu } from './ui';

// Standalone theme toggle, mounted as a `client:only` island so it can read the
// saved preference before its first paint — no SSR, no hydration flicker.
export default function ThemeToggle() {
  const [theme, setTheme] = useTheme();
  return <ThemeMenu theme={theme} setTheme={setTheme} />;
}
