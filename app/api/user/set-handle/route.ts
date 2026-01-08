import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    // createClient() 앞에 await를 추가합니다.
    const supabase = await createClient();

    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    if (authError || !session) {
      return NextResponse.json(
        { error: "인증되지 않은 요청입니다." },
        { status: 401 }
      );
    }

    const { handle } = await request.json();

    // 유저 정보 추출
    const userEmail = session.user.email || "";
    const userName =
      session.user.user_metadata?.full_name ||
      session.user.user_metadata?.name ||
      userEmail.split("@")[0];
    const userAvatar = session.user.user_metadata?.avatar_url || "";

    // 핸들 중복 여부 및 유저 생성/업데이트 (Admin 사용)
    const { error: upsertError } = await supabaseAdmin.from("users").upsert(
      {
        id: session.user.id,
        handle: handle,
        nickname: userName,
        icon_url: userAvatar,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "id",
      }
    );

    if (upsertError) {
      // 핸들 중복 에러 (unique constraint)
      if (upsertError.code === "23505") {
        return NextResponse.json(
          { error: "이미 사용 중인 아이디입니다." },
          { status: 409 }
        );
      }
      console.error("유저 생성/업데이트 실패:", upsertError);
      throw upsertError;
    }

    console.log(`✅ 유저 생성/업데이트 완료: ${session.user.id} (@${handle})`);
    return NextResponse.json({ success: true, handle });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
