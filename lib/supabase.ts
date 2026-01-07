import { createClient } from "@supabase/supabase-js";

// 환경 변수가 없을 경우 에러를 미리 방지
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("환경 변수가 없습니다.");
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
