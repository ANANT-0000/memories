"use client";

import { useState, useEffect } from "react";
import PinScreen from "./PinScreen";
import GalleryView from "./GalleryView";

export default function GalleryContainer() {
  const [pin, setPin] = useState<string>("");

  // Lock the gallery on ANY of these triggers:
  //   1. visibilitychange → tab switch, screen off (Android/desktop)
  //   2. pagehide         → iOS Safari home button, app switcher, browser close
  //   3. window blur      → another app / window comes to foreground on desktop
  useEffect(() => {
    if (!pin) return; // only listen while unlocked

    const lock = () => setPin(""); // wipe PIN → PinScreen shown on return
    const onVisibility = () => { if (document.hidden) lock(); };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", lock);
    window.addEventListener("blur", lock);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", lock);
      window.removeEventListener("blur", lock);
    };
  }, [pin]);



  if (!pin) {
    return <PinScreen onUnlock={(unlockedPin) => setPin(unlockedPin)} />;
  }

  return <GalleryView pin={pin} />;
}
