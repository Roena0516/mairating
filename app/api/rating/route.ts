import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// 랭크계수
function getMultiplier(achievement: number) {
  if (achievement >= 100.5) return 22.4; // SSS+
  if (achievement >= 100.0) return 21.6; // SSS
  if (achievement >= 99.5) return 21.1; // SS+
  if (achievement >= 99.0) return 20.8; // SS
  if (achievement >= 98.0) return 20.3; // S+
  if (achievement >= 97.0) return 20.0; // S
  if (achievement >= 94.0) return 16.8; // AAA
  if (achievement >= 90.0) return 15.2; // AA
  if (achievement >= 80.0) return 13.6; // A
  return 0;
}

// 개별 곡 레이팅 계산
function calculateSingleRating(internalLevel: number, achievement: number) {
  const multiplier = getMultiplier(achievement);
  // 보면상수 * 랭크계수 * (달성률 / 100) -- 소수점 버림
  return Math.floor(
    internalLevel * multiplier * (Math.min(achievement, 100.5) / 100)
  );
}

export async function GET(request: Request) {
  try {
    const userId = "00000000-0000-0000-0000-000000000000"; // 테스트용 UUID

    // 모든 기록 조회 (musics 테이블의 version 컬럼 추가 호출)
    const { data: records, error } = await supabaseAdmin
      .from("user_records")
      .select(
        `
        achievement,
        music_details (
          id,
          internal_level,
          difficulty_type,
          is_dx,
          musics (
            title,
            version
          )
        )
      `
      )
      .eq("user_id", userId);

    if (error) throw error;

    // 각 곡 레이팅 계산 및 가공
    const ratedRecords = records.map((r: any) => {
      const detail = r.music_details;
      const rating = calculateSingleRating(
        detail.internal_level,
        r.achievement
      );

      return {
        title: detail.musics.title,
        version: detail.musics.version, // 버전 정보 포함
        difficulty: detail.difficulty_type,
        is_dx: detail.is_dx,
        achievement: r.achievement,
        internal_level: detail.internal_level,
        rating: rating,
      };
    });

    // 버전을 구분하여 신곡 및 구곡 분리
    // 신곡 기준 : CiRCLE, PRiSM PLUS (데이터베이스에는 version에 저장되며, 구곡은 Old 및 NULL, 신곡은 New)

    // 신곡(New) 필터링 및 상위 15곡 추출
    const newSongs = ratedRecords
      .filter((r) => r.version === "New")
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 15);

    // 구곡(Old/NULL) 필터링 및 상위 35곡 추출
    const oldSongs = ratedRecords
      .filter((r) => r.version === "Old" || !r.version)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 35);

    // 합계 및 총 레이팅
    const newRating = newSongs.reduce((sum, r) => sum + r.rating, 0);
    const oldRating = oldSongs.reduce((sum, r) => sum + r.rating, 0);
    const totalRating = newRating + oldRating;

    return NextResponse.json({
      totalRating,
      newRating,
      oldRating,
      newSongs, // 신곡 리스트 (15개)
      oldSongs, // 구곡 리스트 (35개)
      allCount: ratedRecords.length,
    });
  } catch (error: any) {
    console.error("조회 에러:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
