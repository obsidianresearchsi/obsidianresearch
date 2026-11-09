"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

interface InstallPrompt extends Event {
  prompt(): Promise<unknown>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [help, setHelp] = useState(false);
  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const onInstalled = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone;
    if (standalone) setInstalled(true);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  if (installed) return null;
  return <div className="install-app no-print">
    <button type="button" aria-expanded={help} aria-controls="install-app-help" onClick={async () => {
      if (!prompt) { setHelp(!help); return; }
      try {
        await prompt.prompt();
        if ((await prompt.userChoice).outcome === "accepted") setInstalled(true);
      } catch { setHelp(true); }
      finally { setPrompt(null); }
    }}><Download size={16} aria-hidden /> Install Obsidian</button>
    <p id="install-app-help" hidden={!help}>On iPhone, open the Share menu in Safari and choose Add to Home Screen. On Android, open your browser menu and choose Install app or Add to Home screen.</p>
  </div>;
}
