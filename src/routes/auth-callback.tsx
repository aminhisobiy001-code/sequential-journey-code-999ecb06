import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ensureUserProfile } from "@/lib/auth-profile";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/auth-callback")({
  head: () => ({
    meta: [{ title: "Kirilmoqda… — Vazifa Tizimi" }],
  }),
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  // token_hash bir martalik: agar bu effekt biror sababdan (masalan xabardagi
  // tugma va matn havolasi bir xil tokenga ishora qilgani, yoki komponent
  // qayta render bo'lgani uchun) ikki marta ishga tushsa, ikkinchi verifyOtp
  // chaqiruvi har doim "invalid or expired" bilan yakunlanadi. Shu himoya bitta
  // mount uchun faqat bitta urinishga yo'l qo'yadi.
  const hasAttempted = useRef(false);

  useEffect(() => {
    if (hasAttempted.current) return;
    hasAttempted.current = true;

    let cancelled = false;

    const goToDashboard = async (user: User) => {
      try {
        await ensureUserProfile(user);
      } catch {
        // Non-fatal: profile trigger usually already handles this.
      }
      if (!cancelled) navigate({ to: "/dashboard" });
    };

    const run = async () => {
      // 1) Avval joriy sessiyani tekshiramiz. Havola allaqachon boshqa yo'l
      // bilan (masalan botdagi "Ilovani ochish" tugmasi, keyin xabardagi
      // matn havolasi) ishlatilgan bo'lsa, sessiya allaqachon mavjud bo'ladi.
      // Bunday holatda token_hash'ni qayta tekshirish shart emas — u
      // bir martalik bo'lgani uchun ikkinchi tekshiruv doim
      // "Email link is invalid or has expired" bilan tugaydi. Sessiya bor
      // bo'lsa, shunchaki dashboard'ga o'tkazamiz.
      const { data: sessionData } = await supabase.auth.getSession();
      if (cancelled) return;
      if (sessionData.session?.user) {
        await goToDashboard(sessionData.session.user);
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const tokenHash = params.get("token_hash");
      const type = params.get("type");

      if (!tokenHash || !type) {
        if (!cancelled) setError("Havola yaroqsiz. Botga qaytib /start yuboring.");
        return;
      }

      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as "magiclink" | "email",
      });

      if (cancelled) return;

      if (verifyError || !data.user) {
        // Oxirgi imkoniyat: parallel bir urinish (masalan boshqa tabda)
        // orada muvaffaqiyatli bo'lgan bo'lishi mumkin — sessiyani yana bir
        // bor tekshiramiz, aks holda foydalanuvchiga xatoni ko'rsatamiz.
        const { data: recheck } = await supabase.auth.getSession();
        if (!cancelled && recheck.session?.user) {
          await goToDashboard(recheck.session.user);
          return;
        }
        if (!cancelled) {
          setError(
            verifyError?.message ??
              "Havola muddati o'tgan yoki allaqachon ishlatilgan. Botga qaytib /start yuboring.",
          );
        }
        return;
      }

      await goToDashboard(data.user);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <main className="aurora-bg flex min-h-screen items-center justify-center px-4 py-12 text-center">
      <div className="flex flex-col items-center gap-4">
        <Sparkles className="size-8 text-primary" />
        {error ? (
          <>
            <p className="max-w-sm text-sm text-destructive">{error}</p>
            <a href="/auth" className="text-sm text-primary underline underline-offset-4">
              Login sahifasiga o'tish
            </a>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Tizimga kirilmoqda…</p>
        )}
      </div>
    </main>
  );
}