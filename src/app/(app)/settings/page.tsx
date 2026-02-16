"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Save, MessageSquare, KeyRound, User } from "lucide-react";

const DEFAULT_WHISPER =
  "/w {ign} Hi! I want to buy your [{riven_name}] listed for {price}p. (warframe.market)";

export default function SettingsPage() {
  const { data: session } = useSession();
  const [whisperTemplate, setWhisperTemplate] = useState(DEFAULT_WHISPER);
  const [profileLoading, setProfileLoading] = useState(true);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [templateSaving, setTemplateSaving] = useState(false);

  useEffect(() => {
    fetch("/api/user/profile")
      .then((r) => r.json())
      .then((d) => {
        if (d.whisperTemplate != null) setWhisperTemplate(d.whisperTemplate);
      })
      .catch(() => {})
      .finally(() => setProfileLoading(false));
  }, []);

  const previewMessage = whisperTemplate
    .replace("{ign}", "TennoSeller")
    .replace("{riven_name}", "Conci-hexacron")
    .replace("{price}", "5")
    .replace("{weapon_name}", "Rubico");

  const handleSaveTemplate = async () => {
    setTemplateSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whisperTemplate }),
      });
      if (res.ok) {
        toast.success("Template saved");
      } else {
        const d = await res.json();
        toast.error(d.error ?? "Failed to save");
      }
    } catch {
      toast.error("Failed to save template");
    } finally {
      setTemplateSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setPasswordSaving(true);
    try {
      const res = await fetch("/api/user/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.ok) {
        toast.success("Password changed");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const d = await res.json();
        toast.error(d.error ?? "Failed to change password");
      }
    } catch {
      toast.error("Failed to change password");
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Whisper template, password, and account info.
        </p>
      </div>

      {/* Whisper template */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-medium">Whisper Template</h2>
        </div>

        <div className="space-y-2">
          <Input
            value={whisperTemplate}
            onChange={(e) => setWhisperTemplate(e.target.value)}
            className="font-mono text-xs"
            disabled={profileLoading}
          />
          <p className="text-[11px] text-muted-foreground font-mono">
            Variables: {"{ign}"} {"{riven_name}"} {"{price}"} {"{weapon_name}"}
          </p>
        </div>

        <div className="rounded-md bg-muted/40 border border-border/30 px-3 py-2">
          <p className="text-[11px] text-muted-foreground mb-0.5">Preview</p>
          <p className="text-xs font-mono text-primary">{previewMessage}</p>
        </div>

        <Button
          size="sm"
          onClick={handleSaveTemplate}
          disabled={templateSaving || profileLoading}
          className="gap-1.5"
        >
          <Save className="size-3.5" />
          {templateSaving ? "Saving..." : "Save"}
        </Button>
      </section>

      <Separator />

      {/* Password */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-medium">Change Password</h2>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="current" className="text-xs">
              Current password
            </Label>
            <Input
              id="current"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="h-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="new" className="text-xs">
                New password
              </Label>
              <Input
                id="new"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm" className="text-xs">
                Confirm
              </Label>
              <Input
                id="confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="h-9"
              />
            </div>
          </div>
          <Button size="sm" type="submit" disabled={passwordSaving} className="gap-1.5">
            {passwordSaving ? "Changing..." : "Change Password"}
          </Button>
        </form>
      </section>

      <Separator />

      {/* Account info */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <User className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-medium">Account</h2>
        </div>

        <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
          <span className="text-muted-foreground text-xs">Name</span>
          <span className="font-mono text-xs">{session?.user?.name}</span>
          <span className="text-muted-foreground text-xs">Email</span>
          <span className="font-mono text-xs">{session?.user?.email}</span>
          <span className="text-muted-foreground text-xs">Role</span>
          <span className="font-mono text-xs uppercase">{session?.user?.role}</span>
        </div>
      </section>
    </div>
  );
}
