// maimaiDX Rating Bookmarklet
// 이 코드를 북마크의 URL에 붙여넣으세요

javascript: (async function () {
  // 1. collect 페이지를 새 탭으로 열기
  const collectWindow = window.open("http://localhost:3000/collect", "_blank");

  if (!collectWindow) {
    alert("새 탭을 열 수 없습니다. 팝업 차단을 해제해주세요.");
    return;
  }

  // 2. 수집 시작
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const extractNum = (text) =>
    text ? parseInt(text.replace(/[^0-9]/g, "")) : 0;

  try {
    // 프로필 수집
    collectWindow.postMessage(
      { type: "status", message: "프로필 수집 중..." },
      "*"
    );

    const pRes = await fetch(
      "https://maimaidx-eng.com/maimai-mobile/playerData/"
    );
    const pHtml = await pRes.text();
    const pDoc = new DOMParser().parseFromString(pHtml, "text/html");

    const userProfile = {
      iconUrl: pDoc.querySelector("img.w_112.f_l")?.src || "",
      nickname: pDoc.querySelector(".name_block")?.innerText.trim() || "",
      titleImageUrl: "Silver",
      title:
        pDoc.querySelector(".trophy_inner_block.f_13 span")?.innerText.trim() ||
        "",
      danGradeUrl:
        pDoc.querySelector('img.h_35.f_l[src*="course_rank_"]')?.src || "",
      friendRankUrl: pDoc.querySelector("img.p_l_10.h_35.f_l")?.src || "",
      totalStars: extractNum(pDoc.querySelector(".p_l_10.f_l.f_14")?.innerText),
      playCountTotal: (() => {
        const elements = [...pDoc.querySelectorAll(".m_5.m_b_5.t_r.f_12")];
        const target = elements.find((e) =>
          e.innerText.includes("total play count")
        );
        return target ? extractNum(target.innerText.split("：")[1]) : 0;
      })(),
      playCountVersion: (() => {
        const elements = [...pDoc.querySelectorAll(".m_5.m_b_5.t_r.f_12")];
        const target = elements.find((e) =>
          e.innerText.includes("play count of current version")
        );
        return target ? extractNum(target.innerText.split("：")[1]) : 0;
      })(),
    };

    // 곡 수집
    const genres = [101, 102, 103, 104, 105, 199];
    const diffs = [2, 3, 4];
    let allRecords = [];

    for (let g of genres) {
      for (let d of diffs) {
        collectWindow.postMessage(
          {
            type: "progress",
            count: allRecords.length,
            message: `곡 수집 중... (${allRecords.length}곡)`,
          },
          "*"
        );

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
            const internalLevel = levelStr.includes("+")
              ? baseLevel + 0.6
              : baseLevel;

            if (internalLevel < 12.0) return;

            // FC/AP 아이콘
            let fc_type = null;
            const fcImg = row.querySelector('img[src*="music_icon_"]');
            if (fcImg) {
              const src = fcImg.src;
              if (src.includes("music_icon_back.png")) fc_type = null;
              else if (src.includes("music_icon_fc.png")) fc_type = "fc";
              else if (src.includes("music_icon_fcp.png")) fc_type = "fc+";
              else if (src.includes("music_icon_ap.png")) fc_type = "ap";
              else if (src.includes("music_icon_app.png")) fc_type = "ap+";
            }

            // Sync/FS 아이콘
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
              internal_level: internalLevel,
              difficulty_value: d,
              level: levelStr,
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

    // 수집 완료 - collect 창으로 데이터 전송
    collectWindow.postMessage(
      {
        type: "data",
        userProfile: userProfile,
        records: allRecords,
      },
      "*"
    );
  } catch (err) {
    collectWindow.postMessage(
      {
        type: "error",
        message: err.message,
      },
      "*"
    );
  }
})();
