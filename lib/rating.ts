// 랭크 계수 (작성하신 로직 반영)
export function getMultiplier(achievement: number): number {
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
export function calculateSingleRating(
  internalLevel: number,
  achievement: number
): number {
  const multiplier = getMultiplier(achievement);
  return Math.floor(
    internalLevel * multiplier * (Math.min(achievement, 100.5) / 100)
  );
}

// 유저의 모든 기록을 받아 신곡/구곡 베스트를 계산하는 핵심 함수
export function computeBestRating(userRecords: any[]) {
  const ratedRecords = userRecords.map((r: any) => {
    const detail = r.music_details;
    const rating = calculateSingleRating(detail.internal_level, r.achievement);

    return {
      title: detail.musics.title,
      version: detail.musics.version,
      difficulty: detail.difficulty_type,
      is_dx: detail.is_dx,
      achievement: r.achievement,
      internal_level: detail.internal_level,
      rating: rating,
    };
  });

  // 신곡(New) 상위 15곡
  const newSongs = ratedRecords
    .filter((r) => r.version === "New")
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 15);

  // 구곡(Old/NULL) 상위 35곡
  const oldSongs = ratedRecords
    .filter((r) => r.version === "Old" || !r.version)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 35);

  const newRating = newSongs.reduce((sum, r) => sum + r.rating, 0);
  const oldRating = oldSongs.reduce((sum, r) => sum + r.rating, 0);
  const totalRating = newRating + oldRating;

  return {
    totalRating,
    newRating,
    oldRating,
    newSongs,
    oldSongs,
    allCount: ratedRecords.length,
  };
}
