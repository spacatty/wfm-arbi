import { StatsCards } from "@/components/stats-cards";
import { DealTable } from "@/components/deal-table";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { EndoDashboardControls } from "@/components/endo-dashboard-controls";

export default function DashboardPage() {
  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden w-full max-w-none px-5 py-5 gap-5">
      {/* Compact header: title + scan controls + sidebar inline */}
      <div className="shrink-0 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold tracking-tight">Rank Value</h1>
            <p className="text-xs text-muted-foreground">
              Rivens priced below rank-based endo dissolution value
            </p>
          </div>
          <div className="flex items-center gap-3">
            <EndoDashboardControls />
            <DashboardSidebar />
          </div>
        </div>
        <StatsCards />
      </div>
      {/* Table fills remaining height and scrolls */}
      <div className="flex-1 min-h-0 flex flex-col min-w-0">
        <DealTable />
      </div>
    </div>
  );
}
