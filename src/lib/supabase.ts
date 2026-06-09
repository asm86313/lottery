import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// 서버 전용 클라이언트 — API Route에서만 사용, RLS 우회
export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false },
});
