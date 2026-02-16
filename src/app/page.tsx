"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Check if setup is needed, then redirect
    fetch("/api/setup/check")
      .then((r) => r.json())
      .then((data) => {
        if (!data.hasUsers) {
          router.replace("/setup");
        } else {
          router.replace("/dashboard");
        }
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}
