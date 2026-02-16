"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Shield, Zap, BarChart3, Loader2 } from "lucide-react";

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);

  // Step 1: Admin account
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  // Step 2: Benchmarks
  const [antivirusPrice, setAntivirusPrice] = useState("4");
  const [ayatanPrice, setAyatanPrice] = useState("9");

  // Check if setup is already done
  useEffect(() => {
    fetch("/api/setup/check")
      .then((r) => r.json())
      .then((data) => {
        if (data.hasUsers) {
          router.replace("/login");
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, [router]);

  const handleSetup = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name,
          antivirusPrice: Number(antivirusPrice),
          ayatanPrice: Number(ayatanPrice),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Setup failed");
        setLoading(false);
        return;
      }

      // Auto sign in
      const signInResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (signInResult?.ok) {
        window.location.href = "/dashboard";
      } else {
        router.push("/login");
      }
    } catch {
      setError("Setup failed. Check your connection.");
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-grid p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-glow-cyan text-primary tracking-tight">
            WARFRAME MARKET
          </h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono">
            RIVEN ENDO ARBITRAGE ENGINE
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-4 mb-6">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  step >= s
                    ? "bg-primary text-primary-foreground glow-cyan"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {s}
              </div>
              {s < 2 && (
                <div
                  className={`w-12 h-0.5 ${
                    step > s ? "bg-primary" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {step === 1 && (
          <Card className="border-glow-cyan">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Create Admin Account
              </CardTitle>
              <CardDescription>
                First-time setup. This will be the administrator account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Display Name</Label>
                <Input
                  id="name"
                  placeholder="Tenno"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tenno@warframe.market"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Min 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button
                className="w-full glow-cyan"
                onClick={() => {
                  if (!name || !email || !password) {
                    setError("All fields are required");
                    return;
                  }
                  if (password.length < 8) {
                    setError("Password must be at least 8 characters");
                    return;
                  }
                  setError("");
                  setStep(2);
                }}
              >
                Continue
                <Zap className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card className="border-glow-cyan">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Configure Endo Benchmarks
              </CardTitle>
              <CardDescription>
                Set current market prices for endo sources. These determine
                the liquidity threshold.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-3 space-y-2 font-mono text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Antivirus Mod</span>
                  <span>1,000 endo</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ayatan Anasa (filled)</span>
                  <span>3,450 endo</span>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="antivirus">
                  Antivirus Mod Price (platinum)
                </Label>
                <Input
                  id="antivirus"
                  type="number"
                  value={antivirusPrice}
                  onChange={(e) => setAntivirusPrice(e.target.value)}
                />
                <p className="text-xs text-muted-foreground font-mono">
                  = {Math.round(1000 / Number(antivirusPrice || 1))} endo/plat
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ayatan">
                  Ayatan Anasa Sculpture Price (platinum)
                </Label>
                <Input
                  id="ayatan"
                  type="number"
                  value={ayatanPrice}
                  onChange={(e) => setAyatanPrice(e.target.value)}
                />
                <p className="text-xs text-muted-foreground font-mono">
                  = {Math.round(3450 / Number(ayatanPrice || 1))} endo/plat
                </p>
              </div>

              <div className="rounded-lg bg-primary/10 border border-primary/20 p-3">
                <p className="text-sm font-medium text-primary">
                  Liquidity Threshold:{" "}
                  <span className="text-glow-cyan font-mono">
                    {Math.round(
                      Math.max(
                        1000 / Number(antivirusPrice || 1),
                        3450 / Number(ayatanPrice || 1)
                      )
                    )}{" "}
                    endo/plat
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Rivens must beat this rate to be shown as deals.
                </p>
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  className="flex-1 glow-cyan"
                  onClick={handleSetup}
                  disabled={loading}
                >
                  {loading ? "Setting up..." : "Complete Setup"}
                  <Zap className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
