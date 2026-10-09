// -------------------------------------
// 앨범 아트
// -------------------------------------
//
// 이미지는 tools/cover-picker.html로 미리 골라 covers/에 저장해 두고,
// sscdbg.json의 song.image 필드에 경로를 기록하는 방식입니다.
// song.image가 없는 곡은 ♪ 자리표시 아이콘으로 표시됩니다.

function loadArtworkInto(el, song) {
  if (!el) return;

  const url = song.image;

  el.classList.remove("placeholder");

  if (!url) {
    el.classList.add("no-artwork");
    return;
  }

  const img = document.createElement("img");
  img.src = url;
  img.alt = "";
  img.loading = "lazy";
  img.decoding = "async";

  img.addEventListener("error", () => {
    el.classList.add("no-artwork");
    img.remove();
  });

  el.appendChild(img);
}
