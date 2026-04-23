import i18n from "./index";

function locale() {
  return i18n.resolvedLanguage ?? "pt-BR";
}

export function formatDate(value: Date) {
  return new Intl.DateTimeFormat(locale(), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(locale(), options).format(value);
}
