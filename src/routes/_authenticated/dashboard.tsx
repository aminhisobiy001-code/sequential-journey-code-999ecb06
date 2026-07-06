import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Clock,
  ListTodo,
  Folder,
  Plus,
  Repeat,
  CalendarClock,
  Zap,
  Sparkles,
} from "lucide-react";
import { getTaskUrgency, type UrgencyResult, type TaskType } from "@/lib/task-priority";
import type { Json } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Boshqaruv paneli — Vazifa" }] }),
  component: Dashboard,
});

type Profile = { full_name: string | null };

// Only the columns getTaskUrgency + the list UI actually need.
type ActiveTask = {
  id: string;
  title: string;
  task_type: TaskType;
  status: string;
  created_at: string;
  deadline_at: string | null;
  reminder_at: string | null;
  metadata: Json;
};

type UrgentTask = ActiveTask & { urgency: UrgencyResult };

const TYPE_ICON: Record<TaskType, typeof Zap> = {
  onetime: Zap,
  deadline: CalendarClock,
  daily: Repeat,
};

function getProgressPercent(metadata: Json): number | undefined {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const value = (metadata as Record<string, unknown>).progress_percent;
    return typeof value === "number" ? value : undefined;
  }
  return undefined;
}

function todayDateString(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Har bir shoshilinch vazifa uchun saralash uchun eng yaqin "nazorat nuqtasi"
// (deadline_at, bo'lmasa reminder_at, ikkalasi ham yo'q bo'lsa cheksiz).
function sortTimestamp(task: ActiveTask): number {
  const ref = task.deadline_at ?? task.reminder_at;
  if (!ref) return Number.POSITIVE_INFINITY;
  const t = new Date(ref).getTime();
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

function useUrgentTasks(userId: string | undefined) {
  return useQuery({
    queryKey: ["urgent-tasks", userId],
    enabled: !!userId,
    queryFn: async (): Promise<UrgentTask[]> => {
      const today = todayDateString();

      const [{ data: tasks, error: tasksError }, { data: reportsToday, error: reportsError }] =
        await Promise.all([
          supabase
            .from("tasks")
            .select("id,title,task_type,status,created_at,deadline_at,reminder_at,metadata")
            .eq("user_id", userId!)
            .not("status", "in", "(completed,cancelled)"),
          supabase
            .from("daily_task_reports")
            .select("task_id")
            .eq("user_id", userId!)
            .eq("occurred_on", today),
        ]);

      if (tasksError) throw tasksError;
      if (reportsError) throw reportsError;

      const reportedTodayIds = new Set((reportsToday ?? []).map((r) => r.task_id));

      const urgent: UrgentTask[] = [];
      for (const t of (tasks ?? []) as ActiveTask[]) {
        const urgency = getTaskUrgency(
          {
            task_type: t.task_type,
            status: t.status,
            created_at: t.created_at,
            deadline_at: t.deadline_at,
            reminder_at: t.reminder_at,
            metadata: { progress_percent: getProgressPercent(t.metadata) },
            reportedToday: reportedTodayIds.has(t.id),
          },
          new Date(),
        );
        if (urgency) urgent.push({ ...t, urgency });
      }

      // Avval rank (1 -> 3) bo'yicha, so'ng har guruh ichida eng yaqin
      // muddat/vaqt bo'yicha saralaymiz.
      urgent.sort((a, b) => {
        if (a.urgency.rank !== b.urgency.rank) return a.urgency.rank - b.urgency.rank;
        return sortTimestamp(a) - sortTimestamp(b);
      });

      return urgent;
    },
  });
}

function Dashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [stats, setStats] = useState({ total: 0, done: 0, pending: 0, sections: 0 });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const [{ data: prof }, { count: total }, { count: done }, { count: pending }, { count: sectionsCount }] =
        await Promise.all([
          supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
          supabase.from("tasks").select("*", { count: "exact", head: true }).eq("user_id", user.id),
          supabase.from("tasks").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "completed"),
          supabase.from("tasks").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "pending"),
          supabase.from("sections").select("*", { count: "exact", head: true }).eq("created_by", user.id).eq("is_active", true),
        ]);
      setProfile(prof);
      setStats({
        total: total ?? 0,
        done: done ?? 0,
        pending: pending ?? 0,
        sections: sectionsCount ?? 0,
      });
    })();
  }, []);

  const { data: urgentTasks = [], isLoading: urgentLoading } = useUrgentTasks(userId);

  return (
    <AppShell
      title="Boshqaruv paneli"
      actions={
        <Button asChild size="sm">
          <Link to="/sections">
            <Plus className="size-4" /> Bo'limlar
          </Link>
        </Button>
      }
    >
      <div className="mb-8">
        <h2 className="font-display text-2xl font-bold md:text-3xl">
          Assalomu alaykum, {profile?.full_name ?? "Foydalanuvchi"} 👋
        </h2>
        <p className="mt-2 text-muted-foreground">Bugungi vazifalaringizning umumiy ko'rinishi.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<ListTodo className="size-5" />} label="Jami vazifalar" value={stats.total} />
        <StatCard icon={<CheckCircle2 className="size-5 text-success" />} label="Bajarilgan" value={stats.done} />
        <StatCard icon={<Clock className="size-5 text-warning" />} label="Kutilmoqda" value={stats.pending} />
        <StatCard icon={<Folder className="size-5 text-accent" />} label="Bo'limlar" value={stats.sections} />
      </div>

      <UrgentTasksList tasks={urgentTasks} isLoading={urgentLoading} />
    </AppShell>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="glass border-border/50">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{label}</span>
          {icon}
        </div>
        <div className="mt-2 font-display text-3xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function UrgentTasksList({ tasks, isLoading }: { tasks: UrgentTask[]; isLoading: boolean }) {
  return (
    <Card className="mt-8 glass border-border/50">
      <CardHeader>
        <CardTitle className="font-display">Shoshilinch vazifalar</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-muted-foreground">Yuklanmoqda…</div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Sparkles className="size-8 text-muted-foreground" />
            <p className="text-muted-foreground">Hozircha shoshilinch vazifa yo'q — hammasi nazoratda 🎉</p>
          </div>
        ) : (
          <ul className="divide-y divide-border/40">
            {tasks.map((t) => {
              const Icon = TYPE_ICON[t.task_type];
              return (
                <li key={t.id} className="flex items-center gap-3 py-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{t.title}</div>
                    <div className="text-xs text-muted-foreground">{t.urgency.reasonLabel}</div>
                  </div>
                  <Badge variant="destructive" className="shrink-0">
                    {t.urgency.tier === "onetime-urgent"
                      ? "Shoshilinch"
                      : t.urgency.tier === "deadline-streak"
                        ? "Streak xavfi"
                        : "Hisobot yo'q"}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}