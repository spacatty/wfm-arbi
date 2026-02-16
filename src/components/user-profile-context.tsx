"use client";

import { createContext, useContext, useEffect, useState } from "react";

const defaultTemplate =
  "/w {ign} Hi! I want to buy your {weapon_name} {riven_name} listed for {price}p";

const UserProfileContext = createContext<string | null>(null);

export function UserProfileProvider({ children }: { children: React.ReactNode }) {
  const [whisperTemplate, setWhisperTemplate] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/user/profile")
      .then((r) => r.json())
      .then((d) => setWhisperTemplate(d.whisperTemplate ?? defaultTemplate))
      .catch(() => setWhisperTemplate(defaultTemplate));
  }, []);

  return (
    <UserProfileContext.Provider value={whisperTemplate}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useWhisperTemplate(): string {
  const t = useContext(UserProfileContext);
  return t ?? defaultTemplate;
}
