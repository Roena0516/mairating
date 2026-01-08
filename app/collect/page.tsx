"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-client";

type CollectionStatus =
  | "checking"
  | "unauthorized"
  | "waiting"
  | "collecting"
  | "uploading"
  | "success"
  | "error";

export default function CollectPage() {
  const [status, setStatus] = useState<CollectionStatus>("checking");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [user, setUser] = useState<any>(null);
  const [collectedCount, setCollectedCount] = useState(0);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      // 세션 확인
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setStatus("unauthorized");
        return;
      }

      setUser(session.user);
      setStatus("waiting");
      setProgress("북마클릿에서 데이터 수집 대기 중...");

      // postMessage 리스너 등록
      window.addEventListener("message", handleMessage);

      return () => {
        window.removeEventListener("message", handleMessage);
      };
    } catch (err: any) {
      setStatus("error");
      setError(err.message);
      console.error(err);
    }
  }

  async function handleMessage(event: MessageEvent) {
    // 보안: origin 확인 (localhost 또는 maimaidx-eng.com)
    const allowedOrigins = [
      "http://localhost:3000",
      "https://localhost:3000",
      "https://maimaidx-eng.com",
    ];

    if (!allowedOrigins.includes(event.origin)) {
      console.warn("Unknown origin:", event.origin);
      return;
    }

    const { type, message, count, userProfile, records } = event.data;

    switch (type) {
      case "status":
        setProgress(message);
        break;

      case "progress":
        setStatus("collecting");
        setProgress(message);
        setCollectedCount(count);
        break;

      case "data":
        // 데이터 수집 완료
        setCollectedCount(records.length);
        await uploadData(userProfile, records);
        break;

      case "error":
        setStatus("error");
        setError(message);
        break;
    }
  }

  async function uploadData(userProfile: any, records: any[]) {
    try {
      setStatus("uploading");
      setProgress("서버에 저장 중...");

      const response = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          records: records,
          userProfile: userProfile,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "서버 오류");
      }

      const data = await response.json();
      setCollectedCount(data.count);
      setStatus("success");
    } catch (err: any) {
      setStatus("error");
      setError(err.message);
      console.error(err);
    }
  }

  async function handleLogin() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/collect`,
      },
    });
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-lg p-8 border border-slate-200">
        <div className="text-center">
          <h1 className="text-2xl font-black text-slate-900 mb-6">
            maimai Rating
          </h1>

          {/* 로딩 - 세션 확인 중 */}
          {status === "checking" && (
            <div className="space-y-4">
              <div className="animate-spin w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full mx-auto"></div>
              <p className="text-slate-600">세션 확인 중...</p>
            </div>
          )}

          {/* 로그인 필요 */}
          {status === "unauthorized" && (
            <div className="space-y-6">
              <div className="text-6xl">🔒</div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">
                  로그인이 필요합니다
                </h2>
                <p className="text-slate-600 text-sm mb-6">
                  데이터를 저장하려면 먼저 로그인해주세요.
                </p>
              </div>
              <button
                onClick={handleLogin}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl transition-colors"
              >
                Google로 로그인
              </button>
            </div>
          )}

          {/* 대기 중 */}
          {status === "waiting" && (
            <div className="space-y-4">
              <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-400 rounded-full mx-auto animate-spin"></div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">
                  대기 중
                </h2>
                <p className="text-slate-600 text-sm">{progress}</p>
                <p className="text-xs text-slate-400 mt-4">
                  💡 maimaiDX 탭에서 북마클릿을 실행했는지 확인해주세요.
                </p>
              </div>
            </div>
          )}

          {/* 수집 중 */}
          {status === "collecting" && (
            <div className="space-y-4">
              <div className="animate-spin w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto"></div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">
                  데이터 수집 중
                </h2>
                <p className="text-slate-600 text-sm">{progress}</p>
                {collectedCount > 0 && (
                  <p className="text-blue-600 font-bold mt-2">
                    {collectedCount}곡 수집됨
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 업로드 중 */}
          {status === "uploading" && (
            <div className="space-y-4">
              <div className="animate-pulse w-12 h-12 bg-indigo-200 rounded-full mx-auto flex items-center justify-center">
                <span className="text-2xl">📤</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">
                  저장 중
                </h2>
                <p className="text-slate-600 text-sm">{progress}</p>
              </div>
            </div>
          )}

          {/* 성공 */}
          {status === "success" && (
            <div className="space-y-6">
              <div className="text-6xl">✅</div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">
                  완료!
                </h2>
                <p className="text-slate-600 text-sm mb-4">
                  {collectedCount}곡의 전적이 저장되었습니다.
                </p>
              </div>
              <button
                onClick={() => window.close()}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl transition-colors"
              >
                닫기
              </button>
            </div>
          )}

          {/* 에러 */}
          {status === "error" && (
            <div className="space-y-6">
              <div className="text-6xl">❌</div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">
                  오류 발생
                </h2>
                <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-200">
                  {error}
                </p>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-xl transition-colors"
              >
                다시 시도
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
