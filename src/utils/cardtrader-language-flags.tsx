import { Box, Stack } from "@mui/material";
import CN from "country-flag-icons/react/1x1/CN";
import CZ from "country-flag-icons/react/1x1/CZ";
import DE from "country-flag-icons/react/1x1/DE";
import DK from "country-flag-icons/react/1x1/DK";
import ES from "country-flag-icons/react/1x1/ES";
import FI from "country-flag-icons/react/1x1/FI";
import FR from "country-flag-icons/react/1x1/FR";
import GR from "country-flag-icons/react/1x1/GR";
import HU from "country-flag-icons/react/1x1/HU";
import ID from "country-flag-icons/react/1x1/ID";
import IL from "country-flag-icons/react/1x1/IL";
import IT from "country-flag-icons/react/1x1/IT";
import JP from "country-flag-icons/react/1x1/JP";
import KR from "country-flag-icons/react/1x1/KR";
import NL from "country-flag-icons/react/1x1/NL";
import NO from "country-flag-icons/react/1x1/NO";
import PL from "country-flag-icons/react/1x1/PL";
import PT from "country-flag-icons/react/1x1/PT";
import RO from "country-flag-icons/react/1x1/RO";
import RU from "country-flag-icons/react/1x1/RU";
import SA from "country-flag-icons/react/1x1/SA";
import SE from "country-flag-icons/react/1x1/SE";
import TH from "country-flag-icons/react/1x1/TH";
import TW from "country-flag-icons/react/1x1/TW";
import UA from "country-flag-icons/react/1x1/UA";
import US from "country-flag-icons/react/1x1/US";
import VN from "country-flag-icons/react/1x1/VN";
import type { ReactNode } from "react";

/** Idioma CardTrader → ISO 3166-1 alpha-2 (minúsculas). */
export const LANGUAGE_TO_ISO_COUNTRY: Record<string, string> = {
  en: "us",
  eng: "us",
  english: "us",
  es: "es",
  spa: "es",
  spanish: "es",
  español: "es",
  fr: "fr",
  fre: "fr",
  fra: "fr",
  french: "fr",
  de: "de",
  ger: "de",
  deu: "de",
  german: "de",
  it: "it",
  ita: "it",
  italian: "it",
  pt: "pt",
  por: "pt",
  portuguese: "pt",
  nl: "nl",
  dutch: "nl",
  pl: "pl",
  polish: "pl",
  ru: "ru",
  russian: "ru",
  ja: "jp",
  jp: "jp",
  jpn: "jp",
  japanese: "jp",
  ko: "kr",
  kr: "kr",
  kor: "kr",
  korean: "kr",
  zh: "cn",
  cn: "cn",
  "zh-cn": "cn",
  "zh-hans": "cn",
  chinese: "cn",
  "zh-tw": "tw",
  "zh-hant": "tw",
  zht: "tw",
  th: "th",
  id: "id",
  vi: "vn",
  he: "il",
  ar: "sa",
  sv: "se",
  no: "no",
  da: "dk",
  fi: "fi",
  cs: "cz",
  hu: "hu",
  ro: "ro",
  el: "gr",
  uk: "ua",
  ua: "ua",
};

type FlagSvg = typeof US;

const FLAG_BY_ISO: Record<string, FlagSvg> = {
  US,
  ES,
  FR,
  DE,
  IT,
  PT,
  NL,
  PL,
  RU,
  JP,
  KR,
  CN,
  TW,
  TH,
  ID,
  VN,
  IL,
  SA,
  SE,
  NO,
  DK,
  FI,
  CZ,
  HU,
  RO,
  GR,
  UA,
};

export function normalizeLanguageCode(raw: string): string {
  return raw.trim().toLowerCase().replace(/_/g, "-");
}

export function languageCountryIso(lang: string): string | null {
  const key = normalizeLanguageCode(lang);
  if (!key) return null;
  if (LANGUAGE_TO_ISO_COUNTRY[key]) return LANGUAGE_TO_ISO_COUNTRY[key];
  if (key.length === 2 && /^[a-z]{2}$/.test(key)) return key;
  return null;
}

/** Componente SVG de bandera (empaquetado, sin red). */
export function flagComponentForIso(iso: string): FlagSvg | null {
  const key = iso.trim().toUpperCase();
  if (!key) return null;
  return FLAG_BY_ISO[key] ?? null;
}

export function languageDisplayCode(lang: string): string {
  const key = normalizeLanguageCode(lang);
  if (key === "zh-cn" || key === "zh-hans") return "ZH";
  if (key === "zh-tw" || key === "zh-hant") return "TW";
  if (key === "japanese" || key === "japan" || key === "ja" || key === "jp") return "JP";
  if (key === "english" || key === "en") return "EN";
  if (key === "spanish" || key === "español" || key === "es") return "ES";
  if (key === "french" || key === "fr") return "FR";
  if (key === "german" || key === "de") return "DE";
  if (key === "italian" || key === "it") return "IT";
  if (key === "portuguese" || key === "pt") return "PT";
  if (key === "korean" || key === "ko" || key === "kr") return "KR";
  if (key === "chinese" || key === "zh" || key === "cn") return "ZH";
  if (key === "dutch" || key === "nl") return "NL";
  return key.length <= 3 ? key.toUpperCase() : key.slice(0, 2).toUpperCase();
}

function LanguageCodeBadge({ code, width }: { code: string; width: number }) {
  return (
    <Box
      component="span"
      title={code}
      sx={{
        width,
        height: width,
        borderRadius: "50%",
        bgcolor: "grey.300",
        color: "grey.800",
        fontSize: Math.max(8, Math.round(width * 0.45)),
        fontWeight: 700,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        lineHeight: 1,
      }}
    >
      {code.slice(0, 2)}
    </Box>
  );
}

type LanguageFlagIconProps = {
  lang: string;
  width?: number;
};

/** Bandera circular (SVG local vía country-flag-icons). */
export function LanguageFlagIcon({ lang, width = 20 }: LanguageFlagIconProps): ReactNode {
  const iso = languageCountryIso(lang);
  const code = languageDisplayCode(lang);
  const Flag = iso ? flagComponentForIso(iso) : null;

  if (!lang.trim()) return null;

  if (!Flag) {
    return <LanguageCodeBadge code={code} width={width} />;
  }

  return (
    <Box
      component="span"
      title={code}
      sx={{
        width,
        height: width,
        borderRadius: "50%",
        overflow: "hidden",
        display: "inline-flex",
        flexShrink: 0,
        lineHeight: 0,
        boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)",
      }}
    >
      <Flag style={{ display: "block", width: "100%", height: "100%" }} />
    </Box>
  );
}

/** @deprecated Usar LanguageFlagIcon */
export const FlagEmojiIcon = LanguageFlagIcon;

type LanguageFlagProps = {
  lang: string;
  showLabel?: boolean;
  flagWidth?: number;
};

export function LanguageFlag({
  lang,
  showLabel = true,
  flagWidth = 20,
}: LanguageFlagProps): ReactNode {
  const code = languageDisplayCode(lang);
  if (!lang.trim()) return "—";

  return (
    <Stack
      direction="row"
      spacing={0.5}
      alignItems="center"
      component="span"
      sx={{ display: "inline-flex", verticalAlign: "middle" }}
      title={code}
    >
      <LanguageFlagIcon lang={lang} width={flagWidth} />
      {showLabel ? (
        <Box
          component="span"
          sx={{
            fontSize: "0.75rem",
            fontWeight: 600,
            lineHeight: 1.2,
            fontFamily: "inherit",
          }}
        >
          {code}
        </Box>
      ) : null}
    </Stack>
  );
}

/** Contenido para label de Chip: bandera + código. */
export function LanguageChipLabel({
  lang,
  flagWidth = 18,
}: {
  lang: string;
  flagWidth?: number;
}): ReactNode {
  return (
    <Stack
      direction="row"
      spacing={0.5}
      alignItems="center"
      component="span"
      sx={{ py: 0.125 }}
    >
      <LanguageFlagIcon lang={lang} width={flagWidth} />
      <Box component="span" sx={{ fontWeight: 600, fontSize: "0.8125rem", lineHeight: 1 }}>
        {languageDisplayCode(lang)}
      </Box>
    </Stack>
  );
}
