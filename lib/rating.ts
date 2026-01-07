// 랭크 계수 산출
export function getMultiplier(achievement: number): number {
  if (achievement >= 100.5) return 22.4;
  if (achievement >= 100.0) return 21.6;
  if (achievement >= 99.5) return 21.1;
  if (achievement >= 99.0) return 20.8;
  if (achievement >= 98.0) return 20.3;
  if (achievement >= 97.0) return 20.0;
  if (achievement >= 94.0) return 16.8;
  if (achievement >= 90.0) return 15.2;
  if (achievement >= 80.0) return 13.6;
  return 0;
}

// FC 계수 산출
export function getFCMultiplier(fc_type: string | null): number {
  if (!fc_type) return 1.0; // None
  if (fc_type === "fc") return 1.0125; // FC
  if (fc_type === "fc+") return 1.025; // FC+
  if (fc_type === "ap") return 1.0375; // AP
  if (fc_type === "ap+") return 1.05; // AP+
  return 1.0;
}

// 단일 곡 레이팅 계산
export function calculateSingleRating(
  internalLevel: number,
  achievement: number,
  fc_type: string | null = null
): number {
  const multiplier = getMultiplier(achievement);
  const fcMultiplier = getFCMultiplier(fc_type);
  return Math.floor(
    internalLevel * multiplier * (Math.min(achievement, 100.5) / 100) * fcMultiplier
  );
}

// 전적 데이터를 받아 Best 50(신곡 15 + 구곡 35) 계산
export function computeBestRating(userRecords: any[]) {
  const ratedRecords = userRecords.map((r: any) => {
    const detail = r.music_details;
    const rating = calculateSingleRating(
      detail.internal_level,
      r.achievement,
      r.fc_type
    );

    return {
      title: detail.musics.title,
      version: detail.musics.version,
      difficulty: detail.difficulty_type,
      is_dx: detail.is_dx,
      achievement: r.achievement,
      internal_level: detail.internal_level,
      rating: rating,
      fc_type: r.fc_type,
      fs_type: r.fs_type,
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
