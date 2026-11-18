import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

const names = new Intl.DisplayNames(["en"], { type: "region" });
export const PHONE_COUNTRIES = getCountries().map((code) => ({
  code, name: names.of(code) ?? code, dial: getCountryCallingCode(code),
})).sort((a, b) => a.name.localeCompare(b.name));

export function phoneCountry(code?: string | null, phone?: string | null) {
  const selected = PHONE_COUNTRIES.find((c) => c.code === code?.toUpperCase());
  if (selected) return selected;
  if (!phone) return null;
  const international = phone.startsWith("+") ? phone : `+${phone.replace(/\D/g, "")}`;
  const parsed = parsePhoneNumberFromString(international);
  return PHONE_COUNTRIES.find((c) => c.code === parsed?.country) ?? null;
}

export function accountPhone(input: string, code: CountryCode) {
  const parsed = parsePhoneNumberFromString(input, code);
  if (!parsed?.isPossible() || parsed.country !== code) return null;
  return parsed.number;
}