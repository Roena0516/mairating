import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://maimaidx-eng.com",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Credentials": "true",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401, headers: corsHeaders }
      );
    }

    const userId = session.user.id;
    const body = await request.json();
    const { records, userProfile } = body;

    console.log(`🚀 유저(${userId}) 데이터 처리 시작: ${records?.length || 0}곡`);

    // 1. 유저 프로필 업데이트 (Admin 권한)
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

      if (profileErr) {
        console.error("프로필 업데이트 실패:", profileErr);
      }
    }

    if (!records || records.length === 0) {
      return NextResponse.json({ success: true }, { headers: corsHeaders });
    }

    // 2. 곡 마스터 데이터(musics) 및 상세 정보(music_details) 처리
    const CHUNK_SIZE = 200;
    const allTitles = Array.from(new Set(records.map((r: any) => r.title)));

    // 곡 제목 등록 (청킹)
    for (let i = 0; i < allTitles.length; i += CHUNK_SIZE) {
      const chunk = allTitles.slice(i, i + CHUNK_SIZE);
      await supabaseAdmin.from("musics").upsert(
        chunk.map((t) => ({ title: t })),
        { onConflict: "title" }
      );
    }

    // ID 매핑을 위해 다시 조회 (청킹)
    const musicMap = new Map<string, number>();
    for (let i = 0; i < allTitles.length; i += CHUNK_SIZE) {
      const chunk = allTitles.slice(i, i + CHUNK_SIZE);
      const { data: musics } = await supabaseAdmin
        .from("musics")
        .select("id, title")
        .in("title", chunk);
      musics?.forEach((m) => musicMap.set(m.title, m.id));
    }

    // 곡 상세(난이도) 등록
    const detailRows = records
      .map((r: any) => ({
        music_id: musicMap.get(r.title),
        difficulty_type: r.difficulty_type,
        is_dx: r.is_dx,
        internal_level: r.level || 0,
      }))
      .filter((d) => d.music_id); // music_id가 없는 경우 제외

    // music_details 청킹 저장
    for (let i = 0; i < detailRows.length; i += CHUNK_SIZE) {
      const chunk = detailRows.slice(i, i + CHUNK_SIZE);
      await supabaseAdmin.from("music_details").upsert(chunk, {
        onConflict: "music_id,difficulty_type,is_dx",
      });
    }

    // 최종 매핑 ID 조회 (청킹)
    const detailMap = new Map<string, number>();
    const musicIds = Array.from(musicMap.values());
    for (let i = 0; i < musicIds.length; i += CHUNK_SIZE) {
      const chunk = musicIds.slice(i, i + CHUNK_SIZE);
      const { data: details } = await supabaseAdmin
        .from("music_details")
        .select("id, music_id, difficulty_type, is_dx")
        .in("music_id", chunk);

      details?.forEach((d) =>
        detailMap.set(`${d.music_id}-${d.difficulty_type}-${d.is_dx}`, d.id)
      );
    }

    // 3. 유저 전적(user_records) 최종 저장
    const recordRows = records
      .map((r: any) => {
        const mId = musicMap.get(r.title);
        const dId = detailMap.get(`${mId}-${r.difficulty_type}-${r.is_dx}`);
        return dId
          ? {
              user_id: userId,
              music_detail_id: dId,
              achievement: r.achievement,
              fc_type: r.fc_type,
              fs_type: r.fs_type,
            }
          : null;
      })
      .filter(Boolean);

    // Chunk 단위 저장 (안정성)
    for (let i = 0; i < recordRows.length; i += CHUNK_SIZE) {
      await supabaseAdmin
        .from("user_records")
        .upsert(recordRows.slice(i, i + CHUNK_SIZE), {
          onConflict: "user_id,music_detail_id",
        });
    }

    console.log(`✅ 유저(${userId}) 전적 업데이트 완료: ${recordRows.length}개`);
    return NextResponse.json(
      { success: true, count: recordRows.length },
      { headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("🔥 서버 치명적 에러:", err);
    return NextResponse.json(
      { error: err.message || "서버 내부 오류가 발생했습니다." },
      { status: 500, headers: corsHeaders }
    );
  }
}
