import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Settings as SettingsIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Sozlamalar — Vazifa" }] }),
  component: () => (
    <AppShell title="Sozlamalar">
      <Card className="glass border-dashed border-border/60">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <SettingsIcon className="size-10 text-muted-foreground" />
          <p className="text-muted-foreground">Sozlamalar 6-bosqichda qo'shiladi.</p>
        </CardContent>
      </Card>
    </AppShell>
  ),
});
