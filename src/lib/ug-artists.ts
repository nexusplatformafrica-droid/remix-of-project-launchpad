/**
 * Top Ugandan artists: real YouTube channel, real profile photo, and how their name appears in song titles.
 * Channel IDs were looked up from each artist's official (most-subscribed) YouTube channel.
 */
export type TopArtist = {
  slug: string;
  name: string;
  match: RegExp;
  channelId: string;
  avatar: string;
  subscribers: string;
};

export const TOP_ARTISTS: TopArtist[] = [
  { slug: "sheebah", name: "Sheebah", match: /sheebah/i, channelId: "UCURlXQyzG15s9i7_nMdRE5Q", subscribers: "939K", avatar: "https://yt3.ggpht.com/7y5uYpgtXP28MYoXDUwY7_DGYc3IjY8yoAfAYEN8BJ8c80jK7qaOzT7iB92ADFGMwyRNyPGZrfU=s400-c-k-c0x00ffffff-no-rj" },
  { slug: "dax-vibez", name: "Dax Vibez", match: /dax+\s*vib/i, channelId: "UCdpKgmW8YiNy3ttHZORoW9w", subscribers: "99.4K", avatar: "https://yt3.ggpht.com/IgwfbI8s7LoUT-L8r-imEIiyEtYPDnzCGkZJmB2R1bQT03le95wGz2_k0xDFkMN7FMzXuE7Mvt8=s400-c-k-c0x00ffffff-no-rj" },
  { slug: "kapeke", name: "Kapeke", match: /kapeke/i, channelId: "UCHBV1p__N2LPEdpXhLa0x9Q", subscribers: "107K", avatar: "https://yt3.ggpht.com/9PXmRyNIwDqjHNvOdRHI8jcjkH5gCWhhl2DIyAawkadovSkrGlpkpODgrlzkU7jUDCbjIozhq4Y=s400-c-k-c0x00ffffff-no-rj" },
  { slug: "spice-diana", name: "Spice Diana", match: /spice\s*diana/i, channelId: "UCT0LQjFFUr8yq1wI-EeGJSg", subscribers: "732K", avatar: "https://yt3.ggpht.com/07bxze98DqofWZTeNucLFGSrgYW3mOnFvLYPrxLgKlUUqd4mAmSLEZpuYMWkZZgIvYp9_jbPmA=s400-c-k-c0x00ffffff-no-rj" },
  { slug: "elijah-kitaka", name: "Elijah Kitaka", match: /elijah\s*kitaka/i, channelId: "UCEABccYSjraBV3jHD6Dj6Xw", subscribers: "73.9K", avatar: "https://yt3.ggpht.com/1dB9Ec7_2BxlFnoAMfpO0vqIvzSuW9sZMRbPoUHk8oUZhXeQa6feLPzLEQ0Fc3SJabkq0bnPWQ=s400-c-k-c0x00ffffff-no-rj" },
  { slug: "david-lutalo", name: "David Lutalo", match: /david\s*lutalo/i, channelId: "UCuwRh793X16wkbmsubt4NMw", subscribers: "589K", avatar: "https://yt3.ggpht.com/H3JLTsIdbgsZQyQEBclFtNoKj4nRDWw8D6r136NNcwLrXLdBeK9P0GdTiQrCuIKpDttuwhN_Vw=s400-c-k-c0x00ffffff-no-rj" },
  { slug: "eddy-kenzo", name: "Eddy Kenzo", match: /eddy\s*kenzo/i, channelId: "UCxNKVc2pE3IDRge9dHEZGEw", subscribers: "2.92M", avatar: "https://yt3.ggpht.com/DdSP9Vl4b5kVRC-2lRrTC8V3LYVtnAOzm31wPd0rOCeRLv82OxCyeI3bBVkU4LQXXlZwNNh4fw=s400-c-k-c0x00ffffff-no-rj" },
  { slug: "azawi", name: "Azawi", match: /azawi/i, channelId: "UC8ZP6cKnFDw_cewhqxeKmaA", subscribers: "263K", avatar: "https://yt3.ggpht.com/5TDmszGssDY4LG77NMi0fpGmArr73JSvC3tUX7Os3EkGGGmYpcbN-JiBpUIogde1nsBG1bEXBsU=s400-c-k-c0x00ffffff-no-rj" },
  { slug: "fik-fameica", name: "Fik Fameica", match: /fik\s*fameica/i, channelId: "UCELuUleawzWkeScOLRiqM-Q", subscribers: "339K", avatar: "https://yt3.ggpht.com/4Ap8BPLv0sj9gbcaFjI-6uTO3rJiSaowBybeuOXIbQebd_hl3bwMtDIoOKkf64kbptNxJZQeHw=s400-c-k-c0x00ffffff-no-rj" },
  { slug: "john-blaq", name: "John Blaq", match: /john\s*blaq/i, channelId: "UCG6wFeHQL7H1JjRA40OR8eQ", subscribers: "263K", avatar: "https://yt3.ggpht.com/fxqhVWr63JjrDPjeehoypjGG8kn45Bghe8iOVToJuuE0yqCZgwnUUrRWGyo75pmIKf17UAInnQ=s400-c-k-c0x00ffffff-no-rj" },
  { slug: "vinka", name: "Vinka", match: /vinka/i, channelId: "UC9MLTviaQT2s9CQlO7Sn81A", subscribers: "256K", avatar: "https://yt3.ggpht.com/cxmw8f8rtDwXzEEIHrSHhP9CQVodIk1amXVvQhsxSSr6qKEaqmX2rwAp2EdYwLPZemkO66sKKg=s400-c-k-c0x00ffffff-no-rj" },
  { slug: "alien-skin", name: "Alien Skin", match: /alien\s*skin/i, channelId: "UCcK3tLhXrDCDXXTFjcT_pTA", subscribers: "262K", avatar: "https://yt3.ggpht.com/XCFvWL0HszGUR2NWhgP4uMRdpWf1cNS-4uZvFRsG_XMng_Y4GmlMJhsEfQ8l-yzc79Q804-2PEg=s400-c-k-c0x00ffffff-no-rj" },
  { slug: "winnie-nwagi", name: "Winnie Nwagi", match: /winnie\s*nwagi/i, channelId: "UCf4_6UkrgV_7nTxg7y7ZoRw", subscribers: "145K", avatar: "https://yt3.ggpht.com/NzwSByASBlm7rTfVnmNxqiyg68nBvBShXcsRhiE2lhXl1Xz192DEHApb6SHeN-9VQylX0SIa=s400-c-k-c0x00ffffff-no-rj" },
  { slug: "jose-chameleone", name: "Jose Chameleone", match: /chameleone/i, channelId: "UCffgq5Y_cjQWYEZCo0yjkFg", subscribers: "888K", avatar: "https://yt3.ggpht.com/JJl11hkLbx9Ww5hjF6aeNjg45hpFRgvcbtOVePXS21O_U6Fs2EAsq_lW_CIy9LZTY1kJ5TUf=s400-c-k-c0x00ffffff-no-rj" },
  { slug: "bebe-cool", name: "Bebe Cool", match: /bebe\s*cool/i, channelId: "UC07yH5hF8K-kNn30YOl220A", subscribers: "426K", avatar: "https://yt3.ggpht.com/XTVCR2Bp7SDEtwkev_TogIa3uTw6AjOPJlpkSj-MfP1s-SUUtER1nfidv-JORFodRjrgQ4U8iQ=s400-c-k-c0x00ffffff-no-rj" },
  { slug: "pallaso", name: "Pallaso", match: /pallaso/i, channelId: "UCfXn-oGnIzIxb49xG6n2CyA", subscribers: "557K", avatar: "https://yt3.ggpht.com/S-8YiGv_D7-NR_GygrsWQavoF8xEnaHYajEosHxcUYY6Aq8eYBy-89MDDUnrJd2NtZctWHyZ1iQ=s400-c-k-c0x00ffffff-no-rj" },
  { slug: "rema-namakula", name: "Rema Namakula", match: /rema\s*namakula/i, channelId: "UCmnuC2jgsyGso0hS5HPtCEw", subscribers: "596K", avatar: "https://yt3.ggpht.com/YnZYrTPENP05gk4xzr4PO7jwsD_M3QGk1SNz9GPC4HjAr2_-jE6xcGfSDy-pAfcfQQlU9N6xSXc=s400-c-k-c0x00ffffff-no-rj" },
  { slug: "karole-kasita", name: "Karole Kasita", match: /karole\s*kasita/i, channelId: "UCdS2Fui_gD8aeLptuUZ514g", subscribers: "172K", avatar: "https://yt3.ggpht.com/ytc/AIdro_laG79UpIEmkppuysITvaCYJzv2eoqDRslb2OsFQ1WPtf8=s400-c-k-c0x00ffffff-no-rj" },
  { slug: "feffe-bussi", name: "Feffe Bussi", match: /f+e+f+e\s*bussi/i, channelId: "UCaRZZS9tC5bFjZ6oNuTsbww", subscribers: "164K", avatar: "https://yt3.ggpht.com/wrOqre5BvJ14dQGmbFcMDn0UQrlIV4FK5D3P-Ik4gi37T59q-GYRh92C3A47mfpu8aaffwdOeQ=s400-c-k-c0x00ffffff-no-rj" },
  { slug: "lydia-jazmine", name: "Lydia Jazmine", match: /lydia\s*jazmine/i, channelId: "UCmmveWggQR6S9p504L96Tqw", subscribers: "247K", avatar: "https://yt3.ggpht.com/zU85fXfKf2QPCFLzYdHMlABUeKDlD1JYiQ-3kPQdph1nluKYgXuTMJmRg-QF4kaUPtfZUI0Z7g=s400-c-k-c0x00ffffff-no-rj" },
  { slug: "king-saha", name: "King Saha", match: /king\s*saha/i, channelId: "UCGVj_9bh-fcMUOpacXptq8w", subscribers: "328K", avatar: "https://yt3.ggpht.com/Ucks-YctWQwP-udyVLQDX2bzZQ6r5Wc-GJQkWaF26xPYMm8WrbJG5eRfETzDGh14qKZoehVkp-8=s400-c-k-c0x00ffffff-no-rj" },
  { slug: "chosen-becky", name: "Chosen Becky", match: /chosen\s*becky/i, channelId: "UC7F8j67iZ_uRqeJeMbF6SGA", subscribers: "249K", avatar: "https://yt3.ggpht.com/ZV86HKMOrsfuoh66itmEhNt76J9LV5eUuz7fJs_vJez0KrBHkGeDsCHErPsBLUCbsKTl65kX4w=s400-c-k-c0x00ffffff-no-rj" },
  { slug: "vyroota", name: "Vyroota", match: /vyroota/i, channelId: "UCd6K9bQ0AF9U1Wwmo5bY9-g", subscribers: "168K", avatar: "https://yt3.ggpht.com/x76YA4d6RG_xO9rGXsMyS3xrWafmu2-9DtbeIUrHyooauZ4xs2j8U5kPVftySIeXcAYaXpENKw=s400-c-k-c0x00ffffff-no-rj" },
  { slug: "gravity-omutujju", name: "Gravity Omutujju", match: /gravity/i, channelId: "UCugdDigC_MdbHulqsdmTrDA", subscribers: "159K", avatar: "https://yt3.ggpht.com/hElEwoVlr1GCS6tr0hzGVzeaOyZbVe852n6V10FJHjjXhRTU2D5iLnqwU7YsJBDxep8yCvumzA=s400-c-k-c0x00ffffff-no-rj" },
  { slug: "b2c", name: "B2C", match: /\bb2c\b/i, channelId: "UCfBRX2mnGknh9pbWYDN44-w", subscribers: "307K", avatar: "https://yt3.ggpht.com/V26hf5jQz_G0odwwumq8fUOCSVlGeegVZxJkmMGabVZwsmXZsYZVMPwoXNHGAO8kwDV8V77IQuc=s400-c-k-c0x00ffffff-no-rj" },
  { slug: "joshua-baraka", name: "Joshua Baraka", match: /joshua\s*baraka/i, channelId: "UCra5ZDZqHRQgmE4C3Wuz-Zg", subscribers: "298K", avatar: "https://yt3.ggpht.com/NxcqMkohobFbvFzoE-yuVF8dyJT5hOtHhkYofOSzTj1PsP1gR3QNi4jEJnTkPuulxtsynC2LwGs=s400-c-k-c0x00ffffff-no-rj" },
  { slug: "ykee-benda", name: "Ykee Benda", match: /ykee\s*benda/i, channelId: "UCpE_WJmnCnpnxJcwT506TpA", subscribers: "340K", avatar: "https://yt3.ggpht.com/XrvcxPBcXl2dr7VZW6UfwJaShC7Zb52WGBtYrMK3SzcCerThSf0TOAjR6KWYOtCpAt8aAyuF=s400-c-k-c0x00ffffff-no-rj" },
  { slug: "mudra-d-viral", name: "Mudra D Viral", match: /mudra/i, channelId: "UC3KBIl7Qhk7pSQ48GfrtgWA", subscribers: "190K", avatar: "https://yt3.ggpht.com/9-YUQTM9UtCYLXRxqi-ks5qHZckuvfvzHbCz-6aVp5I609Ul7-r-Mtr6kpsVzFnOvSGJz67A=s400-c-k-c0x00ffffff-no-rj" },
  { slug: "liam-voice", name: "Liam Voice", match: /liam\s*voice/i, channelId: "UCLOchMt7pG7zL2nN4dYfXgA", subscribers: "143K", avatar: "https://yt3.ggpht.com/rHGYU8LLqFutFYe08m4o0t5FJL7L7sK-atHhj0vQwWtMZ7mNnfFfQrx_lMOLag1ca65pW69SmQ=s400-c-k-c0x00ffffff-no-rj" },
  { slug: "mikie-wine", name: "Mikie Wine", match: /mikie\s*wine/i, channelId: "UC761OgEAUe2Xs9G8m244X8g", subscribers: "39.3K", avatar: "https://yt3.ggpht.com/4TNiriOfXpXrEV8wlr8E8R5R2vUDhtZQvo8P9f34y77cWT0MUvBOWzMVyJdEIhpgSiF7pY1BGA=s400-c-k-c0x00ffffff-no-rj" },
  { slug: "bobi-wine", name: "Bobi Wine", match: /bobi\s*wine/i, channelId: "UCyewXlyC4F7AAjrnbLvjFOw", subscribers: "490K", avatar: "https://yt3.ggpht.com/ytc/AIdro_k6QY6KABuLUZrxLUqG9dVNysNSMLRg1nN3LkHZ9GI1YWY=s400-c-k-c0x00ffffff-no-rj" },
  { slug: "daddy-andre", name: "Daddy Andre", match: /daddy\s*andre/i, channelId: "UCVirkmvT4sTS5we-wJkbIjw", subscribers: "303K", avatar: "https://yt3.ggpht.com/1s4PT56x7mFmWJbp9qyqGbzNrltJELkn5YN7ES7hKWmPsYEKr2QXEHHX7_Ias6MBk_tobGg=s400-c-k-c0x00ffffff-no-rj" },
  { slug: "ziza-bafana", name: "Ziza Bafana", match: /ziza\s*bafana/i, channelId: "UCrJckze79UTTFX2T1F_AKhw", subscribers: "161K", avatar: "https://yt3.ggpht.com/5-8h-lyfnqHpWgWwmCqEJjmM6xYotQpY0YjhyXvOoxM8rqZH5cJCySNOlyOBrHmaeuwk5kZU=s400-c-k-c0x00ffffff-no-rj" },
  { slug: "geosteady", name: "Geosteady", match: /geosteady/i, channelId: "UCPiretti8qKVskv5a_T9vtA", subscribers: "157K", avatar: "https://yt3.ggpht.com/38X3FcRhey-2mLgwG2zqXUMCd2CMP7LazAj56_Sctc4h5Pnq6hAZLktoEsF24bT2ugwG91giDLE=s400-c-k-c0x00ffffff-no-rj" },
  { slug: "cindy-sanyu", name: "Cindy Sanyu", match: /cindy\s*sanyu|\bcindy\b/i, channelId: "UCy28fcjOAD027nyICkUifMg", subscribers: "141K", avatar: "https://yt3.ggpht.com/XBmsEzmDQSsk-pSpjWIdUgQn4lAYirSy-aKA7pfg268s7JVNBc8hbZC9wuGZePdtXtuEw8CrclQ=s400-c-k-c0x00ffffff-no-rj" },
  { slug: "nina-roz", name: "Nina Roz", match: /nina\s*roz/i, channelId: "UCEIuAefA-HaWqbZPCdDx5aw", subscribers: "114K", avatar: "https://yt3.ggpht.com/zi8W-7GDfs0bppijRqaib1FthJ6wGvRqoMTjIBCiAHwRlb0a_KohhM_2Je46wrMaVxu044njx3Y=s400-c-k-c0x00ffffff-no-rj" },
  { slug: "ava-peace", name: "Ava Peace", match: /ava\s*peace/i, channelId: "UC7X59SlyxZuNqzNzk_wLTgw", subscribers: "126K", avatar: "https://yt3.ggpht.com/ErVHhcMo0c3CokFb_Lg6dxRSnFVftDRbLj4klMgBwo9JUfMberbExKFYHxr091aLim7k4YkLfA=s400-c-k-c0x00ffffff-no-rj" },
  { slug: "gloria-bugie", name: "Gloria Bugie", match: /gloria\s*bugie/i, channelId: "UCa_PPTVlTPNFw__m4MuVNxw", subscribers: "121K", avatar: "https://yt3.ggpht.com/tgmStHFonM9BC3FEAzrv88wXvC-JrIlYSVHQCqOrIYrv1QfdmYRI_-FdNFPjYiesO0x6N8TdYw=s400-c-k-c0x00ffffff-no-rj" },
  { slug: "kataleya-and-kandle", name: "Kataleya & Kandle", match: /kataleya/i, channelId: "UCTRcVOSJYCvbZ3uZLvc1kAA", subscribers: "62.6K", avatar: "https://yt3.ggpht.com/A3Qtwp9s83E_UHjfRwqRlDfSNFlBlMUZaPXhHSt3Ar_J0SoNEIzEts0YKxHlb3sDvuKUARBzYg=s400-c-k-c0x00ffffff-no-rj" },
  { slug: "rickman-manrick", name: "Rickman Manrick", match: /rickman/i, channelId: "UCG-Bqq5zTBGMWkCRZpGequQ", subscribers: "62.1K", avatar: "https://yt3.ggpht.com/ZN8_iJF6YAAVe9brb2Ag01sxZMmBFnOMUsMP7_ETmTpCgUOzOZJ8nSnKDLrswZGrRpVf_gxkBQ=s400-c-k-c0x00ffffff-no-rj" },
  { slug: "fik-gaza", name: "Fik Gaza", match: /fik\s*gaza/i, channelId: "UCcxr0VlhaDo7D-EC-ZmQ-ew", subscribers: "36K", avatar: "https://yt3.ggpht.com/12A7TlBGr3mK4fuDXzcymh0JYlhrtZt6IeMI3Wsln72rpfoYy6udrUy_LgItO_m1SFfOBxXE=s400-c-k-c0x00ffffff-no-rj" },
];

export const artistBySlug = (slug: string) => TOP_ARTISTS.find((a) => a.slug === slug);
