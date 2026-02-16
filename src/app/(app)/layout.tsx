import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ScanProgress } from "@/components/scan-progress";
import { UserProfileProvider } from "@/components/user-profile-context";
import { Separator } from "@/components/ui/separator";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserProfileProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="min-h-0 h-svh overflow-hidden flex flex-col">
          <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border/30 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <ScanProgress />
          </header>
          <main className="flex-1 min-h-0 flex flex-col overflow-auto min-w-0">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </UserProfileProvider>
  );
}
