# Local font assets

Fonts are served by the portfolio origin, with their SIL Open Font License files alongside them.

- Anton, regular 400; source: Google Fonts `ofl/anton`.
- JetBrains Mono, 400/500/700; source: Google Fonts `ofl/jetbrainsmono`.
- Plus Jakarta Sans, 400/500/600/700/800; source: Google Fonts `ofl/plusjakartasans`.
- Noto Sans SC, variable 400–900; source: Google Fonts `ofl/notosanssc`.

Latin fonts contain Latin text, punctuation, and arrows. The Chinese file contains 439 characters from the portfolio and current public CMS content. Its `unicode-range` permits new characters in CMS content to use the system font instead of downloading a full Chinese font. If the curated typography is required for new characters, regenerate the subset and update its range and hashed filename in `index.html`.

Filenames include a SHA-256 prefix so immutable browser caching stays correct after font updates.
