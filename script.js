let songs = [];
let selectedCountry = null;
let selectedTag = null;
let selectedArtist = null; // artistKey() 값
let isRestoringState = false;

// 아티스트 색인 (artistKey -> { key, name, songs }) 과 직접 입력한 아티스트 설명 (artists.json)
let artistIndex = new Map();
let artistProfiles = new Map();
let aliasToArtist = new Map(); // 정규화한 이름 -> 아티스트 색인 key (별칭·작곡가명 포함)

// 간략 카드 목록에서 곡 상세로 들어갔을 때 돌아갈 곳: { type: "country" | "tag" | "artist" | "list", value?, scrollY? } | null
let compactListReturnTo = null;

// "home"(홈, 기본: 사이트 제목을 누르면 나옴) / "list"(목록) / "map"(지도) / "tags"(태그) / "artists"(사람)
let viewMode = "home";
const songList = document.getElementById("song-list");
const tagSearch = document.getElementById("tag-search");


const listView = document.getElementById("list-view");
const listSongs = document.getElementById("list-songs");
const listSort = document.getElementById("list-sort");
const listGroup = document.getElementById("list-group");
const mapView = document.getElementById("map-view");
const tagsView = document.getElementById("tags-view");
const tagsList = document.getElementById("tags-list");
const artistsView = document.getElementById("artists-view");
const artistsList = document.getElementById("artists-list");
const artistSort = document.getElementById("artist-sort");
const artistFilter = document.getElementById("artist-filter");
const artistCount = document.getElementById("artist-count");
const artistInfo = document.getElementById("artist-info");
const homeView = document.getElementById("home-view");
const siteHomeLink = document.getElementById("site-home-link");
const songsView = document.getElementById("songs-view");
const countryTitle = document.getElementById("country-title");
const tagSort = document.getElementById("tag-sort");
const backButton = document.getElementById("back-to-countries");
const viewTabs = document.querySelectorAll(".view-tab");
const randomDiceButton = document.getElementById("random-dice-button");

// -------------------------------------
// 목록/지도/태그/사람/소개 뷰 <-> 곡 목록 뷰 전환
// -------------------------------------

// 현재 viewMode에 맞는 탐색 화면을 보여줌
function showBrowseUI() {
  songsView.style.display = "none";
  songsView.classList.remove("songs-view-no-header", "songs-view-detail");

  listView.style.display = viewMode === "list" ? "block" : "none";
  mapView.style.display = viewMode === "map" ? "block" : "none";
  tagsView.style.display = viewMode === "tags" ? "block" : "none";
  artistsView.style.display = viewMode === "artists" ? "block" : "none";
  homeView.style.display = viewMode === "home" ? "block" : "none";
  artistInfo.style.display = "none";
}

function showSongsUI() {
  listView.style.display = "none";
  mapView.style.display = "none";
  tagsView.style.display = "none";
  artistsView.style.display = "none";
  homeView.style.display = "none";
  artistInfo.style.display = "none";
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
  selectedArtist = null;
  compactListReturnTo = null;

  tagSearch.value = "";

  renderBrowseView();
  updateURLState(true);
}

// 현재 viewMode의 탐색 화면을 그려서 보여줌
function renderBrowseView() {

  selectedCountry = null;

  showBrowseUI();

  if (viewMode === "list") {
    renderSongListView();
  } else if (viewMode === "tags") {
    renderTagsList();
  } else if (viewMode === "artists") {
    renderArtistsList();
  }
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
    selectedArtist = null;
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
  selectedArtist = null;
  compactListReturnTo = null;

  showSongsUI();
  songsView.classList.add("songs-view-no-header");

  renderSongs([song]);
}

randomDiceButton?.addEventListener("click", showRandomSongDetail);

// 사이트 제목을 누르면 홈으로 (새 탭으로 열기 같은 보조키 클릭은 브라우저 기본 동작 유지)
siteHomeLink?.addEventListener("click", event => {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
    return;
  }
  event.preventDefault();
  goToBrowseView("home");
});

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

  // 기본 뷰(홈)는 생략
  if (viewMode !== "home") {
    params.set("view", viewMode);
  }

  if (selectedCountry) {
    params.set("country", selectedCountry);
  }

  if (selectedTag) {
    params.set("tag", selectedTag);
  }

  if (selectedArtist && artistIndex.has(selectedArtist)) {
    params.set("artist", artistIndex.get(selectedArtist).name);
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
  const tag = params.get("tag");
  const artist = params.get("artist");
  const keyword = params.get("q");

  const validModes = ["list", "map", "tags", "artists", "home"];
  // 예전 주소: ?view=countries, ?view=timeline은 목록으로, ?view=about은 홈으로
  viewMode = validModes.includes(view)
    ? view
    : (view === "countries" || view === "timeline" ? "list" : "home");
  setActiveViewTab();

  selectedCountry = null;
  selectedTag = null;
  selectedArtist = null;
  compactListReturnTo = null;
  tagSearch.value = "";

  const artistId = artist ? resolveArtist(artist) : null;
  const validArtist = !!artistId;
  const validTag = !!tag && songs.some(song => song.tags.includes(tag));
  const validCountry =
    !!country && songs.some(song => song.countries.includes(country));

  if (validArtist) {
    selectArtist(artistId);
  } else if (validTag) {
    selectTag(tag);
  } else if (validCountry) {
    selectCountry(country);
  } else {
    renderBrowseView();
  }

  if (keyword) {
    tagSearch.value = keyword;
  }

  const hasFilter = tagSearch.value.trim() !== "";

  if (validArtist || validTag || validCountry || hasFilter) {
    applyFilters();
  }

  isRestoringState = false;
}

// -------------------------------------
// JSON 불러오기
// -------------------------------------

// 값이 하나이든 배열이든 빈 값을 걸러낸 배열로 맞춤
function toCleanArray(value) {
  return (Array.isArray(value) ? value : [value]).filter(
    item => item !== undefined && item !== null && String(item).trim() !== ""
  );
}

// 아티스트 설명(artists.json)은 선택 사항이라, 없거나 잘못돼도 사이트는 정상 동작
function loadArtistProfiles() {
  return fetch(`artists.json?v=${Date.now()}`)
    .then(response => (response.ok ? response.json() : {}))
    .catch(() => ({}));
}

Promise.all([
  fetch(`sscdbg.json?v=${Date.now()}`).then(response => response.json()),
  loadArtistProfiles(),
])
  .then(([data, profiles]) => {

    songs = data.map(song => ({
      ...song,

      artist: toCleanArray(song.artist),
      songwriters: toCleanArray(song.songwriters),
      language: toCleanArray(song.language),
      countries: toCleanArray(song.countries),

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


    buildArtistIndex(profiles);

    renderArchiveStats();
    renderDecorativeFlags();

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

  renderHomeStats(countries.length);
}

function renderHomeStats(countryCount) {
  const badge = document.getElementById("home-stat-badge");
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
// 국가별 곡 수
// -------------------------------------

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

// -------------------------------------
// 창작년도 해석
// -------------------------------------

// year 필드는 "1975", "1580?", "1950s", "19c?", "1c?", "-2c?"(기원전 2세기), "-500"(기원전 500년), "?" 등
// 형식이 다양함. 해석할 수 없거나 비어 있으면 null(연도 미상), 아니면
//   sortValue: 정렬에 쓸 연도 (세기는 그 세기의 중간: "19c" -> 1850, "1c" -> 50, "-2c" -> -150)
//   groupLabel / groupSortValue: 목록에서 묶는 이름과 순서
//     1960년 이후는 연도별("1985년"), 그 이전은 연대별("1950년대")·세기별("19세기")로 묶음
function parseSongYear(raw) {

  if (raw === undefined || raw === null) return null;

  const str = String(raw).trim();

  // 세기 표기: "19c?", "18c?", "1c?", "-2c?"
  let match = str.match(/^(-?)(\d{1,3})c\??$/i);
  if (match) {
    const century = parseInt(match[2], 10);
    if (century === 0) return null;

    if (match[1]) {
      return {
        sortValue: -century * 100 + 50,
        groupLabel: `기원전 ${century}세기`,
        groupSortValue: -century * 100,
      };
    }

    return {
      sortValue: (century - 1) * 100 + 50,
      groupLabel: `${century}세기`,
      groupSortValue: (century - 1) * 100,
    };
  }

  // 연도·연대 표기: "1926", "1580?", "-500", "1950s", "1940s?"
  match = str.match(/^(-?)(\d{1,4})(s?)\??$/);
  if (!match) return null;

  const isBC = !!match[1];
  const value = parseInt(match[2], 10);

  if (isBC) {
    const decadeStart = Math.floor(value / 10) * 10;
    return {
      sortValue: -value,
      groupLabel: `기원전 ${decadeStart}년대`,
      groupSortValue: -decadeStart - 9,
    };
  }

  // 1960년 이후의 정확한 연도는 연도 하나하나를 그룹으로 세분화
  if (!match[3] && value >= 1960) {
    return { sortValue: value, groupLabel: `${value}년`, groupSortValue: value };
  }

  const decadeStart = Math.floor(value / 10) * 10;
  return {
    sortValue: value,
    groupLabel: `${decadeStart}년대`,
    groupSortValue: decadeStart,
  };
}

// 정렬용 연도. 연도 미상은 -Infinity
function songYearValue(raw) {
  const parsed = parseSongYear(raw);
  return parsed ? parsed.sortValue : -Infinity;
}

const isYearUnknown = value => value === -Infinity;

// -------------------------------------
// 목록: 모든 곡 카드 (정렬 + 국가별/언어별 묶기)
// -------------------------------------

const titleCollator = new Intl.Collator("ko", {
  numeric: true,
  sensitivity: "base",
  ignorePunctuation: true,
});

const SORTABLE_START = /^[^\p{L}\p{N}]*[\p{Script=Latin}\p{Script=Hangul}\p{N}]/u;
const titleKeyCache = new Map();

// 제목 정렬 기준. 제목이 비로마자(한자, 키릴 등)로 시작하면 괄호 안의 독음·로마자 표기를 기준으로 삼음
function titleSortKey(title) {

  const text = String(title || "").trim();

  if (titleKeyCache.has(text)) return titleKeyCache.get(text);

  let key = text;

  if (!SORTABLE_START.test(text)) {
    const inner = text.match(/\(([^()]+)\)\s*$/);
    const part = inner && inner[1]
      .split(/[,/]/)
      .map(piece => piece.trim())
      .find(piece => SORTABLE_START.test(piece));
    if (part) key = part;
  }

  titleKeyCache.set(text, key);
  return key;
}

// mode: registered(등록 순) / title-asc / title-desc / year-asc / year-desc
// 정렬 기준이 같은 곡은 sscdbg.json에 등록된 순서를 유지하고, 연도 미상은 항상 맨 뒤
function sortSongsForList(songArray, mode) {

  const sorted = [...songArray];

  if (mode === "title-asc" || mode === "title-desc") {
    const sign = mode === "title-asc" ? 1 : -1;
    sorted.sort((a, b) =>
      sign * titleCollator.compare(titleSortKey(a.title), titleSortKey(b.title))
    );
  } else if (mode === "year-asc" || mode === "year-desc") {
    const sign = mode === "year-asc" ? 1 : -1;
    sorted.sort((a, b) => {
      const yearA = songYearValue(a.year);
      const yearB = songYearValue(b.year);
      if (isYearUnknown(yearA) || isYearUnknown(yearB)) {
        return isYearUnknown(yearA) === isYearUnknown(yearB) ? 0 : (isYearUnknown(yearA) ? 1 : -1);
      }
      return sign * (yearA - yearB);
    });
  }

  return sorted;
}

// 국가별/언어별 묶음: [{ label, flagCode?, songs }]. 여러 국가·언어에 걸친 곡은 각 묶음에 모두 나타남
function groupSongsForList(songArray, groupMode) {

  const groups = new Map();
  const UNKNOWN = "\u0000unknown";

  songArray.forEach(song => {
    const keys = groupMode === "country" ? song.countries : song.language;
    (keys.length ? keys : [UNKNOWN]).forEach(key => {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(song);
    });
  });

  const labelOf = key => {
    if (key === UNKNOWN) return groupMode === "country" ? "미분류" : "언어 미상";
    return groupMode === "country" ? getCountryName(key) : key;
  };

  return [...groups.entries()]
    .sort(([a], [b]) => {
      if (a === UNKNOWN || b === UNKNOWN) return a === UNKNOWN ? 1 : -1;
      return labelOf(a).localeCompare(labelOf(b), "ko");
    })
    .map(([key, groupSongs]) => ({
      label: labelOf(key),
      flagCode: groupMode === "country" ? (key === UNKNOWN ? "XX" : key) : null,
      songs: groupSongs,
    }));
}

// 곡 목록을 간략 카드 그리드로 붙임.
// 시간순 정렬일 때는 연도별/연대별/세기별로 나누고, 연도 미상 곡은 따로 떼어
// 오래된 순에서는 맨 위에 / 최신 순에서는 맨 아래에 둠
function appendSongGrids(container, songArray, sortMode, returnTo, headingTag, headingClass) {

  const appendGrid = (songsInGrid) => {
    const grid = document.createElement("div");
    grid.className = "song-list-compact";
    container.appendChild(grid);
    renderCompactSongGrid(grid, songsInGrid, { returnTo });
  };

  if (sortMode !== "year-asc" && sortMode !== "year-desc") {
    appendGrid(songArray);
    return;
  }

  const periods = new Map();
  const unknown = [];

  songArray.forEach(song => {
    const parsed = parseSongYear(song.year);
    if (!parsed) {
      unknown.push(song);
      return;
    }

    if (!periods.has(parsed.groupLabel)) {
      periods.set(parsed.groupLabel, { start: parsed.groupSortValue, songs: [] });
    }
    periods.get(parsed.groupLabel).songs.push(song);
  });

  const direction = sortMode === "year-asc" ? 1 : -1;

  const blocks = [...periods.entries()]
    .sort((a, b) => direction * (a[1].start - b[1].start))
    .map(([label, period]) => ({ label, songs: period.songs }));

  if (unknown.length) {
    const unknownBlock = { label: "연도 미상", songs: unknown };
    if (sortMode === "year-asc") blocks.unshift(unknownBlock);
    else blocks.push(unknownBlock);
  }

  blocks.forEach(block => {
    const heading = document.createElement(headingTag);
    heading.className = headingClass;
    heading.textContent = `${block.label} · ${block.songs.length}곡`;
    container.appendChild(heading);

    appendGrid(block.songs);
  });
}

function renderSongListView() {

  listSongs.innerHTML = "";

  const sortMode = listSort?.value || "registered";
  const sorted = sortSongsForList(songs, sortMode);
  const groupMode = listGroup?.value || "none";
  const returnTo = { type: "list" };

  if (groupMode === "none") {
    appendSongGrids(listSongs, sorted, sortMode, returnTo, "h3", "list-heading");
    return;
  }

  groupSongsForList(sorted, groupMode).forEach(group => {

    const section = document.createElement("div");
    section.className = "list-group";

    const heading = document.createElement("h3");
    heading.className = "list-heading";
    heading.innerHTML = `
      ${group.flagCode ? countryFlagHTML(group.flagCode) : ""}
      <span>${escapeHTML(group.label)}</span>
      <span class="list-heading-count">${group.songs.length}곡</span>
    `;
    section.appendChild(heading);

    listSongs.appendChild(section);

    appendSongGrids(section, group.songs, sortMode, returnTo, "h4", "list-subheading");
  });
}

listSort?.addEventListener("change", renderSongListView);
listGroup?.addEventListener("change", renderSongListView);

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
  selectedArtist = null;
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

function selectArtist(key) {

  const entry = artistIndex.get(key);
  if (!entry) return;

  viewMode = "artists";
  setActiveViewTab();

  selectedArtist = key;
  selectedCountry = null;
  selectedTag = null;
  compactListReturnTo = null;

  showSongsUI();

  countryTitle.innerHTML = `
    ${escapeHTML(entry.name)}
    <span class="country-title-count">${entry.songs.length}곡</span>
  `;

  tagSearch.value = "";

  renderArtistInfo(entry);
  renderSongs(entry.songs, { compact: true });
  updateURLState(true);
}

function selectTag(tag) {

  selectedTag = tag;
  selectedCountry = null;
  selectedArtist = null;
  compactListReturnTo = null;

  showSongsUI();

  const tagSongs = songs.filter(song =>
    (song.tags || []).includes(tag)
  );

  countryTitle.innerHTML = `
    ${escapeHTML(tag)}
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
    } else if (returnTo.type === "artist") {
      selectArtist(returnTo.value);
    } else if (returnTo.type === "list") {
      viewMode = "list";
      setActiveViewTab();
      renderBrowseView();
      updateURLState();
    } else {
      selectCountry(returnTo.value);
    }
    window.scrollTo(0, returnTo.scrollY || 0);
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
  if (!selectedCountry && !selectedTag && !selectedArtist && !hasFilter) {
    renderBrowseView();
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

    if (
      selectedArtist &&
      !artistIndex.get(selectedArtist)?.songs.includes(song)
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
      ${escapeHTML(selectedTag)}
      <span class="country-title-count">${filteredSongs.length}곡</span>
    `;
  } else if (selectedArtist) {
    const entry = artistIndex.get(selectedArtist);
    countryTitle.innerHTML = `
      ${escapeHTML(entry.name)}
      <span class="country-title-count">${filteredSongs.length}곡</span>
    `;
    renderArtistInfo(entry);
  } else {
    countryTitle.textContent =
      `검색 결과 (${filteredSongs.length}곡)`;
  }

  renderSongs(filteredSongs, {
    compact: !!(selectedCountry || selectedTag || selectedArtist),
  });
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
            <h2>${escapeHTML(song.title)}</h2>

            <div class="song-meta">
              <div class="song-meta-line">

                <span>${personLinksMarkup(song.artist)}</span>
                <span class="meta-divider">·</span>

                <span>${escapeHTML(song.year)}</span>
                <span class="meta-divider">·</span>

                <span>${escapeHTML(song.language.join(", "))}</span>
                <span class="meta-divider">·</span>

                <span class="song-countries">
                  ${song.countries
                    .map(code => `
                      <span class="song-country">
                        ${countryFlagHTML(code)}
                        ${escapeHTML(getCountryName(code))}
                      </span>
                    `)
                    .join("")}
                </span>

              </div>

              ${
                song.songwriters?.length
                  ? `
                    <div class="song-songwriters">
                      ${personLinksMarkup(song.songwriters)}
                    </div>
                  `
                  : ""
              }

            </div>
          </div>
        </div>

        <div class="song-tags">
          ${song.tags
            .map(tag => `
              <button
                type="button"
                class="tag"
                data-tag="${escapeHTML(tag)}"
                title="${escapeHTML(tag)} 태그의 곡 보기"
              >${escapeHTML(tag)}</button>
            `)
            .join("")}
        </div>

      </div>


      <!-- 오른쪽: 설명 + 링크 -->
      <div class="song-details">

        ${
          song.memo
            ? `
              <p class="song-memo">
                ${escapeHTML(song.memo)}
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
                      href="${escapeHTML(link.url)}"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      ${escapeHTML(link.title)}
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
                      href="${escapeHTML(video.url)}"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      ${escapeHTML(video.title)}
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
// 아티스트
// -------------------------------------

// 여러 곡에 공통으로 쓰이는 표기는 "같은 사람"으로 취급하지 않음
const GENERIC_CREDIT_KEYS = new Set(["traditional", "anonymous", "unknown", "작자미상", "미상"]);

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function artistKey(name) {
  return normalizeSearchText(String(name).trim()).replace(/\s+/g, " ");
}

function isGenericCredit(key) {
  return !key || GENERIC_CREDIT_KEYS.has(key.replace(/\s+/g, ""));
}

// 이름(별칭 포함)에 해당하는 아티스트 색인 key. 없으면 null
function resolveArtist(name) {
  const id = aliasToArtist.get(artistKey(name));
  return id && artistIndex.has(id) ? id : null;
}

// 곡 카드의 아티스트·작곡가 표기: 아티스트 화면이 있는 이름은 누르면 그 화면으로 이동
function personLinksMarkup(names) {
  return names
    .map(name => {
      const id = resolveArtist(name);
      return id
        ? `<button type="button" class="artist-link" data-artist="${escapeHTML(id)}" title="이 사람이 참여한 곡 모두 보기">${escapeHTML(name)}</button>`
        : escapeHTML(name);
    })
    .join(", ");
}

// artists.json에 등록된 사람별 곡 모음 (아티스트로 참여 + 작곡·작사로 참여) + 설명을 연결
//   artists.json: { "대표 이름": { "names": ["다른 이름", ...], "description": "..." } }
//   names에 적은 모든 이름(활동명, 그룹명, 작곡가 표기 등)은 같은 사람으로 묶임
function buildArtistIndex(profiles) {

  artistIndex = new Map();
  artistProfiles = new Map();
  aliasToArtist = new Map();

  const profileEntries = Object.entries(
    profiles && typeof profiles === "object" ? profiles : {}
  ).filter(([name, profile]) =>
    profile && typeof profile === "object" && !isGenericCredit(artistKey(name))
  );

  // 대표 이름을 먼저 등록해 두고, 그다음 별칭을 (이미 쓰인 이름은 건드리지 않고) 등록
  profileEntries.forEach(([name, profile]) => {
    const key = artistKey(name);
    if (artistIndex.has(key)) return;
    artistIndex.set(key, { key, name: name.trim(), songs: [], aliases: [name.trim()] });
    artistProfiles.set(key, profile);
    aliasToArtist.set(key, key);
  });

  profileEntries.forEach(([name, profile]) => {
    const id = artistKey(name);
    toCleanArray(profile.names).forEach(alias => {
      const aliasKey = artistKey(alias);
      if (isGenericCredit(aliasKey) || aliasToArtist.has(aliasKey)) return;
      aliasToArtist.set(aliasKey, id);
      artistIndex.get(id).aliases.push(String(alias).trim());
    });
  });

  // 아티스트 또는 작곡·작사가로 참여한 곡 모으기 (artists.json에 등록된 사람만)
  songs.forEach(song => {
    [...song.artist, ...song.songwriters].forEach(name => {
      const entry = artistIndex.get(aliasToArtist.get(artistKey(name)));
      if (entry && !entry.songs.includes(song)) entry.songs.push(song);
    });
  });

  // 곡이 하나도 연결되지 않은 항목(artists.json의 예시·오타 등)은 목록에서 제외
  artistIndex.forEach((entry, id) => {
    if (entry.songs.length === 0) artistIndex.delete(id);
  });

  // 아티스트 화면에서는 연대순 (같은 해는 등록 순서 유지)
  artistIndex.forEach(entry => {
    entry.songs.sort(
      (a, b) => songYearValue(a.year) - songYearValue(b.year)
    );
    entry.searchText = normalizeSearchText(entry.aliases.join(" "));
    entry.asWriterOnly = new Set(
      entry.songs.filter(song =>
        !song.artist.some(name => aliasToArtist.get(artistKey(name)) === entry.key)
      )
    );
  });
}

function renderArtistsList() {

  const sortMode = artistSort?.value || "count-desc";
  const filterText = normalizeSearchText(artistFilter?.value || "").trim();

  const entries = [...artistIndex.values()].filter(entry =>
    !filterText || entry.searchText.includes(filterText)
  );

  entries.sort((a, b) => {
    if (sortMode === "name") {
      return a.name.localeCompare(b.name, "ko");
    }
    return b.songs.length - a.songs.length || a.name.localeCompare(b.name, "ko");
  });

  artistsList.innerHTML = "";

  if (artistCount) {
    artistCount.textContent = `${entries.length}명`;
  }

  if (entries.length === 0) {
    artistsList.innerHTML = `<div class="no-results">${
      filterText ? "조건에 맞는 사람이 없습니다." : "아직 등록된 사람이 없습니다."
    }</div>`;
    return;
  }

  entries.forEach(entry => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "country-card artist-card";
    button.innerHTML = `
      <span class="country-name">${escapeHTML(entry.name)}</span>
      <span class="country-count">${entry.songs.length}곡</span>
    `;
    button.addEventListener("click", () => selectArtist(entry.key));
    artistsList.appendChild(button);
  });
}

// 아티스트 화면 위쪽의 설명 (artists.json에 적어 둔 내용이 있을 때만 표시)
function renderArtistInfo(entry) {

  const profile = artistProfiles.get(entry.key);
  const description = profile && typeof profile.description === "string"
    ? profile.description.trim()
    : "";

  artistInfo.innerHTML = "";

  if (!description) {
    artistInfo.style.display = "none";
    return;
  }

  const text = document.createElement("p");
  text.className = "artist-info-text";
  text.textContent = description;
  artistInfo.appendChild(text);

  artistInfo.style.display = "block";
}

artistSort?.addEventListener("change", renderArtistsList);
artistFilter?.addEventListener("input", renderArtistsList);

// -------------------------------------
// 연관곡 (최대 5곡)
// -------------------------------------

// 가중치: 아티스트/작곡가가 같은 곡을 가장 가깝게, 태그(희귀할수록 높게), 언어·국가·시대는 보조
const RELATED_LIMIT = 6;
const RELATED_MIN_SCORE = 0.5;
const RELATED_WEIGHTS = {
  artist: 6,
  writer: 5,
  cross: 2,
  tag: 3,
  language: 1,
  country: 0.5,
  era: 0.5,
};

const songProfileCache = new WeakMap();
let tagWeightCache = null;

function peopleKeys(names) {
  return new Set(
    names
      .map(name => {
        const key = artistKey(name);
        return aliasToArtist.get(key) || key;
      })
      .filter(key => !isGenericCredit(key))
  );
}

function getSongProfile(song) {
  let profile = songProfileCache.get(song);

  if (!profile) {
    profile = {
      artists: peopleKeys(song.artist),
      writers: peopleKeys(song.songwriters),
      tags: new Set(song.tags),
      languages: new Set(song.language.map(artistKey)),
      countries: new Set(song.countries),
      year: songYearValue(song.year),
    };
    songProfileCache.set(song, profile);
  }

  return profile;
}

// 많은 곡에 붙은 태그(팝 등)는 적게, 드문 태그는 많게 반영
function getTagWeight(tag) {
  if (!tagWeightCache) {
    tagWeightCache = new Map();
    computeFieldCounts("tags").forEach((count, name) => {
      tagWeightCache.set(name, Math.log(1 + songs.length / count));
    });
  }
  return tagWeightCache.get(tag) || 1;
}

function shared(a, b) {
  return [...a].filter(item => b.has(item));
}

function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  const common = shared(a, b).length;
  return common / (a.size + b.size - common);
}

function weightedTagSimilarity(a, b) {
  if (a.size === 0 || b.size === 0) return 0;

  let common = 0;
  let total = 0;
  const union = new Set([...a, ...b]);

  union.forEach(tag => {
    const weight = getTagWeight(tag);
    total += weight;
    if (a.has(tag) && b.has(tag)) common += weight;
  });

  return total === 0 ? 0 : common / total;
}

function getRelatedSongs(song) {

  const me = getSongProfile(song);
  const results = [];

  songs.forEach((other, index) => {
    if (other === song) return;

    const you = getSongProfile(other);

    const sameArtists = shared(me.artists, you.artists);
    const sameWriters = shared(me.writers, you.writers);
    const crossPeople =
      shared(me.artists, you.writers).length +
      shared(me.writers, you.artists).length;
    const sameTags = shared(me.tags, you.tags);

    if (!sameArtists.length && !sameWriters.length && !crossPeople && !sameTags.length) {
      return;
    }

    const sameLanguages = shared(me.languages, you.languages);
    const yearGap = Math.abs(me.year - you.year);
    const closeEra = Number.isFinite(yearGap) && yearGap <= 5;

    const score =
      RELATED_WEIGHTS.artist * jaccard(me.artists, you.artists) +
      RELATED_WEIGHTS.writer * jaccard(me.writers, you.writers) +
      (crossPeople ? RELATED_WEIGHTS.cross : 0) +
      RELATED_WEIGHTS.tag * weightedTagSimilarity(me.tags, you.tags) +
      RELATED_WEIGHTS.language * jaccard(me.languages, you.languages) +
      RELATED_WEIGHTS.country * jaccard(me.countries, you.countries) +
      (closeEra ? RELATED_WEIGHTS.era : 0);

    if (score < RELATED_MIN_SCORE) return;

    const reasons = [];
    if (sameArtists.length) reasons.push("같은 아티스트");
    if (sameWriters.length) reasons.push("같은 작곡·작사가");
    if (!sameArtists.length && !sameWriters.length && crossPeople) reasons.push("함께한 인물");
    if (sameTags.length) reasons.push(`태그 ${sameTags.slice(0, 2).join(", ")}`);
    if (reasons.length < 2 && sameLanguages.length) reasons.push("같은 언어");

    results.push({
      song: other,
      score,
      yearGap: Number.isFinite(yearGap) ? yearGap : Infinity,
      index,
      reason: reasons.slice(0, 2).join(" · "),
    });
  });

  results.sort(
    (a, b) =>
      b.score - a.score ||
      a.yearGap - b.yearGap ||
      a.index - b.index
  );

  return results.slice(0, RELATED_LIMIT);
}

function renderRelatedSongs(card, song) {
  const related = getRelatedSongs(song);
  if (related.length === 0) return;

  const reasonBySong = new Map(related.map(item => [item.song, item.reason]));

  const section = document.createElement("section");
  section.className = "related-songs";

  const heading = document.createElement("h3");
  heading.className = "related-songs-heading";
  heading.textContent = "연관곡";
  section.appendChild(heading);

  const grid = document.createElement("div");
  grid.className = "song-list-compact";
  section.appendChild(grid);

  card.appendChild(section);

  renderCompactSongGrid(grid, related.map(item => item.song), {
    returnTo: compactListReturnTo,
    captionFor: other => reasonBySong.get(other),
  });
}

// -------------------------------------
// 곡 목록 출력 (간략 카드 / 상세 카드)
// -------------------------------------

// 간략 카드: 이미지 + 제목 + 가수
function compactSongCardMarkup(song, caption = "") {
  const performerText = song.artist?.length
    ? song.artist.join(", ")
    : (song.songwriters || []).join(", ");

  return `
    <div class="song-artwork song-artwork-compact placeholder"></div>
    <div class="compact-song-info">
      <div class="compact-song-title">${escapeHTML(song.title)}</div>
      <div class="compact-song-artist">${escapeHTML(performerText)}</div>
      ${caption ? `<div class="compact-song-reason">${escapeHTML(caption)}</div>` : ""}
    </div>
  `;
}

// 상세 카드 안의 태그/아티스트 버튼을 동작하게 연결
function wireSongCard(card) {
  card.querySelectorAll(".tag[data-tag]").forEach(button => {
    button.addEventListener("click", () => selectTag(button.dataset.tag));
  });

  card.querySelectorAll(".artist-link[data-artist]").forEach(button => {
    button.addEventListener("click", () => selectArtist(button.dataset.artist));
  });
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
    const returnTo = selectedArtist
      ? { type: "artist", value: selectedArtist }
      : selectedTag
        ? { type: "tag", value: selectedTag }
        : { type: "country", value: selectedCountry };
    const artistEntry = selectedArtist && artistIndex.get(selectedArtist);
    renderCompactSongGrid(songList, songArray, {
      returnTo,
      captionFor: artistEntry
        ? song => (artistEntry.asWriterOnly.has(song) ? "작곡·작사 참여" : "")
        : undefined,
    });
    return;
  }

  songArray.forEach(song => {
    const item = document.createElement("div");
    item.innerHTML = songCardMarkup(song);

    songList.appendChild(item);

    if (typeof loadArtworkInto === "function") {
      loadArtworkInto(item.querySelector(".song-artwork"), song);
    }

    wireSongCard(item);

    if (songArray.length === 1) {
      renderRelatedSongs(item, song);
    }
  });
}

// 간략 카드 그리드를 컨테이너에 렌더링 (국가/태그/아티스트 화면, 연표, 연관곡 공용)
function renderCompactSongGrid(container, songArray, { returnTo, captionFor } = {}) {

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
    item.innerHTML = compactSongCardMarkup(song, captionFor ? captionFor(song) : "");

    item.addEventListener("click", () => {
      // 돌아왔을 때 보던 위치를 되살리기 위해 처음 클릭한 순간의 스크롤을 기억
      if (returnTo && returnTo.scrollY === undefined) {
        returnTo.scrollY = window.scrollY;
      }
      compactListReturnTo = returnTo || null;
      showSingleSongDetail(song, { preserveContext: true });
    });

    container.appendChild(item);

    if (typeof loadArtworkInto === "function") {
      loadArtworkInto(item.querySelector(".song-artwork"), song);
    }
  });
}