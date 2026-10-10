let songs = [];
let selectedCountry = null;
let selectedTag = null;
let isRestoringState = false;

// 간략 카드 목록에서 곡 상세로 들어갔을 때 돌아갈 곳: { type: "country" | "tag" | "timeline", value? } | null
let compactListReturnTo = null;

// "about"(소개, 기본) / "map"(지도) / "countries"(목록) / "timeline"(연표) / "tags"(태그)
let viewMode = "about";
const songList = document.getElementById("song-list");
const tagSearch = document.getElementById("tag-search");


const countryView = document.getElementById("country-view");
const countryList = document.getElementById("country-list");
const mapView = document.getElementById("map-view");
const timelineView = document.getElementById("timeline-view");
const timelineList = document.getElementById("timeline-list");
const timelineSort = document.getElementById("timeline-sort");
const tagsView = document.getElementById("tags-view");
const tagsList = document.getElementById("tags-list");
const aboutView = document.getElementById("about-view");
const songsView = document.getElementById("songs-view");
const countryTitle = document.getElementById("country-title");
const countrySort =  document.getElementById("country-sort");
const tagSort = document.getElementById("tag-sort");
const backButton = document.getElementById("back-to-countries");
const viewTabs = document.querySelectorAll(".view-tab");
const randomDiceButton = document.getElementById("random-dice-button");

// -------------------------------------
// 목록/지도/연표/태그/소개 뷰 <-> 곡 목록 뷰 전환
// -------------------------------------

// 현재 viewMode에 맞는 탐색 화면을 보여줌
function showBrowseUI() {
  songsView.style.display = "none";
  songsView.classList.remove("songs-view-no-header", "songs-view-detail");

  countryView.style.display = viewMode === "countries" ? "block" : "none";
  mapView.style.display = viewMode === "map" ? "block" : "none";
  timelineView.style.display = viewMode === "timeline" ? "block" : "none";
  tagsView.style.display = viewMode === "tags" ? "block" : "none";
  aboutView.style.display = viewMode === "about" ? "block" : "none";
}

function showSongsUI() {
  countryView.style.display = "none";
  mapView.style.display = "none";
  timelineView.style.display = "none";
  tagsView.style.display = "none";
  aboutView.style.display = "none";
  songsView.style.display = "block";
  songsView.classList.remove("songs-view-no-header", "songs-view-detail");
}

function setActiveViewTab() {
  viewTabs.forEach(tab => {
    const active = tab.dataset.mode === viewMode;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
  });
}

function goToBrowseView(mode) {

  viewMode = mode;
  setActiveViewTab();

  selectedCountry = null;
  selectedTag = null;
  compactListReturnTo = null;

  tagSearch.value = "";

  renderCountries();

  if (mode === "timeline") {
    renderTimeline();
  }

  if (mode === "tags") {
    renderTagsList();
  }

  updateURLState(true);
}

viewTabs.forEach(tab => {
  tab.addEventListener("click", () => {
    goToBrowseView(tab.dataset.mode);
  });
});

// 곡 하나만 상세 카드로 표시 (랜덤 곡, 간략 카드 클릭, 같은 아티스트 곡 클릭 공용)
function showSingleSongDetail(song, options = {}) {
  if (!song) return;

  const { preserveContext = false } = options;

  if (!preserveContext) {
    selectedCountry = null;
    selectedTag = null;
    compactListReturnTo = null;
  }

  showSongsUI();
  songsView.classList.add("songs-view-detail");

  renderSongs([song]);
  window.scrollTo(0, 0);
}

function showRandomSongDetail() {
  const song = getRandomSong(songs);
  if (!song) return;

  selectedCountry = null;
  selectedTag = null;
  compactListReturnTo = null;

  showSongsUI();
  songsView.classList.add("songs-view-no-header");

  renderSongs([song]);
}

randomDiceButton?.addEventListener("click", showRandomSongDetail);

// -------------------------------------
// 국가 코드 → 한국어 국가명
// -------------------------------------

const regionNames = new Intl.DisplayNames(
  ["ko"],
  { type: "region" }
);

function getCountryName(code) {
  if (code === "XX") {
    return "미분류";
  }
  return regionNames.of(code);
}

// 국가 코드에 맞는 국기 아이콘 마크업.
// "XX"(미분류)는 실제 국기가 없으므로 대체 뱃지를 사용
function countryFlagHTML(code, extraClass = "") {

  const classAttr = extraClass ? `${extraClass} ` : "";

  if (code === "XX") {
    return `<span class="${classAttr}flag-unclassified" aria-hidden="true"></span>`;
  }

  return `<span class="${classAttr}fi fi-${code.toLowerCase()}"></span>`;
}

// -------------------------------------
// 현재 상태를 URL에 저장
// -------------------------------------

function updateURLState(addHistoryEntry = false) {

  if (isRestoringState) {
    return;
  }

  const params = new URLSearchParams();

  // 기본 뷰(소개)는 생략
  if (viewMode !== "about") {
    params.set("view", viewMode);
  }

  // 국가
  if (selectedCountry) {
    params.set("country", selectedCountry);
  }

  // 검색어
  const keyword = tagSearch.value.trim();

  if (keyword) {
    params.set("q", keyword);
  }

  const queryString = params.toString();

  const newURL = queryString
    ? `${location.pathname}?${queryString}`
    : location.pathname;

  if (addHistoryEntry) {
    history.pushState(null, "", newURL);
  } else {
    history.replaceState(null, "", newURL);
  }
}

// -------------------------------------
// URL에서 상태 불러오기
// -------------------------------------

function restoreStateFromURL() {

  isRestoringState = true;

  const params = new URLSearchParams(location.search);
  const view = params.get("view");
  const country = params.get("country");
  const keyword = params.get("q");

    const validModes = ["map", "countries", "timeline", "tags", "about"];
  viewMode = validModes.includes(view) ? view : "about";
  setActiveViewTab();

  selectedCountry = null;
  tagSearch.value = "";

  const validCountry =
    country &&
    songs.some(song =>
      song.countries.includes(country)
    );

  if (validCountry) {
    selectCountry(country);
  } else {
    renderCountries();
  }

  // 검색어 복원
  if (keyword) {
    tagSearch.value = keyword;
  }

  const hasFilter = tagSearch.value.trim() !== "";

  if (validCountry || hasFilter) {
    applyFilters();
  } else if (viewMode === "timeline") {
    renderTimeline();
  } else if (viewMode === "tags") {
    renderTagsList();
  }
  isRestoringState = false;
}

// -------------------------------------
// JSON 불러오기
// -------------------------------------

fetch(`sscdbg.json?v=${Date.now()}`)
  .then(response => response.json())
  .then(data => {

    songs = data.map(song => ({
      ...song,

      artist: Array.isArray(song.artist)
        ? song.artist
        : [song.artist],

      songwriters: Array.isArray(song.songwriters)
        ? song.songwriters
        : song.songwriters
          ? [song.songwriters]
          : [],

      language: Array.isArray(song.language)
        ? song.language
        : [song.language],

      countries: Array.isArray(song.countries)
        ? song.countries
        : song.countries
          ? [song.countries]
          : [],

      tags: Array.isArray(song.tags)
        ? song.tags
        : [],

      links: Array.isArray(song.links)
        ? song.links
        : [],

      youtube: Array.isArray(song.youtube)
        ? song.youtube
        : []
    }));


    renderArchiveStats();
    renderDecorativeFlags();
    renderCountries();

    // 지도는 데이터 로드 직후 한 번만 미리 그려 둠 (map.js)
    if (typeof initMap === "function") {
      initMap();
    }

    restoreStateFromURL();
  })

  .catch(error => {
    console.error(
      "JSON을 불러오는 중 오류:",
      error
    );
  });

function renderArchiveStats() {
  const countries = [
    ...new Set(
      songs.flatMap(song => song.countries)
    )
  ].filter(Boolean);

  renderAboutStats(countries.length);
}

function renderAboutStats(countryCount) {
  const badge = document.getElementById("about-stat-badge");
  if (!badge) return;

  badge.textContent =
    `현재 ${songs.length}곡 · ${countryCount}개 국가·지역 수집 중`;
}

function renderDecorativeFlags() {

  const flagStrip =
    document.getElementById("flag-strip");


  if (!flagStrip) {
    return;
  }


  flagStrip.innerHTML = "";

  const flagCodes = [...getCountryCounts().keys()].sort((a, b) => {
    if (a === "XX") return 1;
    if (b === "XX") return -1;
    return getCountryName(a).localeCompare(getCountryName(b), "ko");
  });

  flagCodes.forEach(code => {

    const button = document.createElement("button");
    button.type = "button";
    button.className = "flag-strip-item";
    button.setAttribute("aria-label", getCountryName(code));
    button.title = getCountryName(code);
    button.innerHTML = countryFlagHTML(code);

    button.addEventListener("click", () => {
      selectCountry(code);
    });

    flagStrip.appendChild(button);
  });
}



// -------------------------------------
// 국가 목록 출력
// -------------------------------------

// 국가별 곡 수 (목록·지도 공용)
function getCountryCounts() {

  const countryCounts = new Map();

  songs.forEach(song => {
    song.countries.forEach(code => {

      if (!code) return;

      countryCounts.set(
        code,
        (countryCounts.get(code) || 0) + 1
      );

    });
  });

  return countryCounts;
}

const CONTINENT_ORDER = [
  "아시아", "유럽", "아프리카", "북아메리카", "남아메리카", "오세아니아"
];

function buildCountryListItem(code, count) {

  const button = document.createElement("button");

  button.className = "country-card";

  button.innerHTML = `
    ${countryFlagHTML(code, "country-list-flag")}

    <span class="country-name">
      ${getCountryName(code)}
    </span>

    <span class="country-count">
      ${count}곡
    </span>
  `;

  button.addEventListener("click", () => {
    selectCountry(code);
  });

  return button;
}

function renderCountriesByContinent(countries, countryCounts) {

  countryList.classList.add("grouped");

  const groups = new Map();

  countries.forEach(code => {
    const continent = code === "XX" ? "미분류" : (COUNTRY_CONTINENTS[code] || "기타");
    if (!groups.has(continent)) {
      groups.set(continent, []);
    }
    groups.get(continent).push(code);
  });

  groups.forEach(list => {
    list.sort((a, b) =>
      getCountryName(a).localeCompare(getCountryName(b), "ko")
    );
  });

  const orderedContinents = [
    ...CONTINENT_ORDER.filter(continent => groups.has(continent)),
    ...[...groups.keys()].filter(
      continent => !CONTINENT_ORDER.includes(continent)
    ),
  ];

  orderedContinents.forEach(continent => {

    const section = document.createElement("div");
    section.className = "continent-group";

    const heading = document.createElement("h3");
    heading.className = "continent-heading";
    heading.textContent = continent;
    section.appendChild(heading);

    const grid = document.createElement("div");
    grid.className = "continent-country-list";

    groups.get(continent).forEach(code => {
      grid.appendChild(
        buildCountryListItem(code, countryCounts.get(code))
      );
    });

    section.appendChild(grid);
    countryList.appendChild(section);
  });
}

function renderCountries() {

  selectedCountry = null;

  showBrowseUI();
  countryList.innerHTML = "";
  countryList.classList.remove("grouped");

  const countryCounts = getCountryCounts();

  const countries = [
    ...countryCounts.keys()
  ];

  // 정렬
  const sortMode =
    countrySort?.value || "name";

  if (sortMode === "continent") {
    renderCountriesByContinent(countries, countryCounts);
    return;
  }

  if (sortMode === "count-desc") {

    countries.sort((a, b) =>
      countryCounts.get(b) - countryCounts.get(a) ||
      getCountryName(a).localeCompare(
        getCountryName(b),
        "ko"
      )
    );

  } else if (sortMode === "count-asc") {

    countries.sort((a, b) =>
      countryCounts.get(a) - countryCounts.get(b) ||
      getCountryName(a).localeCompare(
        getCountryName(b),
        "ko"
      )
    );

  } else {

    countries.sort((a, b) =>
      getCountryName(a).localeCompare(
        getCountryName(b),
        "ko"
      )
    );

  }


  countries.forEach(code => {
    countryList.appendChild(
      buildCountryListItem(code, countryCounts.get(code))
    );
  });
}

// -------------------------------------
// 연표
// -------------------------------------

// year 필드는 "1975", "1580?", "1950s", "19c?", "?" 등 형식이 다양함.
// 정렬값과 그룹 라벨을 뽑아냄 (미상은 가장 오래된 곡으로 취급.
// 1960년 이후는 연도별, 그 이전은 연대/세기별로 묶음)
function parseSongYear(raw) {

  if (raw === undefined || raw === null || raw === "") {
    return { sortValue: -Infinity, groupLabel: "연도 미상", groupSortValue: -Infinity };
  }

  const str = String(raw).trim();

  if (str === "?") {
    return { sortValue: -Infinity, groupLabel: "연도 미상", groupSortValue: -Infinity };
  }

  // 세기 표기: "19c?", "18c?", "20c?"
  let match = str.match(/^(\d{1,2})c\??$/i);
  if (match) {
    const century = parseInt(match[1], 10);
    const startYear = (century - 1) * 100;
    return {
      sortValue: startYear + 50,
      groupLabel: `${century}세기`,
      groupSortValue: startYear,
    };
  }

  // 연대 표기: "1950s", "1970s", "1940s?"
  match = str.match(/^(\d{4})s\??$/);
  if (match) {
    const decadeStart = parseInt(match[1], 10);
    return {
      sortValue: decadeStart,
      groupLabel: `${decadeStart}년대`,
      groupSortValue: decadeStart,
    };
  }

  // 정확하거나 대략적인 연도: "1926", "1580?", "2008?"
  match = str.match(/^(\d{3,4})\??$/);
  if (match) {
    const year = parseInt(match[1], 10);

    // 1960년 이후는 연도 하나하나를 그룹으로 세분화
    if (year >= 1960) {
      return {
        sortValue: year,
        groupLabel: `${year}년`,
        groupSortValue: year,
      };
    }

    const decadeStart = Math.floor(year / 10) * 10;
    return {
      sortValue: year,
      groupLabel: `${decadeStart}년대`,
      groupSortValue: decadeStart,
    };
  }

  // 파싱할 수 없는 형식은 안전하게 미상으로 처리
  return { sortValue: -Infinity, groupLabel: "연도 미상", groupSortValue: -Infinity };
}

function groupSongsByTimelinePeriod() {

  const groups = new Map();

  songs.forEach(song => {
    const parsed = parseSongYear(song.year);

    if (!groups.has(parsed.groupLabel)) {
      groups.set(parsed.groupLabel, {
        groupSortValue: parsed.groupSortValue,
        entries: [],
      });
    }

    groups.get(parsed.groupLabel).entries.push({
      song,
      sortValue: parsed.sortValue,
    });
  });

  return [...groups.entries()].sort(
    (a, b) => a[1].groupSortValue - b[1].groupSortValue
  );
}

function renderTimeline() {

  timelineList.innerHTML = "";

  let orderedGroups = groupSongsByTimelinePeriod();

  const direction = timelineSort?.value || "asc";
  if (direction === "desc") {
    orderedGroups = [...orderedGroups].reverse();
  }

  orderedGroups.forEach(([label, group], index) => {

    let entries = [...group.entries].sort((a, b) => a.sortValue - b.sortValue);
    if (direction === "desc") {
      entries = entries.reverse();
    }

    const section = document.createElement("div");
    section.className = "timeline-group";
    section.id = `timeline-group-${index}`;

    if (label === "연도 미상") {
      section.classList.add("timeline-group-unknown");
    }

    const heading = document.createElement("h3");
    heading.className = "timeline-heading";
    heading.textContent = `${label} · ${entries.length}곡`;
    section.appendChild(heading);

    const grid = document.createElement("div");
    grid.className = "song-list-compact";
    section.appendChild(grid);

    timelineList.appendChild(section);

    renderCompactSongGrid(grid, entries.map(entry => entry.song), {
      returnTo: { type: "timeline" },
    });
  });
}

// 연표의 간략 카드에서 곡을 보고 뒤로가기 할 때 사용 (정렬 방향 유지)
function showTimelineList() {
  viewMode = "timeline";
  setActiveViewTab();
  showBrowseUI();
  renderTimeline();
}

timelineSort?.addEventListener("change", renderTimeline);

// -------------------------------------
// 태그 워드클라우드
// -------------------------------------

// 값 하나의 사용 빈도에 따라 워드클라우드 글자 크기/굵기를 계산
// (제곱근 스케일 - 최댓값과 최솟값 차이가 커도 너무 극단적으로 벌어지지 않게)
function tagCloudStyle(count, minCount, maxCount) {
  const MIN_REM = 0.85;
  const MAX_REM = 2.6;

  const t = maxCount === minCount
    ? 0.5
    : (Math.sqrt(count) - Math.sqrt(minCount)) /
      (Math.sqrt(maxCount) - Math.sqrt(minCount));

  return {
    fontSize: `${MIN_REM + t * (MAX_REM - MIN_REM)}rem`,
    fontWeight: 400 + Math.round(t * 400), // 400(가장 작음) ~ 800(가장 큼)
  };
}

// 곡의 배열 필드(tags 등)에서 값별 사용 횟수를 셈
function computeFieldCounts(fieldName) {
  const counts = new Map();
  songs.forEach(song => {
    (song[fieldName] || []).forEach(value => {
      counts.set(value, (counts.get(value) || 0) + 1);
    });
  });
  return counts;
}

function renderWordCloud(container, counts, sortMode, onSelect) {

  container.innerHTML = "";

  if (counts.size === 0) return;

  const countValues = [...counts.values()];
  const minCount = Math.min(...countValues);
  const maxCount = Math.max(...countValues);

  const ordered = [...counts.entries()].sort((a, b) => {
    if (sortMode === "name") {
      return a[0].localeCompare(b[0], "ko");
    }
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0], "ko");
  });

  ordered.forEach(([label, count]) => {

    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "tag-chip";

    const style = tagCloudStyle(count, minCount, maxCount);
    chip.style.fontSize = style.fontSize;
    chip.style.fontWeight = style.fontWeight;

    chip.title = `${label} · ${count}곡`;
    chip.textContent = label;

    chip.addEventListener("click", () => {
      onSelect(label);
    });

    container.appendChild(chip);
  });
}

function renderTagsList() {
  renderWordCloud(
    tagsList,
    computeFieldCounts("tags"),
    tagSort?.value || "count-desc",
    selectTag
  );
}

// -------------------------------------
// 국가 / 태그 선택
// -------------------------------------

function selectCountry(code) {

  selectedCountry = code;
  selectedTag = null;
  compactListReturnTo = null;

  showSongsUI();

  const countrySongs = songs.filter(song => song.countries.includes(code));

  countryTitle.innerHTML = `
    ${countryFlagHTML(code)}
    ${getCountryName(code)}
    <span class="country-title-count">${countrySongs.length}곡</span>
  `;

  tagSearch.value = "";

  renderSongs(countrySongs, { compact: true });
  updateURLState(true);
}

function selectTag(tag) {

  selectedTag = tag;
  selectedCountry = null;
  compactListReturnTo = null;

  showSongsUI();

  const tagSongs = songs.filter(song =>
    (song.tags || []).includes(tag)
  );

  countryTitle.innerHTML = `
    ${tag}
    <span class="country-title-count">${tagSongs.length}곡</span>
  `;

  tagSearch.value = "";

  renderSongs(tagSongs, { compact: true });
  updateURLState(true);
}

// -------------------------------------
// 필터 이벤트
// -------------------------------------

tagSearch.addEventListener(
  "input",
  applyFilters
);

countrySort.addEventListener(
  "change",
  renderCountries
);

tagSort?.addEventListener(
  "change",
  renderTagsList
);

// -------------------------------------
// 돌아가기
// -------------------------------------

backButton.addEventListener("click", () => {
  if (compactListReturnTo) {
    const returnTo = compactListReturnTo;
    compactListReturnTo = null;
    if (returnTo.type === "tag") {
      selectTag(returnTo.value);
    } else if (returnTo.type === "timeline") {
      showTimelineList();
    } else {
      selectCountry(returnTo.value);
    }
  } else {
    goToBrowseView(viewMode);
  }
});

window.addEventListener(
  "popstate",
  restoreStateFromURL
);

// -------------------------------------
// 필터 적용
// -------------------------------------

function normalizeSearchText(value) {
  return String(value)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase();
}

// 곡별 검색 대상 텍스트 (제목, 아티스트, 작곡·작사자, 언어, 국가명, 연도, 태그, 설명)
const searchableTextCache = new WeakMap();

function getSearchableText(song) {
  let text = searchableTextCache.get(song);

  if (text === undefined) {
    text = [
      song.title,
      ...song.artist,
      ...song.songwriters,
      ...song.language,
      ...song.countries.map(getCountryName),
      song.year,
      ...song.tags,
      song.memo,
    ]
      .filter(value => value !== undefined && value !== null && value !== "")
      .map(normalizeSearchText)
      .join(" ");

    searchableTextCache.set(song, text);
  }

  return text;
}

function applyFilters() {

  // 검색은 항상 새 목록으로 이동하는 것이므로 상세 화면용 복귀 상태는 초기화
  compactListReturnTo = null;

  const terms = normalizeSearchText(tagSearch.value)
    .split(/\s+/)
    .filter(Boolean);

  const hasFilter = terms.length > 0;

  // 국가/태그/검색어가 모두 없으면 탐색 화면으로
  if (!selectedCountry && !selectedTag && !hasFilter) {
    showBrowseUI();
    updateURLState();
    return;
  }

  const filteredSongs = songs.filter(song => {

    // 국가를 골랐으면 그 국가 안에서만
    if (
      selectedCountry &&
      !song.countries.includes(selectedCountry)
    ) {
      return false;
    }

    // 태그를 골랐으면 그 태그 안에서만
    if (
      selectedTag &&
      !(song.tags || []).includes(selectedTag)
    ) {
      return false;
    }

    // 띄어쓴 검색어는 모두 만족해야 함 (예: "독일 군가" = 독일 AND 군가)
    if (hasFilter) {
      const text = getSearchableText(song);
      if (!terms.every(term => text.includes(term))) {
        return false;
      }
    }

    return true;
  });

  showSongsUI();

  // 제목
  if (selectedCountry) {
    countryTitle.innerHTML = `
      ${countryFlagHTML(selectedCountry)}
      ${getCountryName(selectedCountry)}
      <span class="country-title-count">${filteredSongs.length}곡</span>
    `;
  } else if (selectedTag) {
    countryTitle.innerHTML = `
      ${selectedTag}
      <span class="country-title-count">${filteredSongs.length}곡</span>
    `;
  } else {
    countryTitle.textContent =
      `검색 결과 (${filteredSongs.length}곡)`;
  }

  renderSongs(filteredSongs, { compact: !!(selectedCountry || selectedTag) });
  updateURLState();
}

// -------------------------------------
// 랜덤 곡
// -------------------------------------

function getRandomSong(songArray) {
  if (!songArray || songArray.length === 0) return null;

  const previousTitle = sessionStorage.getItem("previousRandomSong");

  let candidates = songArray.filter(
    song => song.title !== previousTitle
  );

  if (candidates.length === 0) {
    candidates = songArray;
  }

  const randomIndex = Math.floor(Math.random() * candidates.length);
  const song = candidates[randomIndex];

  sessionStorage.setItem(
    "previousRandomSong",
    song.title
  );

  return song;
}

function songCardMarkup(song) {
  return `
    <div class="song-content">

      <!-- 왼쪽: 앨범 아트 + 기본 정보 -->
      <div class="song-info">

        <div class="song-header">
          <div class="song-artwork placeholder" aria-hidden="true"></div>

          <div class="song-header-text">
            <h2>${song.title}</h2>

            <div class="song-meta">
              <div class="song-meta-line">

                <span>${song.artist.join(", ")}</span>
                <span class="meta-divider">·</span>

                <span>${song.year}</span>
                <span class="meta-divider">·</span>

                <span>${song.language.join(", ")}</span>
                <span class="meta-divider">·</span>

                <span class="song-countries">
                  ${song.countries
                    .map(code => `
                      <span class="song-country">
                        ${countryFlagHTML(code)}
                        ${getCountryName(code)}
                      </span>
                    `)
                    .join("")}
                </span>

              </div>

              ${
                song.songwriters?.length
                  ? `
                    <div class="song-songwriters">
                      ${song.songwriters.join(", ")}
                    </div>
                  `
                  : ""
              }

            </div>
          </div>
        </div>

        <div class="song-tags">
          ${song.tags
            .map(tag =>
              `<span class="tag">${tag}</span>`
            )
            .join("")}
        </div>

      </div>


      <!-- 오른쪽: 설명 + 링크 -->
      <div class="song-details">

        ${
          song.memo
            ? `
              <p class="song-memo">
                ${song.memo}
              </p>
            `
            : ""
        }

        <div class="song-links">

          ${
            song.links?.length
              ? song.links
                  .map(link => `
                    <a
                      class="blog-link"
                      href="${link.url}"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      ${link.title}
                    </a>
                  `)
                  .join("")
              : ""
          }

          ${
            song.youtube?.length
              ? song.youtube
                  .map(video => `
                    <a
                      class="youtube-link"
                      href="${video.url}"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      ${video.title}
                    </a>
                  `)
                  .join("")
              : ""
          }
        </div>
      </div>
    </div>
  `;
}

// -------------------------------------
// 같은 아티스트의 다른 곡
// -------------------------------------

function artistKey(name) {
  return normalizeSearchText(String(name).trim());
}

function getSameArtistSongs(song) {
  const keys = new Set(song.artist.filter(Boolean).map(artistKey));
  if (keys.size === 0) return [];

  return songs.filter(other =>
    other !== song &&
    other.artist.some(name => name && keys.has(artistKey(name)))
  );
}

function renderSameArtistSection(card, song) {
  const related = getSameArtistSongs(song);
  if (related.length === 0) return;

  const section = document.createElement("section");
  section.className = "related-songs";

  const heading = document.createElement("h3");
  heading.className = "related-songs-heading";
  heading.textContent = "같은 아티스트의 다른 곡";
  section.appendChild(heading);

  const grid = document.createElement("div");
  grid.className = "song-list-compact";
  section.appendChild(grid);

  card.appendChild(section);

  renderCompactSongGrid(grid, related, { returnTo: compactListReturnTo });
}

// -------------------------------------
// 곡 목록 출력 (간략 카드 / 상세 카드)
// -------------------------------------

// 간략 카드: 이미지 + 제목 + 가수
function compactSongCardMarkup(song) {
  const performerText = song.artist?.length
    ? song.artist.join(", ")
    : (song.songwriters || []).join(", ");

  return `
    <div class="song-artwork song-artwork-compact placeholder"></div>
    <div class="compact-song-info">
      <div class="compact-song-title">${song.title}</div>
      <div class="compact-song-artist">${performerText}</div>
    </div>
  `;
}

function renderSongs(songArray, options = {}) {

  const { compact = false } = options;

  songList.innerHTML = "";
  songList.classList.toggle("song-list-compact", compact);

  if (songArray.length === 0) {
    songList.innerHTML = `
      <div class="no-results">
        검색 결과가 없습니다.
      </div>
    `;
    return;
  }

  if (compact) {
    const returnTo = selectedTag
      ? { type: "tag", value: selectedTag }
      : { type: "country", value: selectedCountry };
    renderCompactSongGrid(songList, songArray, { returnTo });
    return;
  }

  songArray.forEach(song => {
    const item = document.createElement("div");
    item.innerHTML = songCardMarkup(song);

    songList.appendChild(item);

    if (typeof loadArtworkInto === "function") {
      loadArtworkInto(item.querySelector(".song-artwork"), song);
    }

    if (songArray.length === 1) {
      renderSameArtistSection(item, song);
    }
  });
}

// 간략 카드 그리드를 컨테이너에 렌더링 (국가/태그 화면, 연표, 같은 아티스트 곡 공용)
function renderCompactSongGrid(container, songArray, { returnTo } = {}) {

  container.innerHTML = "";

  if (songArray.length === 0) {
    container.innerHTML = `
      <div class="no-results">
        검색 결과가 없습니다.
      </div>
    `;
    return;
  }

  songArray.forEach(song => {
    const item = document.createElement("div");
    item.className = "song-card-compact";
    item.innerHTML = compactSongCardMarkup(song);

    item.addEventListener("click", () => {
      compactListReturnTo = returnTo || null;
      showSingleSongDetail(song, { preserveContext: true });
    });

    container.appendChild(item);

    if (typeof loadArtworkInto === "function") {
      loadArtworkInto(item.querySelector(".song-artwork"), song);
    }
  });
}