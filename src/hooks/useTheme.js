import { useEffect, useState } from "react";

export function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem("noted-theme") || "light");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("noted-theme", theme);
  }, [theme]);

  return [theme, setTheme];
}

