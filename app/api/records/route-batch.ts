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

    // 샘플 데이터 로깅 (처음 3개)
    if (records && records.length > 0) {
      console.log("📝 샘플 레코드 (처음 3개):", JSON.stringify(records.slice(0, 3), null, 2));
    }

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
    console.log(`📊 고유 곡 제목: ${allTitles.length}개`);

    // 곡 제목 등록 (청킹)
    let musicInsertSuccess = 0;
    let musicInsertFailed = 0;
    for (let i = 0; i < allTitles.length; i += CHUNK_SIZE) {
      const chunk = allTitles.slice(i, i + CHUNK_SIZE);
      const { data, error: musicError } = await supabaseAdmin.from("musics").upsert(
        chunk.map((t) => ({ title: t })),
        { onConflict: "title" }
      );
      if (musicError) {
        musicInsertFailed += chunk.length;
        console.error(`❌ musics 저장 실패 (${i}-${i + chunk.length}):`, musicError);
      } else {
        musicInsertSuccess += chunk.length;
      }
    }
    console.log(`✅ musics 저장 완료: ${musicInsertSuccess}개 성공, ${musicInsertFailed}개 실패`);

    // ID 매핑을 위해 다시 조회 (청킹)
    const musicMap = new Map<string, number>();
    let totalQueriedCount = 0;
    for (let i = 0; i < allTitles.length; i += CHUNK_SIZE) {
      const chunk = allTitles.slice(i, i + CHUNK_SIZE);
      const { data: musics, error: queryError } = await supabaseAdmin
        .from("musics")
        .select("id, title")
        .in("title", chunk);

      if (queryError) {
        console.error(`❌ musics 조회 실패 (${i}-${i + chunk.length}):`, queryError);
      } else {
        const retrievedCount = musics?.length || 0;
        totalQueriedCount += retrievedCount;
        console.log(`🔍 조회 청크 ${Math.floor(i / CHUNK_SIZE) + 1}: ${chunk.length}개 요청 → ${retrievedCount}개 반환`);
        musics?.forEach((m) => musicMap.set(m.title, m.id));
      }
    }
    console.log(`🗂 musicMap 최종 크기: ${musicMap.size}개 (총 ${totalQueriedCount}개 조회됨, ${allTitles.length}개 요청함)`);

    // musicMap 샘플 출력 (처음 5개)
    const musicMapSample = Array.from(musicMap.entries()).slice(0, 5);
    console.log("🗂 musicMap 샘플:", musicMapSample);

    // 곡 상세(난이도) 등록
    const detailRows = records
      .map((r: any) => ({
        music_id: musicMap.get(r.title),
        difficulty_type: r.difficulty_type,
        is_dx: r.is_dx,
        internal_level: r.level || 0,
      }))
      .filter((d) => d.music_id); // music_id가 없는 경우 제외

    console.log(`📋 detailRows (필터링 후): ${detailRows.length}개 / ${records.length}개`);

    // music_details 청킹 저장
    let detailInsertSuccess = 0;
    let detailInsertFailed = 0;
    for (let i = 0; i < detailRows.length; i += CHUNK_SIZE) {
      const chunk = detailRows.slice(i, i + CHUNK_SIZE);
      const { data, error: detailError } = await supabaseAdmin.from("music_details").upsert(chunk, {
        onConflict: "music_id,difficulty_type,is_dx",
      });
      if (detailError) {
        detailInsertFailed += chunk.length;
        console.error(`❌ music_details 저장 실패 (${i}-${i + chunk.length}):`, detailError);
      } else {
        detailInsertSuccess += chunk.length;
      }
    }
    console.log(`✅ music_details 저장 완료: ${detailInsertSuccess}개 성공, ${detailInsertFailed}개 실패`);

    // 최종 매핑 ID 조회 (청킹)
    const detailMap = new Map<string, number>();
    const musicIds = Array.from(musicMap.values());
    console.log(`🔍 detailMap 조회 시작: ${musicIds.length}개 music_id로 조회`);
    let totalDetailsQueried = 0;
    for (let i = 0; i < musicIds.length; i += CHUNK_SIZE) {
      const chunk = musicIds.slice(i, i + CHUNK_SIZE);
      const { data: details, error: detailQueryError } = await supabaseAdmin
        .from("music_details")
        .select("id, music_id, difficulty_type, is_dx")
        .in("music_id", chunk);

      if (detailQueryError) {
        console.error(`❌ music_details 조회 실패 (${i}-${i + chunk.length}):`, detailQueryError);
      } else {
        const retrievedCount = details?.length || 0;
        totalDetailsQueried += retrievedCount;
        console.log(`🔍 detail 조회 청크 ${Math.floor(i / CHUNK_SIZE) + 1}: ${chunk.length}개 music_id → ${retrievedCount}개 반환`);
        details?.forEach((d) =>
          detailMap.set(`${d.music_id}-${d.difficulty_type}-${d.is_dx}`, d.id)
        );
      }
    }
    console.log(`🔑 detailMap 최종 크기: ${detailMap.size}개 (총 ${totalDetailsQueried}개 조회됨)`);

    // detailMap 샘플 출력 (처음 5개)
    const detailMapSample = Array.from(detailMap.entries()).slice(0, 5);
    console.log("🔑 detailMap 샘플:", detailMapSample);

    // 3. 유저 전적(user_records) 최종 저장
    let musicNotFoundCount = 0;
    let detailNotFoundCount = 0;
    const failedTitles = new Set<string>();
    const failedDetailKeys = new Set<string>();

    const recordRows = records
      .map((r: any) => {
        const mId = musicMap.get(r.title);
        const dId = detailMap.get(`${mId}-${r.difficulty_type}-${r.is_dx}`);

        if (!mId) {
          musicNotFoundCount++;
          if (failedTitles.size < 5) {
            failedTitles.add(r.title);
          }
        }
        if (mId && !dId) {
          detailNotFoundCount++;
          const key = `${mId}-${r.difficulty_type}-${r.is_dx}`;
          if (failedDetailKeys.size < 5) {
            failedDetailKeys.add(key);
          }
        }

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

    console.log(`⚠️ musicMap 조회 실패: ${musicNotFoundCount}개`);
    if (failedTitles.size > 0) {
      console.log(`⚠️ 실패한 곡 제목 샘플:`, Array.from(failedTitles));
    }
    console.log(`⚠️ detailMap 조회 실패: ${detailNotFoundCount}개`);
    if (failedDetailKeys.size > 0) {
      console.log(`⚠️ 실패한 detail 키 샘플:`, Array.from(failedDetailKeys));
    }

    console.log(`💾 최종 저장할 recordRows: ${recordRows.length}개 / ${records.length}개`);

    // Chunk 단위 저장 (안정성)
    let recordInsertSuccess = 0;
    let recordInsertFailed = 0;
    for (let i = 0; i < recordRows.length; i += CHUNK_SIZE) {
      const { error: recordError } = await supabaseAdmin
        .from("user_records")
        .upsert(recordRows.slice(i, i + CHUNK_SIZE), {
          onConflict: "user_id,music_detail_id",
        });
      if (recordError) {
        recordInsertFailed += Math.min(CHUNK_SIZE, recordRows.length - i);
        console.error(`❌ user_records 저장 실패 (${i}-${i + CHUNK_SIZE}):`, recordError);
      } else {
        recordInsertSuccess += Math.min(CHUNK_SIZE, recordRows.length - i);
      }
    }

    console.log(`✅ 유저(${userId}) 전적 업데이트 완료: ${recordInsertSuccess}개 성공, ${recordInsertFailed}개 실패`);
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
