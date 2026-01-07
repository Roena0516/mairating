import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { computeBestRating } from "@/lib/rating";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId"); // 유동적으로 변경

    const { data: records, error } = await supabaseAdmin
      .from("user_records")
      .select(
        `
        achievement,
        music_details (
          internal_level,
          difficulty_type,
          is_dx,
          musics (title, version)
        )
      `
      )
      .eq("user_id", userId);

    if (error) throw error;

    // 분리한 lib 함수 호출
    const result = computeBestRating(records || []);

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
