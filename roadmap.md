# Roadmap
- [ ] Limit dashboard to assigned main/team admins, redirect everyone else home, and remove admin claiming and automatic promotion.
- [x] Switch upload service, tune parallel transfers, preserve upload drafts across navigation, and add a corner progress window with View/Edit and publishing; signing works and continuity tests pass.
- [ ] Verify a real admin upload, navigation, and publication end-to-end (blocked: no authenticated Firebase admin session available).
- [x] Add searchable signup country flags and admin country display; match Latest and home cover VJ colours to VJ pages. Country selection and images checked at desktop/mobile, seven tests passed.
- [ ] Verify signup country save and admin readback with an authenticated account (blocked: no signed-in Firebase account available).

- [x] Give Download app a holder, hide it after install/reload, restore original Subscribe, and append MovieBox infinite scrolling; real feed grew from 18 to 123 titles, 320px header checked.

- [x] Add Narabox/MovieBox admin latest selections with VJ/ENG tags on home; selection rules tested.
- [ ] Verify admin latest save and home readback (blocked: no signed-in Firebase admin session; access check remains pending).
- [x] Add manifest-only browser app installation and fit all floating-header controls at 320/375/390/768px; prompt handler tested with a simulated browser event.
- [ ] Verify actual browser installation after publishing (blocked: unpublished site; Apple browsers do not expose a direct installation prompt).

- [x] Switch all payments and keepalive requests to payment.nexusplatformafrica.workers.dev.
- [x] Movie relay address editable in admin Settings (tested before saving).
- [ ] Host the relay where MovieBox's movie file server allows it (Railway gets 426 Forbidden) — waiting on owner.
- [ ] Fix MovieBox playback failing on deployed sites; verify real movie and episode media delivery and player requests.
- [ ] Uploaded movies stopped on luofilm.site (blocked: domain currently has no address in Cloudflare DNS; needs user to reattach the domain and redeploy).

- [ ] Reduce timeline seek delay while retaining the reference site's ArtPlayer and exact full MP4 files; measure byte-range response behavior.
- [x] Add the current MovieBox website's exact scrolling home feed after all existing sections; verified real continuation pages and existing named watch links.

- [x] Use movie-name watch URLs and canonical links; verified legacy Tulsa King link, direct reload, episode selection, and home links. Verified seeking and quality switches retain playback/fullscreen with a browser-decodable test video.

- [x] Correct MovieBox source Referer, exact-title selection, subtitle lookup, and untruncated/resumable delivery; verified six real files and complete John Wick/Terminal List downloads with decoded pictures.
- [ ] Verify MovieBox playback and download clicks with an active member on the hosted site (blocked: no signed-in Firebase member session; hosted test endpoint returns 401; sandbox Chromium lacks H.264 playback).

- [x] Mix Luganda uploads and Narabox movies/series newest first in one grid, with VJ tags at the top of posters.
- [x] Luganda: load the full catalog at once (no Load more), open series on their first playable episode, hide empty ones, remove tutorial banner.

- [x] Add Narabox movies and series alongside Luganda uploads, compact all movie grids, and remove 4KHDHub/Dramachi/Addons discovery links; verify real catalog pagination, filtering, details and phone layout (some upstream episodes have no video URL).

- [ ] Verify and display the actual MovieBox web API sections, including Nollywood, and align catalog playback with the website API without TV/app substitutes.

- [x] Update every WhatsApp channel link, redesign its floating banner with Movie Max logo and varied movie imagery without VJ labels, and provide the Cloudflare deployment configuration checklist.

- [x] Keep the sidebar flat against the left wall; round only the outward-facing curves and preserve the animated gradient.
- [ ] Update Movie Max public descriptions and sharing image; check sitemap index and every sitemap.
- [ ] Restore available subtitles in the download floating window and verify downloads.

- [x] Keep MovieBox web home rows visible through intermittent upstream failures; make sidebar inset and rounded without clipping page content.
- [x] Restore the original site font except on MOVIEMAX, improve sidebar icon contrast with the five chosen icons, and align the content grid to the sidebar.
- [x] Remove every legacy DASH and mobile-source playback fallback.
- [x] Make direct TV full-file downloads the only catalog download path.
- [x] Fix watch-page hydration mismatch.
- [x] Verify source lookup, playback relay, download response, typecheck, and watch page.
- [x] Replace whole-file buffering with validated, resumable TV range downloads.
- [x] Store download progress and movie/episode/subtitle metadata for safe resume.
- [ ] Speed up full-movie downloads without breaking pause, resume, refresh, or signed-link recovery.
- [ ] Add secure referral tracking and repeatable rewards for both users.
- [ ] Correct device allowances, including existing yearly subscriptions saved as one device.
- [x] Expand sitemap coverage for the verified public site URL.
- [x] Replace the referral artwork with a natural, crisp photo and preload it before showing the banner.
- [x] Add privacy-safe signed-in activity tracking and an admin activity view with user name and phone when available.
- [x] Preserve the current sitemap index and add separate series and animation discovery files.
- [x] Whop: new key, find company id, embed Whop native checkout (card/Google/Apple)
- [x] Fix hosted-site crash ("This page didn't load") caused by the QR code library.
- [x] Fix provider downloads saving "file not available" (dead mirrors) and Moviebox/subtitle downloads on the hosted site.
- [x] Add live PayPal checkout (membership modal + pay page); fix Whop embedded form receiving a URL instead of a session id.
- [x] Whop live payments: WHOP_API_KEY, WHOP_COMPANY_ID and SITE_URL saved in this project.
- [ ] Admin uploads via r2upload backend (token kept in server code).
- [x] Show an icon-only desktop sidebar and put the website name in the floating navigation.
- [x] Music page (carousel, 2-per-row grid, artist onboarding, uploads), artist profile with About/Musics/Wallet and gated withdrawals, admin TV channels + channels page.
- [x] Music page: slower hero (9s), paid UGX 1,000/week artist hero featuring with renew, admin music-hero tab, public /artist pages, logo fallback covers, AUDIO/VIDEO tags, custom music player.
- [x] Admin Artists tab: block/unblock, delete with all content, feature any song on the music hero free; blocked artists hidden from public pages.
- [x] SEO: music + channels sitemaps (artists, songs, TV channels) added to index and robots; MOVIEMAX logo as favicon/apple icon/share image; mobile top bar without providers, full Subscribe button.

- [x] Switch payments to payment.bonto.run and keep it awake (3s pings from open pages).
- [x] Fix payment-failed popup reappearing after it is closed.
- [x] Music page: show Ugandan songs from the open Audius platform alongside uploads.
- [x] Music page: full songs from top Ugandan artists (UgMuziki) with Trending row and artist filters; Audius songs after.
- [x] Music: real artist photos + artist pages (songs + videos), real trending now, new this month, music videos.
- [x] Live TV player plays .m3u8, .ts/.flv, .mpd and .mp4 links with automatic format fallback.

- [x] Fix deploy failure: removed Worker cron trigger (free Cloudflare plan limit of 5 crons per account).
- [ ] MovieBox playback on luofilm.site — blocked: movie file server refuses Railway and Cloudflare networks; relay must be hosted on another network (e.g. Google Cloud Run), then saved in Settings → Movie relay.

## Developer docs page
- [x] /doc page showing the developer API guide with the current domain; download as PDF, DOCX, DOC, MD
- [x] Admin creates one developer API token in Settings; /api/public/v1 requires it

## Developer platform
- [ ] Paid developer plans (monthly/yearly + custom contact) bought with all payment methods
- [ ] Developer dashboard: keys only with paid plan, key limits, usage
- [ ] API enforces per-key monthly quota + per-second rate limit (Firestore); admin token unlimited
- [ ] /doc redesign: big sidebar, page-by-page with next/prev, light/dark theme, side AI chat (+ open in ChatGPT/Claude/Gemini)
- [ ] Header: Dashboard button before profile avatar

- [x] Card button sized like PayPal without the Whop name; developer plans at the top; fix developer-plan card checkout (30-char title); /doc assistant works on own deployments; outside agents open as links; coloured Dashboard and new Live TV header buttons.

- [x] Live TV button opens livetv.luofilm.site; floating MOVIE MAX TV banner (Watch now + Android app download) after the WhatsApp prompt.

## Admin dashboard upgrade (Nov 2026)
- [x] PayPal colours (gold/blue) for wallet balance, transactions and the Pay with card button.
- [x] Compact admin dashboard with new tools: Insights, Members (expiring/win-back), Reports (CSV), System health, quick search (Ctrl+K), today strip.
- [x] Balances for every payment service: mobile money (withdraw), Whop real balance + withdraw, PayPal balance + withdraw once PayPal approves payouts.
- [ ] Verify live pawaPay/Whop/PayPal balances, live transactions, refunds and a real payout signed in as admin (blocked: no signed-in Firebase admin session; PayPal needs Payouts/balance access approved).
- [x] Wallet shows only real provider data: real balances (no ledger estimates) and live transactions straight from Whop, PayPal and pawaPay (Relworx has no transaction list; its live balance is shown).
- [x] Confirm the Pay with card button change is only in the subscription popup / pay page (admin dashboard has none).
- [x] More special dashboard features: refunds from the dashboard, monthly revenue goal, who's online now, payment problem list.
