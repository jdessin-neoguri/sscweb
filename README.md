# SSCWEB
sesochat

## 아티스트 설명 (artists.json)

아티스트 탭에서 카드를 열면 그 사람이 **아티스트로 참여한 곡과 작곡·작사가로 참여한 곡**이 함께 나오고,
`artists.json`에 적어 둔 설명이 목록 위에 표시됩니다. 파일이 없거나 비어 있어도 사이트는 정상 동작합니다.

```json
{
  "Ralph Siegel": {
    "names": ["Ralph Siegel & Bernd Meinunger", "랄프 지겔"],
    "description": "설명 문장. 여러 줄도 가능합니다."
  }
}
```

- 맨 앞 키가 카드에 표시되는 대표 이름이고, `names`에는 같은 사람의 다른 이름(활동명·그룹명·작곡가 표기·원어 표기 등)을 모두 적습니다.
- 이 이름들이 `sscdbg.json`의 `artist`나 `songwriters`에 나오면 모두 한 카드로 묶입니다. 대소문자·악센트 차이는 무시됩니다.
- `names`와 `description`은 모두 생략할 수 있습니다. artists.json에 없는 아티스트도 자동으로 카드가 생기며, 같은 이름이 작곡가로 적힌 곡도 함께 나옵니다.
- 작곡가로만 등장하는 사람은 artists.json에 적어야 카드가 생깁니다.
- 곡 카드에서 이 사람의 이름(아티스트·작곡가)을 누르면 해당 카드로 이동합니다.
- Traditional, Anonymous, 작자미상은 묶이지 않습니다.
