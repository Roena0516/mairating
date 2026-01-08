import { supabaseAdmin } from "@/lib/supabase";
import { notFound } from "next/navigation";
import { computeBestRating } from "@/lib/rating";

// 난이도별 색상 정의
const DIFFICULTY_COLORS: Record<string, string> = {
  basic: "bg-emerald-500",
  advanced: "bg-orange-400",
  expert: "bg-rose-500",
  master: "bg-purple-600",
  remaster: "bg-violet-800",
  Basic: "bg-emerald-500",
  Advanced: "bg-orange-400",
  Expert: "bg-rose-500",
  Master: "bg-purple-600",
  "Re:Master": "bg-violet-800",
};

// FC 아이콘 매핑
const FC_ICONS: Record<string, string> = {
  fc: "🎯",
  "fc+": "🎯+",
  ap: "💯",
  "ap+": "💯+",
};

// Next.js 15의 새로운 Page Props 타입 정의
interface PageProps {
  params: Promise<{ handle: string }>;
}

export default async function DashboardPage({ params }: PageProps) {
  // 1. Next.js 15 방식: params를 await로 먼저 풀어줍니다.
  const resolvedParams = await params;
  const handle = resolvedParams.handle;

  console.log("🔍 접속 시도 핸들:", handle);

  // 2. DB에서 핸들로 유저 및 전적 조회
  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select(
      `
      id, nickname, handle, icon_url, total_stars, play_count_total,
      user_records (
        achievement,
        fc_type,
        fs_type,
        music_details (
          internal_level,
          difficulty_type,
          is_dx,
          musics (title, version)
        )
      )
    `
    )
    .eq("handle", handle)
    .single();

  // 유저가 없거나 에러가 나면 404 페이지로 보냄
  if (error || !user) {
    console.error("❌ 유저 조회 실패:", error?.message);
    notFound();
  }

  // 3. lib/maimai.ts에 분리해둔 로직으로 레이팅 계산
  const { totalRating, newRating, oldRating, newSongs, oldSongs } =
    computeBestRating(user.user_records || []);

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans">
      {/* 프로필 헤더 */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center gap-8">
          <div className="relative group">
            <img
              src={
                user.icon_url || "https://placehold.co/200x200?text=No+Image"
              }
              alt="Profile"
              className="w-28 h-28 rounded-full border-4 border-slate-50 shadow-md object-cover bg-slate-100"
            />
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-3 py-1 rounded-full font-black shadow-lg">
              ★ {user.total_stars || 0}
            </div>
          </div>

          <div className="flex-1 text-center md:text-left">
            <h1 className="text-4xl font-black text-slate-900 mb-1 tracking-tight">
              {user.nickname}
            </h1>
            <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">
              @{user.handle}
            </p>
          </div>

          <div className="bg-indigo-600 rounded-[2rem] p-1.5 shadow-2xl shadow-indigo-200">
            <div className="bg-white rounded-[1.7rem] px-12 py-6 text-center">
              <p className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em] mb-1">
                Rating
              </p>
              <p className="text-6xl font-black text-indigo-900 tracking-tighter italic">
                {totalRating}
              </p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 mt-12">
        {/* 요약 대시보드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          <div className="bg-white rounded-3xl p-8 border border-slate-200 flex justify-between items-center group hover:border-blue-500 transition-colors shadow-sm">
            <div>
              <p className="text-blue-500 text-xs font-black uppercase tracking-widest mb-2">
                New Best 15
              </p>
              <p className="text-4xl font-black text-slate-800">{newRating}</p>
            </div>
            <div className="text-right">
              <p className="text-slate-300 text-[10px] font-bold uppercase mb-1">
                Average
              </p>
              <p className="text-xl font-black text-slate-400">
                {(newRating / 15).toFixed(1)}
              </p>
            </div>
          </div>
          <div className="bg-white rounded-3xl p-8 border border-slate-200 flex justify-between items-center group hover:border-emerald-500 transition-colors shadow-sm">
            <div>
              <p className="text-emerald-500 text-xs font-black uppercase tracking-widest mb-2">
                Old Best 35
              </p>
              <p className="text-4xl font-black text-slate-800">{oldRating}</p>
            </div>
            <div className="text-right">
              <p className="text-slate-300 text-[10px] font-bold uppercase mb-1">
                Average
              </p>
              <p className="text-xl font-black text-slate-400">
                {(oldRating / 35).toFixed(1)}
              </p>
            </div>
          </div>
        </div>

        {/* 곡 리스트 그리드 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* New Songs */}
          <div>
            <div className="flex items-center gap-3 mb-8">
              <span className="w-1.5 h-7 bg-blue-500 rounded-full" />
              <h2 className="text-2xl font-black text-slate-800 italic uppercase">
                New Best 15
              </h2>
            </div>
            <div className="space-y-3">
              {newSongs.length > 0 ? (
                newSongs.map((song, i) => (
                  <SongCard key={i} index={i + 1} song={song} />
                ))
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <p className="text-sm">아직 신곡 전적이 없습니다.</p>
                  <p className="text-xs mt-2">
                    maimaiDX 사이트에서 북마클릿을 실행해주세요.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Old Songs */}
          <div>
            <div className="flex items-center gap-3 mb-8">
              <span className="w-1.5 h-7 bg-emerald-500 rounded-full" />
              <h2 className="text-2xl font-black text-slate-800 italic uppercase">
                Old Best 35
              </h2>
            </div>
            <div className="space-y-3">
              {oldSongs.length > 0 ? (
                oldSongs.map((song, i) => (
                  <SongCard key={i} index={i + 1} song={song} />
                ))
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <p className="text-sm">아직 구곡 전적이 없습니다.</p>
                  <p className="text-xs mt-2">
                    maimaiDX 사이트에서 북마클릿을 실행해주세요.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// 개별 곡 카드 컴포넌트
function SongCard({ index, song }: { index: number; song: any }) {
  const diffColor = DIFFICULTY_COLORS[song.difficulty] || "bg-slate-400";
  const fcIcon = song.fc_type ? FC_ICONS[song.fc_type] : null;

  // 난이도 표시 텍스트 정규화
  const displayDifficulty = song.difficulty.charAt(0).toUpperCase() + song.difficulty.slice(1);

  return (
    <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:translate-x-1 transition-all">
      <div className="w-8 text-center font-black text-slate-200 italic">
        {index}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-slate-800 truncate text-sm mb-1">
          {song.title}
        </h4>
        <div className="flex items-center gap-2">
          <span
            className={`text-[8px] font-black text-white px-1.5 py-0.5 rounded ${diffColor}`}
          >
            {displayDifficulty === "Remaster" ? "Re:Master" : displayDifficulty}
          </span>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
            {song.is_dx ? "DX" : "STD"} / LV.{song.internal_level.toFixed(1)}
          </span>
          {fcIcon && (
            <span className="text-xs" title={`FC Type: ${song.fc_type}`}>
              {fcIcon}
            </span>
          )}
        </div>
      </div>
      <div className="text-right">
        <p className="text-indigo-600 font-black text-lg leading-none mb-0.5">
          {song.rating}
        </p>
        <p className="text-[10px] font-bold text-slate-300">
          {song.achievement.toFixed(2)}%
        </p>
      </div>
    </div>
  );
}
