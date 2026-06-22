import { createFileRoute } from "@tanstack/react-router";

const TG_API = "https://api.telegram.org";

function getMiniAppUrl(): string | null {
  return process.env.MINI_APP_URL || process.env.VITE_MINI_APP_URL || null;
}

function appButton() {
  const url = getMiniAppUrl();
  if (!url) return undefined;
  // WebApp button only works over HTTPS. Telegram opens it inside Telegram.
  return {
    inline_keyboard: [[{ text: "📱 Ilovani ochish", web_app: { url } }]],
  };
}

async function tgSend(chatId: number, text: string, withButton = false) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
  };
  if (withButton) {
    const rm = appButton();
    if (rm) body.reply_markup = rm;
  }
  const res = await fetch(`${TG_API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

function emailForChat(chatId: number) {
  return `tg${chatId}@telegram.local`;
}

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token) return new Response("Not configured", { status: 500 });

        const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
        if (expectedSecret) {
          const got = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
          if (got !== expectedSecret) {
            return new Response("Unauthorized", { status: 401 });
          }
        }

        const update = await request.json();
        const message = update.message ?? update.edited_message;
        if (!message?.chat?.id) return Response.json({ ok: true, ignored: true });

        const chatId: number = message.chat.id;
        const fromUsername: string | undefined = message.from?.username;
        const fromFirstName: string | undefined = message.from?.first_name;
        const text: string = (message.text ?? "").trim();

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        // ---------- Helpers ----------
        const linkedProfile = async () => {
          const { data } = await supabaseAdmin
            .from("profiles")
            .select("id,full_name,telegram_username")
            .eq("telegram_id", chatId)
            .maybeSingle();
          return data;
        };

        // ---------- Commands ----------
        if (text === "/start" || text === "/help") {
          const profile = await linkedProfile();
          if (profile) {
            await tgSend(
              chatId,
              `👋 Salom, <b>${profile.full_name ?? fromFirstName ?? "do'st"}</b>!\n\nBildirishnomalar shu yerga keladi. Ilovani ochish uchun pastdagi tugmani bosing.`,
              true,
            );
          } else {
            await tgSend(
              chatId,
              `👋 Salom${fromFirstName ? ", <b>" + fromFirstName + "</b>" : ""}!\n\nBu Vazifa Tizimi boti.\n\n🆕 /register — yangi hisob ochish\n🔗 /link — mavjud web hisobni Telegramga ulash\nℹ️ /help — yordam`,
            );
          }
          return Response.json({ ok: true });
        }

        if (text === "/cancel") {
          await supabaseAdmin
            .from("telegram_pending_registrations")
            .delete()
            .eq("chat_id", chatId);
          await tgSend(chatId, "❌ Bekor qilindi. /start");
          return Response.json({ ok: true });
        }

        if (text === "/register") {
          const existing = await linkedProfile();
          if (existing) {
            await tgSend(
              chatId,
              "✅ Sizning hisobingiz allaqachon ulangan. /start",
              true,
            );
            return Response.json({ ok: true });
          }
          await supabaseAdmin.from("telegram_pending_registrations").upsert(
            {
              chat_id: chatId,
              telegram_username: fromUsername ?? null,
              step: "await_name",
              full_name: null,
            },
            { onConflict: "chat_id" },
          );
          await tgSend(
            chatId,
            "📝 <b>Ro'yxatdan o'tish</b>\n\n1/2: Iltimos, to'liq ismingizni yuboring.\n\nBekor qilish: /cancel",
          );
          return Response.json({ ok: true });
        }

        if (text === "/link") {
          if (!fromUsername) {
            await tgSend(
              chatId,
              "❌ Telegram username sozlanmagan. Sozlamalardan username qo'shing.",
            );
            return Response.json({ ok: true });
          }
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("id,full_name")
            .ilike("telegram_username", fromUsername)
            .maybeSingle();
          if (!profile) {
            await tgSend(
              chatId,
              `❌ Web hisobingizda <code>${fromUsername}</code> username topilmadi. Web ilovaga kiring va Sozlamalar → Telegram username qatoriga shu username'ni kiriting. Yoki /register orqali yangi hisob oching.`,
            );
            return Response.json({ ok: true });
          }
          await supabaseAdmin
            .from("profiles")
            .update({ telegram_id: chatId })
            .eq("id", profile.id);
          await tgSend(
            chatId,
            `✅ <b>${profile.full_name ?? fromUsername}</b>, hisobingiz ulandi!`,
            true,
          );
          return Response.json({ ok: true });
        }

        // ---------- Multi-step registration ----------
        const { data: pending } = await supabaseAdmin
          .from("telegram_pending_registrations")
          .select("step,full_name,telegram_username")
          .eq("chat_id", chatId)
          .maybeSingle();

        if (pending?.step === "await_name") {
          const name = text.slice(0, 80);
          if (name.length < 2 || name.startsWith("/")) {
            await tgSend(chatId, "❌ Ism kamida 2 belgi bo'lsin. Qayta yuboring.");
            return Response.json({ ok: true });
          }
          await supabaseAdmin
            .from("telegram_pending_registrations")
            .update({ full_name: name, step: "await_password" })
            .eq("chat_id", chatId);
          await tgSend(
            chatId,
            "🔐 2/2: Endi <b>parol</b> tanlang (kamida 6 belgi). Bu parol bilan web saytga ham kira olasiz.\n\nBekor qilish: /cancel",
          );
          return Response.json({ ok: true });
        }

        if (pending?.step === "await_password") {
          const password = text;
          if (password.length < 6 || password.startsWith("/")) {
            await tgSend(
              chatId,
              "❌ Parol kamida 6 belgi bo'lsin. Qayta yuboring.",
            );
            return Response.json({ ok: true });
          }

          const email = emailForChat(chatId);
          const fullName =
            pending.full_name ?? fromFirstName ?? `user${chatId}`;
          const tgUser = pending.telegram_username ?? fromUsername ?? null;

          const { data: created, error: createErr } =
            await supabaseAdmin.auth.admin.createUser({
              email,
              password,
              email_confirm: true,
              user_metadata: { full_name: fullName },
            });

          if (createErr || !created.user) {
            await tgSend(
              chatId,
              `❌ Ro'yxatdan o'tishda xatolik: ${createErr?.message ?? "noma'lum"}. Qayta urinib ko'ring: /register`,
            );
            await supabaseAdmin
              .from("telegram_pending_registrations")
              .delete()
              .eq("chat_id", chatId);
            return Response.json({ ok: true });
          }

          // Profile is auto-created by handle_new_user trigger; update Telegram fields.
          await supabaseAdmin
            .from("profiles")
            .update({
              telegram_id: chatId,
              telegram_username: tgUser,
              full_name: fullName,
            })
            .eq("id", created.user.id);

          await supabaseAdmin
            .from("telegram_pending_registrations")
            .delete()
            .eq("chat_id", chatId);

          await tgSend(
            chatId,
            `✅ <b>Tabriklaymiz, ${fullName}!</b>\n\nHisobingiz yaratildi.\n\n🌐 <b>Web saytga kirish:</b>\n• Login (username): <code>tg${chatId}</code>${tgUser ? " yoki <code>" + tgUser + "</code>" : ""}\n• Parol: o'zingiz tanlagan parol\n\nIlovani Telegramda ochish uchun pastdagi tugmani bosing 👇`,
            true,
          );
          return Response.json({ ok: true });
        }

        // Fallback
        await tgSend(
          chatId,
          "Tushunmadim. Buyruqlar: /start /register /link /help",
        );
        return Response.json({ ok: true });
      },
    },
  },
});
