# Local font assets

Fonts are served by the portfolio origin, with their SIL Open Font License files alongside them.

- Anton, regular 400; source: Google Fonts `ofl/anton`.
- JetBrains Mono, 400/500/700; source: Google Fonts `ofl/jetbrainsmono`.
- Plus Jakarta Sans, 400/500/600/700/800; source: Google Fonts `ofl/plusjakartasans`.

These fonts contain Latin text, punctuation, and arrows only. Chinese text uses the visitor's system sans (`--font-cjk` in `index.html`: PingFang SC, Microsoft YaHei, Noto Sans CJK SC…). Every font stack lists it before the generic family; otherwise Windows draws Chinese inside Latin-only faces with NSimSun, a Song serif.

A Chinese subset is not bundled: a fixed character list cannot cover CMS content, and characters outside it fell back to a second font in the same line.

Filenames include a SHA-256 prefix so immutable browser caching stays correct after font updates.
