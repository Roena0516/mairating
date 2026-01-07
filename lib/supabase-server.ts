import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// 함수 앞에 async를 추가합니다.
export async function createClient() {
  const cookieStore = await cookies(); // cookies()는 이제 Promise를 반환하므로 await가 필수입니다.

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // 서버 액션이나 리다이렉트 시 쿠키 수정 오류 방지
          }
        },
      },
    }
  );
}
