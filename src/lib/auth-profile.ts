import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export async function ensureUserProfile(user: User) {
  const fullName =
    typeof user.user_metadata.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata.name === "string"
        ? user.user_metadata.name
        : user.email?.split("@")[0] ?? "Foydalanuvchi";

  const avatarUrl =
    typeof user.user_metadata.avatar_url === "string" ? user.user_metadata.avatar_url : null;

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      full_name: fullName,
      avatar_url: avatarUrl,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );

  if (error) throw error;
}
