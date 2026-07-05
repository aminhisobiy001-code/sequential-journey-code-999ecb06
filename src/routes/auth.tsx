import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Send } from "lucide-react";

// Public — not a secret. Set this to your bot's @username (no "@") via a
// VITE_TELEGRAM_BOT_USERNAME env var (Cloudflare Worker vars + local .env).
const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined;
const BOT_URL = BOT_USERNAME ? `https://t.me/${BOT_USERNAME}` : undefined;

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Kirish — Vazifa Tizimi" },
      { name: "description", content: "Telegram bot orqali kiring." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  useEffect(() => {
    // Agar biz Telegram Mini App ichida bo'lsak, __root.tsx hali fonda
    // initData orqali login qilishga urinayotgan bo'lishi mumkin.
    // window.location.assign() butun sahifani (va shu bilan birga
    // tugamagan login so'rovini) o'ldiradi — shuning uchun Mini App
    // ichida bo'lsak, botga hech qachon avto-redirect qilmaymiz.
    if (!BOT_URL) return;
    if (typeof window !== "undefined" && window.Telegram?.WebApp?.initData) {
      return;
    }
    const timer = setTimeout(() => {
      window.location.assign(BOT_URL);
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <main className="aurora-bg flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2 text-foreground">
          <Sparkles className="size-6 text-primary" />
          <span className="font-display text-2xl font-bold">Vazifa</span>
        </Link>

        <Card className="glass border-border/50">
          <CardHeader className="text-center">
            <CardTitle className="font-display text-2xl">Telegram orqali kiring</CardTitle>
            <CardDescription>
              Login yoki parol yo'q — kirish faqat Telegram bot orqali, avtomatik amalga oshiriladi.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Botni oching va <code>/start</code> yuboring — chiqqan xabardagi{" "}
              <b>"📱 Ilovani ochish"</b> tugmasi sizni avtomatik tizimga kiritadi.
            </p>
            {BOT_URL ? (
              <Button asChild className="w-full">
                <a href={BOT_URL} target="_blank" rel="noreferrer">
                  <Send className="mr-2 size-4" />
                  Botni ochish
                </a>
              </Button>
            ) : (
              <p className="text-xs text-destructive">
                Bot username sozlanmagan (VITE_TELEGRAM_BOT_USERNAME). Iltimos, Telegramda botingizni
                qidirib toping va /start yuboring.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}