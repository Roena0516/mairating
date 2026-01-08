"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [handle, setHandle] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
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

        // 유저의 핸들 확인
        const { data: userData } = await supabase
          .from("users")
          .select("handle")
          .eq("id", session.user.id)
          .single();

        if (userData?.handle) {
          // 이미 핸들이 있으면 대시보드로 리다이렉트
          router.push(`/home/${userData.handle}`);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/home`,
      },
    });

    if (error) {
      setError("로그인 중 오류가 발생했습니다.");
    }
  }

  async function handleSetHandle() {
    if (!handle.trim()) {
      setError("핸들을 입력해주세요.");
      return;
    }

    // 핸들 유효성 검사 (영문, 숫자, 언더스코어만 허용)
    if (!/^[a-zA-Z0-9_]+$/.test(handle)) {
      setError("핸들은 영문, 숫자, 언더스코어(_)만 사용할 수 있습니다.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/user/set-handle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle }),
      });

      const data = await response.json();

      if (response.ok) {
        router.push(`/home/${handle}`);
      } else {
        setError(data.error || "핸들 설정 중 오류가 발생했습니다.");
      }
    } catch (err) {
      setError("서버 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">로딩 중...</div>
      </div>
    );
  }

  // 로그인되지 않은 경우
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-3xl shadow-lg p-8 border border-slate-200">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-black text-slate-900 mb-2">
                maimai Rating
              </h1>
              <p className="text-slate-600">
                maimaiDX 사설 레이팅 분석 서비스
              </p>
            </div>

            <div className="space-y-4">
              <button
                onClick={handleLogin}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-3"
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Google로 로그인
              </button>

              <div className="text-center text-sm text-slate-500">
                로그인하여 나만의 레이팅을 확인하세요
              </div>
            </div>
          </div>

          <div className="mt-8 text-center text-sm text-slate-600">
            <p className="mb-2">사용 방법:</p>
            <ol className="text-left space-y-1">
              <li>1. Google 계정으로 로그인</li>
              <li>2. 고유한 핸들(아이디) 설정</li>
              <li>3. maimaiDX 사이트에서 북마클릿 실행</li>
              <li>4. 레이팅 확인!</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  // 로그인은 했지만 핸들이 없는 경우
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-3xl shadow-lg p-8 border border-slate-200">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
              {user.user_metadata?.avatar_url ? (
                <img
                  src={user.user_metadata.avatar_url}
                  alt="Profile"
                  className="w-16 h-16 rounded-full"
                />
              ) : (
                <svg
                  className="w-8 h-8 text-indigo-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              )}
            </div>
            <h1 className="text-3xl font-black text-slate-900 mb-2">
              환영합니다!
            </h1>
            <p className="text-slate-600">
              {user.user_metadata?.email || user.email}
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                핸들 설정
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                  @
                </span>
                <input
                  type="text"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value.toLowerCase())}
                  placeholder="your_handle"
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  disabled={saving}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                영문, 숫자, 언더스코어(_)만 사용 가능합니다.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleSetHandle}
              disabled={saving || !handle.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              {saving ? "저장 중..." : "시작하기"}
            </button>
          </div>
        </div>

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-2xl p-6">
          <h3 className="font-bold text-blue-900 mb-2">💡 핸들이란?</h3>
          <p className="text-sm text-blue-800">
            핸들은 나만의 고유 아이디입니다. 설정한 핸들로 프로필 URL이
            생성됩니다. (예: /home/your_handle)
          </p>
        </div>
      </div>
    </div>
  );
}
