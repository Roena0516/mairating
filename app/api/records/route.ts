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

    // 보안 강화: getSession 대신 getUser 사용
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401, headers: corsHeaders }
      );
    }

    // ... 상단 인증 로직 생략 (기존과 동일)

    const userId = user.id;
    const { records, userProfile } = await request.json();

    console.log(
      `🚀 유저(${userId}) 데이터 처리 시작: ${records?.length || 0}곡`
    );
    console.time("⏱️ 전체 처리 시간");

    // 1. 프로필 업데이트 (onConflict 추가)
    if (userProfile) {
      await supabaseAdmin.from("users").upsert(
        {
          id: userId,
          nickname: userProfile.nickname,
          icon_url: userProfile.iconUrl,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
    }

    // 2-1. 곡 마스터(musics) 등록
    const uniqueTitles = [...new Set(records.map((r: any) => r.title))];
    await supabaseAdmin.from("musics").upsert(
      uniqueTitles.map((title) => ({ title })),
      { onConflict: "title" }
    );

    const { data: musics } = await supabaseAdmin
      .from("musics")
      .select("id, title")
      .in("title", uniqueTitles);
    const musicIdMap = new Map(musics?.map((m) => [m.title, m.id]));

    // 2-2. 곡 상세(music_details) Upsert
    const detailsToUpsert = records
      .map((r: any) => {
        const musicId = musicIdMap.get(r.title);
        if (!musicId) return null;
        return {
          music_id: musicId,
          difficulty_type: r.difficulty_type.toLowerCase().trim(), // 공백 제거 및 소문자
          is_dx: Boolean(r.is_dx), // 확실하게 boolean 변환
          internal_level: parseFloat(r.internal_level) || 0,
          difficulty_value: parseInt(r.difficulty_value) || 0,
          level: r.level,
        };
      })
      .filter(Boolean);

    // DB에 Upsert 실행 (이미 제약조건이 있으므로 안전함)
    const { data: upsertedDetails, error: detailErr } = await supabaseAdmin
      .from("music_details")
      .upsert(detailsToUpsert, { onConflict: "music_id,difficulty_type,is_dx" })
      .select("id, music_id, difficulty_type, is_dx");

    if (detailErr) throw detailErr;

    // 2-3. 매핑 및 전적(user_records) 생성
    // 키 생성 규칙을 완전히 동일하게 맞춤
    const detailIdMap = new Map();
    upsertedDetails?.forEach((d) => {
      const key = `${d.music_id}_${d.difficulty_type.toLowerCase()}_${d.is_dx}`;
      detailIdMap.set(key, d.id);
    });

    const userRecordsToUpsert = records
      .map((r: any) => {
        const musicId = musicIdMap.get(r.title);
        // 비교용 키 생성 (위와 동일한 로직)
        const key = `${musicId}_${r.difficulty_type
          .toLowerCase()
          .trim()}_${Boolean(r.is_dx)}`;
        const detailId = detailIdMap.get(key);

        if (!detailId) {
          // 매핑 실패 시 로그 출력 (처음 몇 개만)
          // console.log(`⚠️ 매핑 실패: ${r.title} (Key: ${key})`);
          return null;
        }

        return {
          user_id: userId,
          music_detail_id: detailId,
          achievement: r.achievement,
          fc_type: r.fc_type || null,
          fs_type: r.fs_type || null,
        };
      })
      .filter(Boolean);

    console.log(
      `📊 매핑 결과: 전체 ${records.length}개 중 ${userRecordsToUpsert.length}개 성공`
    );

    // 2-4. 최종 저장
    if (userRecordsToUpsert.length > 0) {
      const { error: recordErr } = await supabaseAdmin
        .from("user_records")
        .upsert(userRecordsToUpsert, { onConflict: "user_id,music_detail_id" });
      if (recordErr) throw recordErr;
    }

    console.timeEnd("⏱️ 전체 처리 시간");
    return NextResponse.json(
      { success: true, count: userRecordsToUpsert.length },
      { headers: corsHeaders }
    );

    return NextResponse.json(
      {
        success: true,
        count: userRecordsToUpsert.length,
      },
      { headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("🔥 서버 에러:", err.message);
    return NextResponse.json(
      { error: err.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
