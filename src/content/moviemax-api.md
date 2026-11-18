# MOVIE MAX Content API — Developer Guide

English (MovieBox) · Luganda (VJ) · Luo · Teso · Search · Play · Download · Subtitles

Version 1 · Base address: `{{ORIGIN}}/api/public/v1`

# 1. Overview

This API lets another website or app show the full MOVIE MAX library: English movies and series (MovieBox), Luganda translated titles with their VJ, and the Luo, Luganda and Teso titles uploaded by MOVIE MAX admins. Everything — lists, details, search, playing, downloading and subtitles — is called **on {{HOST}}**. Your app never talks to MovieBox, Narabox or Firebase directly.

- **Read-only:** every endpoint is `GET` and returns JSON (play/download links return video).
- **API key required:** every data endpoint needs an API key from a paid developer plan (see section 2).
- **Open to any site:** CORS allows every origin, so it works from a browser, a mobile app or a server.
- **One domain everywhere:** every `playUrl`, `downloadUrl` and subtitle link in the answers points back to `{{ORIGIN}}`.

## 1.1 Base address

```
{{ORIGIN}}/api/public/v1
```

Opening the base address (no key needed) returns the list of every endpoint, already filled in with this domain.

## 1.2 Response format

Every JSON answer has the same envelope:

```json
// success
{ "ok": true, "data": { ... } }

// error
{ "ok": false, "error": "Invalid id" }
```

| HTTP status | Meaning |
|---|---|
| 200 | Success — read `data`. |
| 400 | A parameter is missing or invalid (e.g. Missing q, Invalid id). |
| 401 | The API key is missing or wrong. |
| 402 | Your developer plan has ended — renew it in the dashboard. |
| 429 | Too many requests this second, or the monthly quota is used up. |
| 404 | Unknown endpoint or title not found. |
| 502 | The upstream catalog is temporarily unavailable — retry after a few seconds. |
| 503 | An old-style key could not be checked right now — create a new key (new keys never need the database). |

## 1.3 All endpoints at a glance

| Endpoint | What it returns |
|---|---|
| `/search?q=` | One search across English, Luganda (Narabox) and uploaded titles |
| `/moviebox/home` | Home page: hero slides, all sections (rows), trending, coming soon |
| `/moviebox/feed?page=0` | Endless "More from MovieBox" feed, page by page |
| `/moviebox/trending` | Trending movies and series |
| `/moviebox/search?q=&page=1` | English catalog search |
| `/moviebox/title/{id}` | Full details: description, cast, seasons, country |
| `/moviebox/sources/{id}?se=&ep=` | Every quality with play, download and subtitle links |
| `/moviebox/related/{id}` | Similar titles |
| `/luganda?page=` | Luganda titles uploaded by MOVIE MAX admins |
| `/luganda/title/{id}` | One uploaded Luganda title with episodes |
| `/luganda/narabox?kind=movies&page=` | Luganda VJ catalog (movies or tv-shows), page by page |
| `/luganda/narabox/{kind}/{id}` | One Luganda VJ title with play/download links and episodes |
| `/luganda/catalog` | The whole Luganda VJ catalog in one answer (posters only) |
| `/luo?page=` · `/luo/title/{id}` | Luo titles and details |
| `/teso?page=` · `/teso/title/{id}` | Teso titles and details |

# 2. API key & plans

Every data endpoint needs an **API key**. Keys are created in the **Developer dashboard** at [{{ORIGIN}}/developer]({{ORIGIN}}/developer) and only work while you have a **paid developer plan**.

## 2.1 Get your API key

1. Sign in on [{{HOST}}]({{ORIGIN}}) (create a free account if you don't have one).
2. Open **Dashboard** in the header (or go to `{{ORIGIN}}/developer`).
3. Pick a plan, choose **Monthly** or **Yearly**, and pay with mobile money, PayPal or card.
4. Press **Create API key**, give it a name and copy it. The full key (it starts with `mmx_live_`) is shown **only once** — keep it safe.

## 2.2 Sending the key

| Method | Example |
|---|---|
| Header (recommended) | `Authorization: Bearer YOUR_API_KEY` |
| Header | `X-API-Key: YOUR_API_KEY` |
| Query string | `?api_key=YOUR_API_KEY` |

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "{{ORIGIN}}/api/public/v1/moviebox/trending"
```

- **Play, download and subtitle links** (`/api/public/movie`, `/api/public/stream`, `/api/public/subtitle`) that come back in answers work **without** the key and do not count against your quota, so they can go straight into `<video>`, `<track>` and `<a>` tags.
- Keep the key on your server when you can. If you must use it in browser code, anyone who views your page source can copy it — delete and re-create it in the dashboard if it leaks.

## 2.3 Plans

| Plan | Monthly | Yearly (2 months free) | Requests / month | Requests / second | API keys |
|---|---|---|---|---|---|
| Developer | $9.99 | $99.90 | 10,000 | 5 | 1 |
| Pro | $24.99 | $249.90 | 100,000 | 15 | 3 |
| Business | $59.99 | $599.90 | 500,000 | 30 | 10 |
| Premium | $149.99 | $1,499.90 | Unlimited | 100 | Unlimited |
| Custom | Contact us | Contact us | Your needs | Your needs | Your needs |

**Premium** also includes full API access, priority support and commercial usage, with no monthly request quota.

**Custom plan:** email [nexusplatformafrica@gmail.com](mailto:nexusplatformafrica@gmail.com) or WhatsApp [+256 795 592 662](https://wa.me/256795592662).

## 2.4 Limits & headers

- The **monthly quota** counts every data call made with your keys in a calendar month (UTC) and resets on the 1st.
- The **rate limit** is counted per key, per second.
- Every answer carries your current numbers:

| Header | Meaning |
|---|---|
| `X-Plan` | Your plan name |
| `X-RateLimit-Limit` / `X-RateLimit-Remaining` | Requests allowed per second / left this second |
| `X-Quota-Limit` / `X-Quota-Used` / `X-Quota-Remaining` | Monthly quota, used, left |
| `Retry-After` | Seconds to wait after a 429 |

| Status | Error | What to do |
|---|---|---|
| 401 | Invalid or missing API token | Check the key, or create a new one |
| 402 | No active developer plan | Renew or buy a plan in the dashboard |
| 429 | Rate limit | Wait 1 second and retry |
| 429 | Monthly quota reached | Upgrade, or wait for the next month |

# 3. Search

**GET `/api/public/v1/search?q={text}`**

Searches all three libraries at once. Each group is returned separately so you can show them as tabs or sections. If one library is down, its group is simply empty — the others still return.

| Parameter | Where | Required | Description |
|---|---|---|---|
| q | query | yes | Search text, 1–120 characters. |

```json
GET {{ORIGIN}}/api/public/v1/search?q=love

{
  "ok": true,
  "data": {
    "query": "love",
    "moviebox": [ { "id": "777059274332718120", "title": "Love", "type": "movie", "year": "2015", "poster": "https://...", ... } ],
    "luganda": [ { "id": 2656, "kind": "movie", "title": "...", "poster": "https://...", "vj": "Vj mark",
                   "detailUrl": "{{ORIGIN}}/api/public/v1/luganda/narabox/movies/2656" } ],
    "uploads": [ { "id": "abc123", "language": "luo", "title": "...",
                   "playUrl": "{{ORIGIN}}/api/public/stream?url=...",
                   "detailUrl": "{{ORIGIN}}/api/public/v1/luo/title/abc123" } ]
  }
}
```

# 4. English — MovieBox

MovieBox titles use long numeric ids (e.g. `8906247916759695608`). `type` is `movie` or `series`.

## 4.1 Catalog item (used in every list)

| Field | Type | Description |
|---|---|---|
| id | string | MovieBox subject id — use it for title / sources / related. |
| title | string | Title as shown on MovieBox. |
| type | "movie" \| "series" | Movie or series. |
| year | string \| null | Release year. |
| poster | string \| null | Portrait poster (400 px wide). |
| backdrop | string \| null | Wide image (1440 px wide). |
| rating | string \| null | IMDb-style rating, e.g. "8.0". |
| genre | string \| null | Genres separated by " · ". |
| appointmentDate | string \| null | Release date for Coming Soon titles. |
| booked | number \| null | People who pre-booked a Coming Soon title. |

## 4.2 Home

**GET `/api/public/v1/moviebox/home`**

The same home page MovieBox's website shows: hero slides, every section, trending and coming soon. Cached 5 minutes.

```json
{ "ok": true, "data": {
  "hero": [ CatalogItem, ... ],
  "rows": [ { "title": "Popular Series", "items": [ CatalogItem, ... ] },
            { "title": "Popular Movie", "items": [ ... ] },
            { "title": "Nollywood Movie", "items": [ ... ] }, ... ],
  "trending": [ CatalogItem, ... ],
  "comingSoon": [ CatalogItem, ... ],
  "web": true
} }
```

## 4.3 Endless feed

**GET `/api/public/v1/moviebox/feed?page={n}`**

Endless feed for the bottom of the home page. Start with `page=0`, then request `nextPage` until it is `null`.

| Parameter | Where | Required | Description |
|---|---|---|---|
| page | query | no | Page number, default 0. |

```json
{ "ok": true, "data": { "items": [ CatalogItem, ... ], "nextPage": 1 } }
```

## 4.4 Trending

**GET `/api/public/v1/moviebox/trending`**

Trending movies and series merged from the home, movie and series tabs.

```json
{ "ok": true, "data": [ CatalogItem, ... ] }
```

## 4.5 English search

**GET `/api/public/v1/moviebox/search?q={text}&page={n}`**

| Parameter | Where | Required | Description |
|---|---|---|---|
| q | query | yes | Search text, 1–120 characters. |
| page | query | no | Page, default 1. |

```json
GET {{ORIGIN}}/api/public/v1/moviebox/search?q=avatar

{ "ok": true, "data": [ { "id": "8906247916759695608", "title": "Avatar", "type": "movie", "year": "2009", ... } ] }
```

## 4.6 Title details

**GET `/api/public/v1/moviebox/title/{id}`**

Full details of one title. `{id}` may be the numeric id or a MOVIE MAX watch link name such as `avatar-2009-movie`. For series, `seasons` tells you how many episodes each season has.

| Parameter | Where | Required | Description |
|---|---|---|---|
| id | path | yes | Numeric id or watch-link name. |

```json
{ "ok": true, "data": {
  "id": "2190807691784770592", "title": "Lucifer S1-S6", "type": "series", "year": "2016",
  "poster": "https://...", "backdrop": "https://...", "rating": "8.0",
  "genre": "Crime · Drama · Fantasy",
  "description": "Lucifer Morningstar has decided he's had enough ...",
  "duration": null, "country": "United States", "language": null,
  "cast": [ { "name": "Nathan Hope", "character": "Director", "avatar": "https://..." } ],
  "seasons": [ { "season": 1, "episodes": 13 }, { "season": 2, "episodes": 18 } ],
  "detailPath": "lucifer-UQASHYbVPB2"
} }
```

## 4.7 Sources (play & download)

**GET `/api/public/v1/moviebox/sources/{id}?se={season}&ep={episode}`**

Every available quality of the full movie or episode, best first. Each one carries ready-to-use links on {{HOST}}: `playUrl` for a video player, `downloadUrl` to save the file, and subtitle links (converted to WebVTT). For movies leave `se`/`ep` out; for series pass both.

| Parameter | Where | Required | Description |
|---|---|---|---|
| id | path | yes | Numeric MovieBox id. |
| se | query | series | Season number (0 or omit for movies). |
| ep | query | series | Episode number. |
| detailPath | query | no | Value from /title — speeds up the lookup. |
| title | query | no | Used for download file names. |

```json
GET {{ORIGIN}}/api/public/v1/moviebox/sources/2190807691784770592?se=1&ep=1

{ "ok": true, "data": [ {
  "resourceId": "6484813154554889304", "resolution": 1080, "codec": "h264",
  "bytes": 644380485, "size": "615 MB", "promo": false,
  "playUrl": "{{ORIGIN}}/api/public/movie?subjectId=...&se=1&ep=1&resourceId=...&res=1080&detailPath=...",
  "downloadUrl": "{{ORIGIN}}/api/public/movie?...&dl=Lucifer-S1E1-1080p.mp4",
  "subtitles": [ { "label": "English",
                   "url": "{{ORIGIN}}/api/public/subtitle?url=...",
                   "downloadUrl": "{{ORIGIN}}/api/public/subtitle?url=...&dl=Lucifer-English.vtt" } ]
}, { "resolution": 720, ... }, { "resolution": 480, ... } ] }
```

- **promo:** MovieBox sometimes lists a short "upgrade your app" clip. Entries with `promo: true` should not be used in your player.
- **Links stay valid:** `playUrl` and `downloadUrl` do not expire. Each time they are opened, the server fetches a fresh signed file, so long viewing sessions and resumed downloads keep working.

## 4.8 Related titles

**GET `/api/public/v1/moviebox/related/{id}`**

Titles similar to this one (same genre and type).

| Parameter | Where | Required | Description |
|---|---|---|---|
| id | path | yes | Numeric MovieBox id. |

```json
{ "ok": true, "data": [ CatalogItem, ... ] }
```

# 5. Luganda

Luganda content has two sources, both available here: the **Luganda VJ catalog** (Narabox — translated movies and series with a VJ name) and **titles MOVIE MAX admins upload**.

## 5.1 Luganda VJ catalog (Narabox)

**GET `/api/public/v1/luganda/narabox?kind={movies|tv-shows}&page={n}&per_page={n}`**

Newest first. Movies include `playUrl`/`downloadUrl`; series include their episodes when you open the detail.

| Parameter | Where | Required | Description |
|---|---|---|---|
| kind | query | no | movies (default) or tv-shows. |
| page | query | no | Page, default 1. |
| per_page | query | no | 1–100, default 50. |

```json
{ "ok": true, "data": {
  "items": [ {
    "id": 2656, "source": "narabox", "kind": "movie",
    "title": "Opportunity Knocks", "originalTitle": "Opportunity Knocks - VJ Mark",
    "slug": "opportunity-knocks-vj-mark-vj-mark", "description": "Eddie and Lou are ...",
    "poster": "https://...", "backdrop": "https://...", "rating": null,
    "year": "1990", "releaseDate": "1990-...", "vj": "Vj mark", "genre": ["Comedy"],
    "createdAt": "2026-11-14T11:33:36+03:00",
    "playUrl": "{{ORIGIN}}/api/public/stream?url=...",
    "downloadUrl": "{{ORIGIN}}/api/public/stream?url=...&dl=Opportunity-Knocks.mp4"
  } ],
  "meta": { "current_page": 1, "last_page": 73, "per_page": 50, "total": 3600 }
} }
```

## 5.2 One Luganda VJ title

**GET `/api/public/v1/luganda/narabox/{kind}/{id}`**

For series, `seasons[].episodes[]` each carry their own `playUrl` and `downloadUrl` (an episode without a video has `null` links).

| Parameter | Where | Required | Description |
|---|---|---|---|
| kind | path | yes | movies or tv-shows. |
| id | path | yes | Numeric Narabox id. |

```json
{ "ok": true, "data": { "id": 109, "kind": "series", "title": "If Wishes Could Kill", "vj": "...",
  "seasons": [ { "season": 1, "title": "Season 1",
    "episodes": [ { "id": 5501, "episode": 1, "title": "Episode 1",
      "playUrl": "{{ORIGIN}}/api/public/stream?url=...",
      "downloadUrl": "{{ORIGIN}}/api/public/stream?url=...&dl=..." } ] } ] } }
```

## 5.3 Whole Luganda VJ catalog

**GET `/api/public/v1/luganda/catalog`**

The whole Luganda VJ catalog in one answer — light cards (poster, VJ, genre, year) with a `detailUrl` for each. Movies without a video are left out. Ideal for building your own filters by VJ or genre. Cached 5 minutes.

```json
{ "ok": true, "data": {
  "movies": [ { "id": 2656, "kind": "movie", "title": "Opportunity Knocks", "poster": "https://...", "vj": "Vj mark",
                "genre": ["Comedy"], "year": "1990",
                "detailUrl": "{{ORIGIN}}/api/public/v1/luganda/narabox/movies/2656" } ],
  "series": [ ... ]
} }
```

## 5.4 Luganda titles uploaded by admins

Same format as Luo and Teso — see section 6. Use `/api/public/v1/luganda?page=1` and `/api/public/v1/luganda/title/{id}`.

# 6. Luo, Luganda & Teso uploads

Titles uploaded in the MOVIE MAX dashboard. Only **published** titles appear. Newest first.

## 6.1 List

**GET `/api/public/v1/{language}?page={n}&per_page={n}&q={text}&vj={name}`**

| Parameter | Where | Required | Description |
|---|---|---|---|
| language | path | yes | luo, luganda or teso. |
| page | query | no | Page, default 1. |
| per_page | query | no | 1–500, default 50. |
| q | query | no | Filter by title text. |
| vj | query | no | Filter by VJ name. |

```json
GET {{ORIGIN}}/api/public/v1/luo?page=1&per_page=20

{ "ok": true, "data": {
  "items": [ {
    "id": "Kx81...", "source": "upload", "language": "luo", "kind": "movie",
    "title": "...", "description": "...", "poster": "https://...", "backdrop": "https://...",
    "vj": "VJ ...", "genre": "Action", "year": 2025, "latest": true,
    "createdAt": "2026-11-10T09:12:00.000Z",
    "playUrl": "{{ORIGIN}}/api/public/stream?url=...",
    "downloadUrl": "{{ORIGIN}}/api/public/stream?url=...&dl=Title.mp4"
  } ],
  "page": 1, "perPage": 20, "total": 134, "lastPage": 7
} }
```

`latest: true` means an admin marked the title as Latest — show these first in a "Latest" row.

## 6.2 One uploaded title

**GET `/api/public/v1/{language}/title/{id}`**

One uploaded title plus its episodes (series), sorted by season and episode.

| Parameter | Where | Required | Description |
|---|---|---|---|
| language | path | yes | luo, luganda or teso. |
| id | path | yes | Title id from the list. |

```json
{ "ok": true, "data": { "...": "same fields as the list",
  "episodes": [ { "id": "e1", "season": 1, "episode": 1, "name": "Episode 1",
    "playUrl": "{{ORIGIN}}/api/public/stream?url=...", "downloadUrl": "..." } ] } }
```

# 7. Playing, downloading & subtitles

You never build these links yourself — copy them from the answers above. They all live on {{HOST}} and need no token:

| Link | Used for | Notes |
|---|---|---|
| `/api/public/movie?...` | English (MovieBox) play & download | Supports seeking (Range requests). `&dl=name.mp4` makes the browser download it. |
| `/api/public/stream?url=...` | Luganda VJ, Luo, Teso play & download | Supports seeking. `&dl=name.mp4` downloads. `&probe=1` returns `{ size, type }` without downloading. |
| `/api/public/subtitle?url=...` | MovieBox subtitles | Always returned as WebVTT (works in the HTML `<track>` tag). `&dl=` downloads. |

## 7.1 HTML player example

```html
<video controls playsinline width="100%" crossorigin="anonymous"
  src="{{ORIGIN}}/api/public/movie?subjectId=...&resourceId=...&res=1080">
  <track kind="subtitles" label="English" srclang="en" default
    src="{{ORIGIN}}/api/public/subtitle?url=..." />
</video>
```

## 7.2 Download button example

```html
<a href="{{ORIGIN}}/api/public/movie?...&dl=Avatar-1080p.mp4">Download 1080p (4.83 GB)</a>
```

Opening a `downloadUrl` hands the file to the browser's own download manager, exactly like the MOVIE MAX site.

# 8. Code examples

## 8.1 JavaScript (browser or Node)

```js
const API = "{{ORIGIN}}/api/public/v1";
const TOKEN = "YOUR_API_KEY"; // from {{ORIGIN}}/developer

async function api(path) {
  const res = await fetch(API + path, { headers: { Authorization: `Bearer ${TOKEN}` } });
  const body = await res.json();
  if (!body.ok) throw new Error(body.error);
  return body.data;
}

// Home page
const home = await api("/moviebox/home");
home.rows.forEach((row) => console.log(row.title, row.items.length));

// Search everything
const results = await api("/search?q=" + encodeURIComponent("john wick"));

// Play a movie: best non-promo quality
const movie = results.moviebox[0];
const sources = await api(`/moviebox/sources/${movie.id}`);
const best = sources.find((s) => !s.promo);
document.querySelector("video").src = best.playUrl;

// Play episode 3 of season 1
const ep = await api(`/moviebox/sources/${seriesId}?se=1&ep=3`);

// Luganda VJ movies, page 1
const lug = await api("/luganda/narabox?kind=movies&page=1");

// Luo uploads
const luo = await api("/luo?page=1");
```

## 8.2 PHP

```php
$api = "{{ORIGIN}}/api/public/v1";
$ctx = stream_context_create(["http" => ["header" => "Authorization: Bearer YOUR_API_KEY"]]);
$data = json_decode(file_get_contents("$api/moviebox/trending", false, $ctx), true);
foreach ($data["data"] as $item) {
  echo $item["title"] . " (" . $item["year"] . ")\n";
}
```

## 8.3 Python

```python
import requests

API = "{{ORIGIN}}/api/public/v1"
HEADERS = {"Authorization": "Bearer YOUR_API_KEY"}

trending = requests.get(f"{API}/moviebox/trending", headers=HEADERS).json()["data"]
for item in trending:
    print(item["title"], item["year"])
```

## 8.4 Typical screens and the calls behind them

| Screen on your other site | Call |
|---|---|
| Home page | `/moviebox/home` + `/moviebox/feed?page=0…` for endless scroll + `/luganda?page=1` and `/luo?page=1` rows |
| English movies / series | `/moviebox/home` rows, `/moviebox/trending` |
| Luganda page | `/luganda/catalog` (filter by VJ/genre yourself) + `/luganda?page=1` |
| Luo page / Teso page | `/luo?page=1` / `/teso?page=1` |
| Search page | `/search?q=` |
| Title page | `/moviebox/title/{id}` + `/moviebox/related/{id}` (English) or the Luganda/Luo detail endpoint |
| Watch page | `/moviebox/sources/{id}?se=&ep=` → `playUrl` + `subtitles` |

# 9. Limits & good practice

- **Caching:** answers can be cached (home/search 5 min, titles 10 min, uploads 2 min, sources 20 s). Cache on your side too and avoid calling on every keystroke — wait until the user stops typing.
- **Sources:** fetch `/moviebox/sources` when the user presses Play, not for every poster.
- **Uploads (Luo/Luganda/Teso):** these come from the MOVIE MAX database, which has a free daily read limit. The API keeps the last good copy, but if the limit is reached before any copy exists, the endpoint returns an error until the limit resets.
- **Images:** poster and backdrop links point to the providers' image servers and can be used directly in `<img>` tags.
- **Not included:** sign-in, subscriptions, payments, likes and admin actions stay on MOVIE MAX and are not part of this API.
