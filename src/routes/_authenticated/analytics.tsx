import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analitika — Vazifa" }] }),
  component: () => (
    <AppShell title="Analitika">
      <Card className="glass border-dashed border-border/60">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <BarChart3 className="size-10 text-muted-foreground" />
          <p className="text-muted-foreground">Analitika 5-bosqichda qo'shiladi.</p>
        </CardContent>
      </Card>
    </AppShell>
  ),
});
