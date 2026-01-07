import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { createClient } from "@/lib/supabase-server";

// 브라우저 확장 프로그램이나 북마클릿에서 호출할 때 필요한 CORS 설정
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://maimaidx-eng.com", // 또는 "*" (보안상 도메인 지정 권장)
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Credentials": "true",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    // 1. 세션 확인 (Next.js 15 비동기 cookies 대응된 createClient 호출)
    const supabase = await createClient();
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    if (authError || !session) {
      return NextResponse.json(
        { error: "웹사이트에서 먼저 로그인을 해주세요." },
        { status: 401, headers: corsHeaders }
      );
    }

    const userId = session.user.id;
    const body = await request.json();
    const { records, userProfile } = body;

    console.log(
      `🚀 유저(${userId}) 데이터 처리 시작: ${records?.length || 0}곡`
    );

    // 2. [프로필 업데이트] - Admin 권한 사용
    if (userProfile) {
      const { error: profileErr } = await supabaseAdmin.from("users").upsert({
        id: userId,
        nickname: userProfile.nickname,
        icon_url: userProfile.iconUrl,
        title: userProfile.title,
        title_image_url: userProfile.titleImageUrl,
        dan_grade_url: userProfile.danGradeUrl,
        friend_rank_url: userProfile.friendRankUrl,
        total_stars: userProfile.totalStars,
        play_count_total: userProfile.playCountTotal,
        play_count_version: userProfile.playCountVersion,
        updated_at: new Date().toISOString(),
      });
      if (profileErr) console.error("👤 프로필 저장 실패:", profileErr.message);
    }

    if (!records || records.length === 0) {
      return NextResponse.json({ success: true }, { headers: corsHeaders });
    }

    // 3. [데이터 분할 처리 (Chunking)]
    const CHUNK_SIZE = 200;
    const allTitles = Array.from(
      new Set(records.map((r: any) => r.title))
    ).filter(Boolean);

    // A. 곡 마스터 정보 저장 (musics 테이블)
    for (let i = 0; i < allTitles.length; i += CHUNK_SIZE) {
      const chunk = allTitles.slice(i, i + CHUNK_SIZE);
      await supabaseAdmin.from("musics").upsert(
        chunk.map((t) => ({ title: t })),
        { onConflict: "title" }
      );
    }

    // B. 곡 ID 매핑 데이터 생성
    let musicMap = new Map();
    for (let i = 0; i < allTitles.length; i += CHUNK_SIZE) {
      const chunk = allTitles.slice(i, i + CHUNK_SIZE);
      const { data } = await supabaseAdmin
        .from("musics")
        .select("id, title")
        .in("title", chunk);
      data?.forEach((m) => musicMap.set(m.title, m.id));
    }

    // C. 곡 상세(난이도) 정보 저장 (music_details 테이블)
    const detailRows = records
      .map((r: any) => {
        const mId = musicMap.get(r.title);
        return mId
          ? {
              music_id: mId,
              difficulty_type: r.difficulty_type,
              is_dx: r.is_dx,
              difficulty_value: r.level,
              internal_level: r.level,
              level: Math.floor(r.level),
            }
          : null;
      })
      .filter(Boolean);

    for (let i = 0; i < detailRows.length; i += CHUNK_SIZE) {
      const chunk = detailRows.slice(i, i + CHUNK_SIZE);
      await supabaseAdmin
        .from("music_details")
        .upsert(chunk, { onConflict: "music_id,difficulty_type,is_dx" });
    }

    // D. 사용자 기록 매핑 및 최종 저장 (user_records 테이블)
    let finalDetailMap = new Map();
    const musicIds = Array.from(musicMap.values());
    for (let i = 0; i < musicIds.length; i += CHUNK_SIZE) {
      const chunk = musicIds.slice(i, i + CHUNK_SIZE);
      const { data } = await supabaseAdmin
        .from("music_details")
        .select("id, music_id, difficulty_type, is_dx")
        .in("music_id", chunk);

      data?.forEach((d) => {
        finalDetailMap.set(
          `${d.music_id}-${d.difficulty_type}-${d.is_dx}`,
          d.id
        );
      });
    }

    const recordRows = records
      .map((r: any) => {
        const mId = musicMap.get(r.title);
        const dId = finalDetailMap.get(
          `${mId}-${r.difficulty_type}-${r.is_dx}`
        );
        return dId
          ? {
              user_id: userId,
              music_detail_id: dId,
              achievement: r.achievement,
            }
          : null;
      })
      .filter(Boolean);

    for (let i = 0; i < recordRows.length; i += CHUNK_SIZE) {
      const chunk = recordRows.slice(i, i + CHUNK_SIZE);
      await supabaseAdmin
        .from("user_records")
        .upsert(chunk, { onConflict: "user_id,music_detail_id" });
    }

    console.log(
      `✅ 유저(${userId}) 전적 업데이트 완료: ${recordRows.length}개`
    );
    return NextResponse.json(
      { success: true, count: recordRows.length },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error("🔥 서버 치명적 에러:", error.message);
    return NextResponse.json(
      { error: "서버 내부 오류가 발생했습니다." },
      { status: 500, headers: corsHeaders }
    );
  }
}
