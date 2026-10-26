#!/usr/bin/env python3
"""sscdbg.json의 곡마다 고정 "id"를 한 번만 기록합니다.

사용법
    pip install unidecode            # 한 번만
    python3 tools/add-song-ids.py    # 저장소 루트에서 실행 (sscdbg.json을 직접 고침)
    python3 tools/add-song-ids.py --dry-run   # 파일은 건드리지 않고 결과만 미리 보기

규칙
  - 이미 "id"가 있는 곡은 절대 바꾸지 않습니다. (새 곡을 추가한 뒤 다시 실행하면 새 곡에만 id가 붙습니다)
  - id는 "제목-가수" 모양의 영문 슬러그입니다. 예: moskau-dschinghis-khan
    제목이나 가수에 로마자가 없으면(한글·한자·가나·키릴 등) 괄호 안 로마자 표기를 쓰고,
    그것도 없으면 괄호 안 한글 독음, 그것도 없으면 발음을 로마자로 옮겨 만듭니다.
  - 같은 id가 생기면 -2, -3을 붙입니다.
  - 파일의 들여쓰기·줄바꿈·배열 모양은 그대로 두고 "id" 한 줄만 각 곡의 맨 앞에 끼워 넣습니다.
  - 한 번 적은 id는 제목·가수를 고쳐도 그대로 둡니다. playlists.json과 좋아요가 이 id를 기준으로 곡을 찾기 때문입니다.
"""

import json
import re
import sys
from pathlib import Path

try:
    from unidecode import unidecode
except ImportError:
    sys.exit("unidecode가 필요합니다: pip install unidecode")

PATH = Path("sscdbg.json")
MAX_TITLE = 40
MAX_ARTIST = 28


def has_latin(text):
    return re.search(r"[A-Za-z]", text) is not None


def slugify(text):
    text = unidecode(text).lower()
    text = text.replace("'", "").replace("’", "")
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")


def pick_latin(text):
    """괄호 밖 → 괄호 안 순으로 로마자가 들어 있는 쪽을 고름. 없으면 전체."""
    outside = re.sub(r"\([^()]*\)", " ", text).strip()
    inside = " ".join(re.findall(r"\(([^()]*)\)", text)).strip()
    for part in (outside, inside):
        if has_latin(part):
            return part
    # 로마자가 어디에도 없으면(한자·가나·키릴 등 + 한글 독음) 한글 독음을 우선 사용
    hangul = " ".join(re.findall(r"[가-힣]+", inside))
    return hangul or outside or inside or text


def clip(slug, limit):
    if len(slug) <= limit:
        return slug
    cut = slug[:limit]
    if "-" in cut and slug[limit] != "-":
        cut = cut.rsplit("-", 1)[0]
    return cut.strip("-")


def base_slug(song):
    title = clip(slugify(pick_latin(str(song.get("title", "")))), MAX_TITLE)

    people = song.get("artist") or song.get("songwriters") or []
    if isinstance(people, str):
        people = [people]
    artist = clip(slugify(pick_latin(str(people[0]))), MAX_ARTIST) if people else ""

    return "-".join(part for part in (title, artist) if part) or "song"


def top_level_object_starts(text):
    """최상위 배열 안 각 곡 객체의 '{' 위치를 순서대로 돌려줌 (문자열 안의 괄호는 무시)."""
    starts, depth, in_string, escaped = [], 0, False, False
    for i, ch in enumerate(text):
        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
        elif ch in "[{":
            if ch == "{" and depth == 1:
                starts.append(i)
            depth += 1
        elif ch in "]}":
            depth -= 1
    return starts


def main():
    dry_run = "--dry-run" in sys.argv
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    path = Path(args[0]) if args else PATH

    text = path.read_text(encoding="utf-8")
    songs = json.loads(text)
    starts = top_level_object_starts(text)

    if len(starts) != len(songs):
        sys.exit(f"곡 객체 위치({len(starts)})와 곡 수({len(songs)})가 달라 중단합니다.")

    existing = [s["id"] for s in songs if isinstance(s.get("id"), str) and s["id"]]
    dupes = {i for i in existing if existing.count(i) > 1}
    if dupes:
        sys.exit(f"이미 같은 id가 둘 이상 있습니다: {sorted(dupes)}")

    used = set(existing)
    new_ids = {}

    for index, song in enumerate(songs):
        if isinstance(song.get("id"), str) and song["id"]:
            continue
        base = base_slug(song)
        candidate, n = base, 1
        while candidate in used:
            n += 1
            candidate = f"{base}-{n}"
        used.add(candidate)
        new_ids[index] = candidate

    if not new_ids:
        print("새로 붙일 id가 없습니다. (모든 곡에 이미 id가 있음)")
        return

    # 뒤에서부터 끼워 넣어야 앞쪽 위치가 밀리지 않음
    out = text
    for index in sorted(new_ids, reverse=True):
        pos = starts[index] + 1
        rest = out[pos:]
        line = f'"id": "{new_ids[index]}",'
        if rest.lstrip(" \t").startswith(("\n", "\r")):
            # 다음 줄의 들여쓰기를 따라감
            m = re.match(r"[ \t]*\r?\n([ \t]*)\S", rest)
            indent = m.group(1) if m else "    "
            newline = "\r\n" if rest.lstrip(" \t").startswith("\r\n") else "\n"
            out = out[:pos] + newline + indent + line + out[pos:]
        else:
            out = out[:pos] + " " + line + out[pos:]

    # 검증: 다른 내용은 하나도 바뀌지 않았고, id만 새로 붙었는지
    check = json.loads(out)
    assert len(check) == len(songs)
    for old, new in zip(songs, check):
        without_id = {k: v for k, v in new.items() if k != "id"}
        assert without_id == {k: v for k, v in old.items() if k != "id"}, old.get("title")
    assert len({s["id"] for s in check}) == len(check), "id가 겹칩니다"

    if dry_run:
        for index in list(new_ids)[:15]:
            print(f"  {songs[index].get('title')}  →  {new_ids[index]}")
        print(f"... 총 {len(new_ids)}곡에 id가 붙습니다. (--dry-run: 파일은 바꾸지 않음)")
        return

    path.write_text(out, encoding="utf-8")
    print(f"{len(new_ids)}곡에 id를 붙였습니다. (전체 {len(songs)}곡)")


if __name__ == "__main__":
    main()
