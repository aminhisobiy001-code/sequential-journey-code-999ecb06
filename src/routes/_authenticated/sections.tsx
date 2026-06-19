import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Folder } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/sections")({
  head: () => ({ meta: [{ title: "Bo'limlar — Vazifa" }] }),
  component: SectionsPage,
});

type Section = {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  sort_order: number;
  is_active: boolean;
};

const ICONS = ["briefcase", "user", "heart-pulse", "book-open", "wallet", "home", "sparkles", "folder", "target", "rocket"];
const COLORS = ["#6366f1", "#ec4899", "#ef4444", "#22c55e", "#f59e0b", "#06b6d4", "#a855f7", "#14b8a6"];

function useSections() {
  return useQuery({
    queryKey: ["sections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sections")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as Section[];
    },
  });
}

function SectionsPage() {
  const { data: sections = [], isLoading } = useSections();
  const [editing, setEditing] = useState<Section | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <AppShell
      title="Bo'limlar"
      actions={
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="size-4" /> Yangi
        </Button>
      }
    >
      <p className="mb-6 text-sm text-muted-foreground">
        Vazifalaringizni hayot sohalari bo'yicha tartibga soling. Har bir bo'lim o'z rangi va ikonkasiga ega.
      </p>

      {isLoading ? (
        <div className="text-muted-foreground">Yuklanmoqda…</div>
      ) : sections.length === 0 ? (
        <Card className="glass border-dashed border-border/60">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Folder className="size-10 text-muted-foreground" />
            <p className="text-muted-foreground">Hali bo'limlar yo'q. Birinchisini qo'shing.</p>
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" /> Yangi bo'lim
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((s) => (
            <SectionCard
              key={s.id}
              section={s}
              onEdit={() => {
                setEditing(s);
                setOpen(true);
              }}
            />
          ))}
        </div>
      )}

      <SectionDialog open={open} onOpenChange={setOpen} section={editing} />
    </AppShell>
  );
}

function SectionCard({ section, onEdit }: { section: Section; onEdit: () => void }) {
  const qc = useQueryClient();

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("sections").delete().eq("id", section.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("O'chirildi");
      qc.invalidateQueries({ queryKey: ["sections"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (is_active: boolean) => {
      const { error } = await supabase.from("sections").update({ is_active }).eq("id", section.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sections"] }),
  });

  return (
    <Card className="glass border-border/50">
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div
              className="flex size-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: section.color + "22", color: section.color }}
            >
              <Folder className="size-5" />
            </div>
            <div>
              <div className="font-semibold">{section.name}</div>
              {section.description && (
                <div className="text-xs text-muted-foreground">{section.description}</div>
              )}
            </div>
          </div>
          {!section.is_active && <Badge variant="secondary">O'chirilgan</Badge>}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch
              checked={section.is_active}
              onCheckedChange={(v) => toggle.mutate(v)}
            />
            Faol
          </div>
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" onClick={onEdit}>
              <Pencil className="size-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                if (confirm(`"${section.name}" o'chirilsinmi?`)) del.mutate();
              }}
            >
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionDialog({
  open,
  onOpenChange,
  section,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  section: Section | null;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: section?.name ?? "",
    description: section?.description ?? "",
    icon: section?.icon ?? "folder",
    color: section?.color ?? COLORS[0],
    sort_order: section?.sort_order ?? 0,
  });

  // re-init when section changes
  useState(() => {
    setForm({
      name: section?.name ?? "",
      description: section?.description ?? "",
      icon: section?.icon ?? "folder",
      color: section?.color ?? COLORS[0],
      sort_order: section?.sort_order ?? 0,
    });
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Nom kiritilishi shart");
      const { data: { user } } = await supabase.auth.getUser();
      if (section) {
        const { error } = await supabase.from("sections").update(form).eq("id", section.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("sections").insert({ ...form, created_by: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(section ? "Yangilandi" : "Qo'shildi");
      qc.invalidateQueries({ queryKey: ["sections"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">{section ? "Bo'limni tahrirlash" : "Yangi bo'lim"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nom</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Masalan: Ish"
            />
          </div>
          <div>
            <Label>Tavsif</Label>
            <Textarea
              value={form.description ?? ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Qisqa tavsif"
              rows={2}
            />
          </div>
          <div>
            <Label>Rang</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  className="size-8 rounded-full border-2 transition"
                  style={{
                    backgroundColor: c,
                    borderColor: form.color === c ? "white" : "transparent",
                    boxShadow: form.color === c ? `0 0 0 2px ${c}` : undefined,
                  }}
                />
              ))}
            </div>
          </div>
          <div>
            <Label>Tartib raqami</Label>
            <Input
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Bekor qilish
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saqlanmoqda…" : "Saqlash"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
