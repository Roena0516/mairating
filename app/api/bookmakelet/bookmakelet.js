javascript: (async function () {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const statusDiv = document.createElement("div");
  statusDiv.style =
    "position:fixed; top:20px; left:20px; background:rgba(0,0,0,0.95); color:white; padding:20px; z-index:1000000; font-family:sans-serif; border-radius:10px; border: 2px solid #00ff00; font-size:13px; line-height:1.6; box-shadow: 0 0 15px rgba(0,255,0,0.4);";
  document.body.appendChild(statusDiv);

  try {
    statusDiv.innerHTML = "👤 <b>Profile: Parsing English Site Data...</b>";
    const pRes = await fetch(
      "https://maimaidx-eng.com/maimai-mobile/playerData/"
    );
    const pHtml = await pRes.text();
    const pDoc = new DOMParser().parseFromString(pHtml, "text/html");

    // 숫자만 추출하는 헬퍼 함수
    const extractNum = (text) =>
      text ? parseInt(text.replace(/[^0-9]/g, "")) : 0;

    const userProfile = {
      iconUrl: pDoc.querySelector("img.w_112.f_l")?.src || "",
      nickname: pDoc.querySelector(".name_block")?.innerText.trim() || "",

      // 칭호 설정: 배경은 고정값 "Silver", 내용은 특정 클래스 span
      titleImageUrl: "Silver",
      title:
        pDoc.querySelector(".trophy_inner_block.f_13 span")?.innerText.trim() ||
        "",

      danGradeUrl:
        pDoc.querySelector('img.h_35.f_l[src*="course_rank_"]')?.src || "",
      friendRankUrl: pDoc.querySelector("img.p_l_10.h_35.f_l")?.src || "",

      // 성급: p_l_10 f_l f_14 내부
      totalStars: extractNum(pDoc.querySelector(".p_l_10.f_l.f_14")?.innerText),

      // 플레이 카운트: 영문판 특유의 "："(전각 콜론)과 텍스트 패턴 대응
      playCountTotal: (function () {
        const elements = [...pDoc.querySelectorAll(".m_5.m_b_5.t_r.f_12")];
        const target = elements.find((e) =>
          e.innerText.includes("total play count")
        );
        return target ? extractNum(target.innerText.split("：")[1]) : 0;
      })(),
      playCountVersion: (function () {
        const elements = [...pDoc.querySelectorAll(".m_5.m_b_5.t_r.f_12")];
        const target = elements.find((e) =>
          e.innerText.includes("play count of current version")
        );
        return target ? extractNum(target.innerText.split("：")[1]) : 0;
      })(),
    };

    console.log("📊 [Captured Data]", userProfile);

    // --- 곡 수집 로직 ---
    const genres = [101, 102, 103, 104, 105, 199];
    const diffs = [2, 3, 4]; // Expert, Master, Re:Master
    let allRecords = [];

    for (let g of genres) {
      for (let d of diffs) {
        statusDiv.innerHTML = `🎵 <b>Music: Collecting...</b><br>Found: ${allRecords.length} songs`;
        const res = await fetch(
          `https://maimaidx-eng.com/maimai-mobile/record/musicGenre/search/?genre=${g}&diff=${d}`
        );
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, "text/html");

        doc.querySelectorAll(".pointer").forEach((row) => {
          const title = row
            .querySelector(".music_name_block")
            ?.innerText.trim();
          const scoreStr = row
            .querySelector(".music_score_block")
            ?.innerText.trim();
          const levelStr = row
            .querySelector(".music_lv_block")
            ?.innerText.trim();

          if (title && scoreStr) {
            const achievement = parseFloat(scoreStr.replace("%", ""));
            let baseLevel = parseFloat(levelStr.replace("+", ""));

            // 12.0 미만 곡 필터링
            const internalLevel = levelStr.includes("+") ? baseLevel + 0.6 : baseLevel;
            if (internalLevel < 12.0) return;

            // FC/AP 아이콘 파싱
            let fc_type = null;
            const fcImg = row.querySelector('img[src*="music_icon_"]');
            if (fcImg) {
              const src = fcImg.src;
              if (src.includes("music_icon_back.png")) fc_type = null; // 아무것도 없음
              else if (src.includes("music_icon_fc.png")) fc_type = "fc";
              else if (src.includes("music_icon_fcp.png")) fc_type = "fc+";
              else if (src.includes("music_icon_ap.png")) fc_type = "ap";
              else if (src.includes("music_icon_app.png")) fc_type = "ap+";
            }

            // Sync/FS 아이콘 파싱
            let fs_type = null;
            const fsImgs = row.querySelectorAll("img.h_30");
            fsImgs.forEach((img) => {
              const src = img.src;
              if (src.includes("music_icon_sync.png")) fs_type = "sync";
              else if (src.includes("music_icon_fs.png")) fs_type = "fs";
              else if (src.includes("music_icon_fsp.png")) fs_type = "fs+";
              else if (src.includes("music_icon_fsd.png")) fs_type = "fsd";
              else if (src.includes("music_icon_fsdp.png")) fs_type = "fsd+";
            });

            allRecords.push({
              title,
              achievement,
              level: internalLevel,
              difficulty_type: { 2: "expert", 3: "master", 4: "remaster" }[d],
              is_dx: !!row.querySelector('img[src*="music_kind_icon_dx.png"]'),
              fc_type,
              fs_type,
            });
          }
        });
        await sleep(100);
      }
    }

    // 서버 전송
    statusDiv.innerHTML = "🚀 <b>Uploading...</b>";
    const response = await fetch("http://localhost:3000/api/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ records: allRecords, userProfile: userProfile }),
    });

    if (response.ok) {
      statusDiv.innerHTML = `✅ <b>Success! ${allRecords.length} songs saved.</b>`;
    } else {
      const errorData = await response.json();
      throw new Error(errorData.error || "Server response failed");
    }
    setTimeout(() => statusDiv.remove(), 2000);
  } catch (err) {
    statusDiv.style.border = "2px solid red";
    statusDiv.innerHTML = `❌ <b>Error:</b> ${err.message}`;
    console.error(err);
  }
})();
