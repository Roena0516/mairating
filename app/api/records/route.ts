import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { records, userProfile } = body;
    const userId = "00000000-0000-0000-0000-000000000000";

    console.log(`🚀 데이터 수신됨. 총 ${records?.length || 0}곡 처리 시작`);

    // 1. [유저 프로필 업데이트]
    if (userProfile) {
      await supabaseAdmin.from("users").upsert({
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
      console.log("👤 프로필 업데이트 완료");
    }

    if (!records || records.length === 0) {
      return NextResponse.json({ success: true }, { headers: corsHeaders });
    }

    // --- 대량 데이터 분할 처리 (Chunking) 시작 ---
    const CHUNK_SIZE = 200; // 200곡씩 나누어서 처리
    const allTitles = Array.from(
      new Set(records.map((r: any) => r.title))
    ).filter(Boolean);

    // 2. [곡 기본 정보 저장] - 전체 곡 제목 등록
    for (let i = 0; i < allTitles.length; i += CHUNK_SIZE) {
      const chunk = allTitles.slice(i, i + CHUNK_SIZE);
      await supabaseAdmin.from("musics").upsert(
        chunk.map((t) => ({ title: t })),
        { onConflict: "title" }
      );
    }

    // 3. [곡 ID 조회 및 상세정보 저장] - 쪼개서 조회 후 처리
    let fullMusicList: any[] = [];
    for (let i = 0; i < allTitles.length; i += CHUNK_SIZE) {
      const chunk = allTitles.slice(i, i + CHUNK_SIZE);
      const { data } = await supabaseAdmin
        .from("musics")
        .select("id, title")
        .in("title", chunk);
      if (data) fullMusicList = [...fullMusicList, ...data];
    }

    if (fullMusicList.length === 0)
      throw new Error("DB에서 곡 목록을 불러오지 못했습니다.");

    // 4. [곡 상세 정보 저장]
    const musicDetailsRows = records
      .map((r: any) => {
        const music = fullMusicList.find((m) => m.title === r.title);
        return music
          ? {
              music_id: music.id,
              difficulty_type: r.difficulty_type,
              is_dx: r.is_dx,
              difficulty_value: r.level,
              internal_level: r.level,
              level: Math.floor(r.level),
            }
          : null;
      })
      .filter(Boolean);

    for (let i = 0; i < musicDetailsRows.length; i += CHUNK_SIZE) {
      const chunk = musicDetailsRows.slice(i, i + CHUNK_SIZE);
      await supabaseAdmin
        .from("music_details")
        .upsert(chunk, { onConflict: "music_id,difficulty_type,is_dx" });
    }

    // 5. [사용자 기록 저장]
    // 상세 정보 ID 매핑을 위해 다시 조회 (역시 쪼개서)
    let finalDetails: any[] = [];
    const musicIds = fullMusicList.map((m) => m.id);
    for (let i = 0; i < musicIds.length; i += CHUNK_SIZE) {
      const chunk = musicIds.slice(i, i + CHUNK_SIZE);
      const { data } = await supabaseAdmin
        .from("music_details")
        .select("id, music_id, difficulty_type, is_dx")
        .in("music_id", chunk);
      if (data) finalDetails = [...finalDetails, ...data];
    }

    const finalRecords = records
      .map((r: any) => {
        const music = fullMusicList.find((m) => m.title === r.title);
        const detail = finalDetails.find(
          (d) =>
            d.music_id === music?.id &&
            d.difficulty_type === r.difficulty_type &&
            d.is_dx === r.is_dx
        );
        return detail
          ? {
              user_id: userId,
              music_detail_id: detail.id,
              achievement: r.achievement,
            }
          : null;
      })
      .filter(Boolean);

    for (let i = 0; i < finalRecords.length; i += CHUNK_SIZE) {
      const chunk = finalRecords.slice(i, i + CHUNK_SIZE);
      await supabaseAdmin
        .from("user_records")
        .upsert(chunk, { onConflict: "user_id,music_detail_id" });
    }

    console.log(`✅ ${finalRecords.length}개 기록 저장 완료!`);
    return NextResponse.json(
      { success: true, count: finalRecords.length },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error("❌ 서버 상세 에러:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 400, headers: corsHeaders }
    );
  }
}
