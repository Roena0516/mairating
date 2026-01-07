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

    // 핸들 중복 여부 및 업데이트 (Admin 사용)
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({ handle: handle })
      .eq("id", session.user.id);

    if (updateError) {
      if (updateError.code === "23505") {
        return NextResponse.json(
          { error: "이미 사용 중인 아이디입니다." },
          { status: 409 }
        );
      }
      throw updateError;
    }

    return NextResponse.json({ success: true, handle });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
