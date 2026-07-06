// Shared urgency/streak calculation logic.
// Pure functions only — no Supabase/React imports here, so this stays
// trivially unit-testable (see the checklist item: "kamida bitta oddiy
// qo'lda sinov" — just call getTaskUrgency(...) with fixture objects).

export type TaskType = "daily" | "deadline" | "onetime";

export type UrgencyTier = "onetime-urgent" | "deadline-streak" | "daily-overdue" | "none";

export interface UrgencyResult {
  tier: UrgencyTier;
  rank: number; // 1 = eng shoshilinch, saralash uchun
  reasonLabel: string; // UI'da ko'rsatish uchun qisqa matn
}

/**
 * Minimal shape getTaskUrgency/isDeadlineInStreak need. Deliberately a
 * subset of the `tasks` row (plus one derived flag) rather than the full
 * Supabase row type, so callers don't have to fight widening/narrowing on
 * `Database["public"]["Tables"]["tasks"]["Row"]` just to check urgency.
 */
export interface UrgencyTask {
  task_type: TaskType;
  status: string;
  created_at: string;
  deadline_at: string | null;
  reminder_at: string | null;
  metadata?: { progress_percent?: number } | null;
  /**
   * Whether a `daily_task_reports` row already exists for *today* for this
   * task. Only relevant for `task_type === "daily"`. Callers compute this
   * by joining against daily_task_reports themselves — this module has no
   * data access of its own on purpose.
   */
  reportedToday?: boolean;
}

const HOUR_MS = 3_600_000;
const COMPLETED_STATUSES = new Set(["completed", "cancelled"]);

/**
 * Muddatli vazifa "streak" holatidami — asosiy qoida:
 * - 24 soatdan kam qolgan bo'lsa -> HAR DOIM streak
 * - 80% vaqt o'tgan bo'lsa VA bajarilish foizi o'tgan vaqt foizidan kam
 *   bo'lsa -> streak
 */
export function isDeadlineInStreak(
  task: {
    created_at: string;
    deadline_at: string | null;
    metadata?: { progress_percent?: number } | null;
  },
  now: Date = new Date(),
): boolean {
  if (!task.deadline_at) return false;

  const deadlineAt = new Date(task.deadline_at).getTime();
  const createdAt = new Date(task.created_at).getTime();
  if (Number.isNaN(deadlineAt) || Number.isNaN(createdAt)) return false;

  const hoursLeft = (deadlineAt - now.getTime()) / HOUR_MS;
  if (hoursLeft <= 24) return true;

  const totalMs = deadlineAt - createdAt;
  const elapsedMs = now.getTime() - createdAt;
  const elapsedPct = totalMs > 0 ? (elapsedMs / totalMs) * 100 : 100;
  const progressPct = task.metadata?.progress_percent ?? 0;

  return elapsedPct >= 80 && progressPct < elapsedPct;
}

function formatHoursLeftLabel(hoursLeft: number): string {
  if (hoursLeft <= 0) return "Muddati o'tib ketdi";
  if (hoursLeft < 1) return "1 soatdan kam qoldi";
  return `${Math.ceil(hoursLeft)} soatdan kam qoldi`;
}

/**
 * Har bir vazifa turi uchun shoshilinchlik darajasini qaytaradi.
 * `null` = shoshilinch emas (UI'da ko'rsatilmasin).
 *
 * Chaqiruvchi (dashboard, tasks page) allaqachon faol vazifalarni yuklaydi
 * deb taxmin qilinadi, lekin ehtiyot chorasi sifatida completed/cancelled
 * statuslar bu yerda ham qat'iy rad etiladi.
 */
export function getTaskUrgency(task: UrgencyTask, now: Date = new Date()): UrgencyResult | null {
  if (COMPLETED_STATUSES.has(task.status)) return null;

  switch (task.task_type) {
    case "onetime": {
      if (!task.deadline_at) return null;
      const deadlineAt = new Date(task.deadline_at).getTime();
      if (Number.isNaN(deadlineAt)) return null;

      const hoursLeft = (deadlineAt - now.getTime()) / HOUR_MS;
      if (hoursLeft > 24) return null;

      return {
        tier: "onetime-urgent",
        rank: 1,
        reasonLabel: formatHoursLeftLabel(hoursLeft),
      };
    }

    case "deadline": {
      if (!isDeadlineInStreak(task, now)) return null;
      return {
        tier: "deadline-streak",
        rank: 2,
        reasonLabel: "Streak xavfida — muddat yaqinlashmoqda",
      };
    }

    case "daily": {
      if (!task.reminder_at) return null;
      if (task.reportedToday) return null;

      // reminder_at kunlik vazifalar uchun "kun ichidagi vaqt" signali
      // sifatida ishlatiladi (masalan 20:00) — sana qismi emas, faqat
      // soat:daqiqasi bugungi kunga qo'llanadi.
      const reminder = new Date(task.reminder_at);
      if (Number.isNaN(reminder.getTime())) return null;

      const todayReminder = new Date(now);
      todayReminder.setHours(reminder.getHours(), reminder.getMinutes(), 0, 0);

      if (now.getTime() < todayReminder.getTime()) return null;

      return {
        tier: "daily-overdue",
        rank: 3,
        reasonLabel: "Bugungi hisobot hali kiritilmagan",
      };
    }

    default:
      return null;
  }
}
