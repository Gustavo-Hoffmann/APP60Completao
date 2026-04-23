/** ISO 3166-1 alpha-2 — fallback se `Intl.supportedValuesOf` não existir. */
const FALLBACK_REGIONS = [
  "BR",
  "PT",
  "ES",
  "FR",
  "DE",
  "IT",
  "GB",
  "IE",
  "NL",
  "BE",
  "CH",
  "AT",
  "PL",
  "CZ",
  "SE",
  "NO",
  "DK",
  "FI",
  "GR",
  "US",
  "CA",
  "MX",
  "AR",
  "CL",
  "CO",
  "PE",
  "UY",
  "PY",
  "BO",
  "VE",
  "EC",
  "CR",
  "PA",
  "AO",
  "MZ",
  "CV",
  "ST",
  "GW",
  "TL",
  "ZA",
  "IN",
  "CN",
  "JP",
  "KR",
  "AU",
  "NZ",
];

export type CountryOption = { code: string; label: string };

function regionCodesFromIntl(): string[] | null {
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
    if (typeof fn !== "function") return null;
    const raw = fn.call(Intl, "region");
    const two = raw.filter((c) => typeof c === "string" && /^[A-Z]{2}$/.test(c));
    return two.length ? Array.from(new Set(two)) : null;
  } catch {
    return null;
  }
}

/**
 * Opções para seletor de nacionalidade (código ISO2 + rótulo localizado).
 * `language` deve ser o locale do i18n (ex.: pt-BR, en-GB).
 */
export function getCountryOptions(language: string): CountryOption[] {
  const codes = regionCodesFromIntl() ?? FALLBACK_REGIONS;
  const loc = language.toLowerCase().startsWith("pt") ? "pt-BR" : "en-GB";
  const dn = new Intl.DisplayNames([loc, "en"], { type: "region" });

  const opts: CountryOption[] = Array.from(new Set(codes)).map((code) => ({
    code,
    label: `${dn.of(code) ?? code} (${code})`,
  }));

  opts.sort((a, b) => a.label.localeCompare(b.label, loc, { sensitivity: "base" }));

  const brIdx = opts.findIndex((o) => o.code === "BR");
  if (brIdx > 0) {
    const [br] = opts.splice(brIdx, 1);
    opts.unshift(br);
  }

  return opts;
}

export function countryLabel(language: string, code: string): string {
  const c = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return code;
  const loc = language.toLowerCase().startsWith("pt") ? "pt-BR" : "en-GB";
  const dn = new Intl.DisplayNames([loc, "en"], { type: "region" });
  return `${dn.of(c) ?? c} (${c})`;
}
