import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { ListTodo } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({ meta: [{ title: "Vazifalar — Vazifa" }] }),
  component: TasksPage,
});

function TasksPage() {
  return (
    <AppShell title="Vazifalar">
      <Card className="glass border-dashed border-border/60">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <ListTodo className="size-10 text-muted-foreground" />
          <p className="text-muted-foreground">
            Vazifalar tizimi 3-bosqichda qo'shiladi (kunlik / muddatli / bir martalik).
          </p>
          <Link to="/sections" className="text-sm text-primary underline">
            Avval bo'limlarni sozlash →
          </Link>
        </CardContent>
      </Card>
    </AppShell>
  );
}
