import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ensureUserProfile } from "@/lib/auth-profile";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Mini App ichida bo'lsak, __root.tsx fonda login qilib bo'lguncha
    // biroz kutamiz — aks holda foydalanuvchi login tugashidan oldin
    // /auth ga otilib ketadi.
    if (typeof window !== "undefined" && window.Telegram?.WebApp?.initData) {
      for (let i = 0; i < 20; i++) {
        const { data } = await supabase.auth.getSession();
        if (data.session) break;
        await new Promise((r) => setTimeout(r, 150));
      }
    }
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    await ensureUserProfile(data.user);
    return { user: data.user };
  },
  component: () => <Outlet />,
});
