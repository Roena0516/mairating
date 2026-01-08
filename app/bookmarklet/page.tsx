"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-client";

export default function BookmarkletPage() {
  const [user, setUser] = useState<any>(null);
  const [handle, setHandle] = useState<string>("");
  const [bookmarkletCode, setBookmarkletCode] = useState("");

  useEffect(() => {
    // 클라이언트에서만 bookmarklet 코드 생성
    if (typeof window !== "undefined") {
      const code = `javascript:(()=>{window.open("${window.location.origin}/collect","maimai-rating","width=600,height=700")})();`;
      setBookmarkletCode(code);
    }

    // 로그인 상태 확인 (선택적)
    checkUser();
  }, []);

  async function checkUser() {
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        setUser(session.user);

        // 핸들 확인 (선택적)
        const { data: userData } = await supabase
          .from("users")
          .select("handle")
          .eq("id", session.user.id)
          .single();

        if (userData?.handle) {
          setHandle(userData.handle);
        }
      }
    } catch (err) {
      console.error("유저 확인 실패:", err);
    }
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(bookmarkletCode);
    alert("북마클릿 코드가 복사되었습니다!");
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-3xl shadow-lg p-8 border border-slate-200">
          <div className="mb-8">
            <h1 className="text-3xl font-black text-slate-900 mb-2">
              북마클릿 설정
            </h1>
            <p className="text-slate-600">
              maimaiDX 사이트에서 전적을 수집하는 북마클릿을 설정하세요.
            </p>
          </div>

          {/* 사용자 정보 (로그인된 경우만 표시) */}
          {user && (
            <div className="bg-indigo-50 rounded-2xl p-6 mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-200 rounded-full flex items-center justify-center overflow-hidden">
                  {user?.user_metadata?.avatar_url ? (
                    <img
                      src={user.user_metadata.avatar_url}
                      alt="Profile"
                      className="w-12 h-12 object-cover"
                    />
                  ) : (
                    <span className="text-indigo-700 font-bold text-xl">
                      {user?.email?.[0].toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  {handle ? (
                    <p className="font-bold text-slate-900">@{handle}</p>
                  ) : (
                    <p className="font-bold text-slate-900">
                      {user.user_metadata?.name || user.email}
                    </p>
                  )}
                  <p className="text-sm text-slate-600">{user?.email}</p>
                </div>
              </div>
            </div>
          )}

          {/* 로그인 안내 (비로그인 상태) */}
          {!user && (
            <div className="bg-yellow-50 rounded-2xl p-6 mb-8 border border-yellow-200">
              <p className="text-yellow-800 text-sm">
                💡 북마클릿을 사용하려면{" "}
                <a href="/home" className="font-bold underline">
                  로그인
                </a>
                이 필요합니다.
              </p>
            </div>
          )}

          {/* 사용 방법 */}
          <div className="space-y-6 mb-8">
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-4">
                📖 사용 방법
              </h2>
              <ol className="space-y-3 text-slate-700">
                <li className="flex gap-3">
                  <span className="font-black text-indigo-600 min-w-[20px]">
                    1.
                  </span>
                  <span>
                    아래 버튼을 클릭하여 북마클릿 코드를 복사합니다.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-black text-indigo-600 min-w-[20px]">
                    2.
                  </span>
                  <span>
                    브라우저의 북마크바에 새 북마크를 추가합니다.
                    <br />
                    <span className="text-sm text-slate-500">
                      Chrome: Ctrl/Cmd+Shift+O → 북마크 관리자 → 우측 상단 ⋮ →
                      새 북마크 추가
                    </span>
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-black text-indigo-600 min-w-[20px]">
                    3.
                  </span>
                  <span>
                    이름은 "maimai Rating"으로 설정하고, URL에 복사한 코드를
                    붙여넣습니다.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-black text-indigo-600 min-w-[20px]">
                    4.
                  </span>
                  <span>
                    <a
                      href="https://maimaidx-eng.com/maimai-mobile/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-700 underline font-bold"
                    >
                      maimaiDX 공식 사이트
                    </a>
                    에 로그인합니다.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-black text-indigo-600 min-w-[20px]">
                    5.
                  </span>
                  <span>
                    북마크바에서 "maimai Rating" 북마클릿을 클릭합니다.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-black text-indigo-600 min-w-[20px]">
                    6.
                  </span>
                  <span>
                    새 창이 열리면서 자동으로 전적이 수집되고 저장됩니다!
                  </span>
                </li>
              </ol>
            </div>
          </div>

          {/* 복사 버튼 */}
          <div className="space-y-4">
            <button
              onClick={copyToClipboard}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <span>📋</span>
              <span>북마클릿 코드 복사하기</span>
            </button>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <p className="text-xs text-slate-600 mb-2 font-bold">
                북마클릿 코드:
              </p>
              <code className="text-xs text-slate-700 break-all block bg-white p-3 rounded border border-slate-200 font-mono">
                {bookmarkletCode || "로딩 중..."}
              </code>
            </div>
          </div>

          {/* 주의사항 */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-2xl p-6">
            <h3 className="font-bold text-blue-900 mb-2">💡 참고사항</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• 12.0 레벨 이상의 곡만 수집됩니다.</li>
              <li>• Expert, Master, Re:Master 난이도만 수집됩니다.</li>
              <li>• 수집에는 약 20~30초 정도 소요됩니다.</li>
              <li>• 팝업 차단이 설정되어 있다면 해제해주세요.</li>
            </ul>
          </div>

          {/* 대시보드 링크 */}
          <div className="mt-8 text-center space-y-3">
            {handle ? (
              <a
                href={`/home/${handle}`}
                className="block w-full bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold py-3 px-6 rounded-xl transition-colors"
              >
                대시보드로 돌아가기
              </a>
            ) : (
              <a
                href="/home"
                className="block w-full bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold py-3 px-6 rounded-xl transition-colors"
              >
                홈으로 돌아가기
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
