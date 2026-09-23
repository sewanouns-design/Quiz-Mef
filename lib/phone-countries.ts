export interface PhoneCountry {
  code: string;
  name: string;
  flag: string;
  maxLocalDigits: number;
  localPattern?: RegExp;
  placeholder: string;
  formatLocal?: (digits: string) => string;
}

function formatBenin(digits: string): string {
  const groups = [
    digits.slice(0, 2),
    digits.slice(2, 4),
    digits.slice(4, 6),
    digits.slice(6, 8),
    digits.slice(8, 10),
  ].filter(Boolean);
  return groups.join(" ");
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
  {
    code: "+229",
    name: "Bénin",
    flag: "🇧🇯",
    maxLocalDigits: 10,
    localPattern: /^01\d{8}$/,
    placeholder: "01 XX XX XX XX",
    formatLocal: formatBenin,
  },
  { code: "+228", name: "Togo", flag: "🇹🇬", maxLocalDigits: 8, placeholder: "9X XX XX XX" },
  {
    code: "+225",
    name: "Côte d'Ivoire",
    flag: "🇨🇮",
    maxLocalDigits: 10,
    placeholder: "XX XX XX XX XX",
  },
  { code: "+233", name: "Ghana", flag: "🇬🇭", maxLocalDigits: 9, placeholder: "XX XXX XXXX" },
  { code: "+234", name: "Nigeria", flag: "🇳🇬", maxLocalDigits: 10, placeholder: "XXX XXX XXXX" },
  { code: "+227", name: "Niger", flag: "🇳🇪", maxLocalDigits: 8, placeholder: "XX XX XX XX" },
  {
    code: "+226",
    name: "Burkina Faso",
    flag: "🇧🇫",
    maxLocalDigits: 8,
    placeholder: "XX XX XX XX",
  },
  { code: "+221", name: "Sénégal", flag: "🇸🇳", maxLocalDigits: 9, placeholder: "XX XXX XX XX" },
  { code: "+223", name: "Mali", flag: "🇲🇱", maxLocalDigits: 8, placeholder: "XX XX XX XX" },
  { code: "+243", name: "RD Congo", flag: "🇨🇩", maxLocalDigits: 9, placeholder: "XXX XXX XXX" },
  { code: "+237", name: "Cameroun", flag: "🇨🇲", maxLocalDigits: 9, placeholder: "6XX XXX XXX" },
  { code: "+241", name: "Gabon", flag: "🇬🇦", maxLocalDigits: 8, placeholder: "XX XX XX XX" },
  { code: "+33", name: "France", flag: "🇫🇷", maxLocalDigits: 9, placeholder: "X XX XX XX XX" },
  { code: "+32", name: "Belgique", flag: "🇧🇪", maxLocalDigits: 9, placeholder: "XXX XX XX XX" },
  {
    code: "+1",
    name: "États-Unis / Canada",
    flag: "🇺🇸",
    maxLocalDigits: 10,
    placeholder: "XXX XXX XXXX",
  },
];

export function splitPhoneValue(value: string): { country: PhoneCountry; local: string } {
  const trimmed = (value || "").trim();
  const sortedByCodeLength = [...PHONE_COUNTRIES].sort((a, b) => b.code.length - a.code.length);
  for (const country of sortedByCodeLength) {
    if (trimmed.startsWith(country.code)) {
      return { country, local: trimmed.slice(country.code.length).replace(/\D/g, "") };
    }
  }
  return { country: PHONE_COUNTRIES[0], local: trimmed.replace(/\D/g, "") };
}

export function isValidLocalNumber(country: PhoneCountry, local: string): boolean {
  if (!local) return true;
  if (country.localPattern) return country.localPattern.test(local);
  return local.length >= 6 && local.length <= country.maxLocalDigits;
}

export function isValidWhatsappValue(value: string): boolean {
  if (!value) return true;
  const { country, local } = splitPhoneValue(value);
  return isValidLocalNumber(country, local);
}
