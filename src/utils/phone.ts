/**
 * WhatsApp sign-in numbers. People type local numbers ("012-233 9276"), so the
 * form shows a country code next to the field and we build the international
 * (E.164) number Supabase needs. Countries = where otp-hub may send codes
 * (its PLATFORMS.kbbox.countries); add both places together.
 */

export interface PhoneCountry {
  code: 'MY' | 'SG';
  dial: string;
  flag: string;
  name: string;
  /** Example local number for the input placeholder. */
  example: string;
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: 'MY', dial: '60', flag: '🇲🇾', name: 'Malaysia', example: '12-345 6789' },
  { code: 'SG', dial: '65', flag: '🇸🇬', name: 'Singapore', example: '9123 4567' },
];

export const DEFAULT_PHONE_COUNTRY = PHONE_COUNTRIES[0];

/**
 * "+60 12-233 9276" from what the user typed:
 * - a full number with "+" is kept as is ("+65 9123 4567");
 * - a number already starting with the country code is accepted ("60122339276");
 * - otherwise the local trunk 0 is dropped and the country code added ("0122339276").
 */
export function composePhone(country: PhoneCountry, input: string): string {
  const raw = input.trim();
  if (raw.startsWith('+')) return `+${raw.replace(/\D/g, '')}`;
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith(country.dial) && digits.length >= country.dial.length + 8) return `+${digits}`;
  return `+${country.dial}${digits.replace(/^0+/, '')}`;
}

/** Enough digits to be worth sending (local part of a mobile number). */
export function looksComplete(country: PhoneCountry, input: string): boolean {
  const e164 = composePhone(country, input);
  return e164.length - 1 >= 10 && e164.length - 1 <= 15;
}

/** "60122339276" / "+60122339276" -> "+60 12-233 9276"; other countries get light spacing. */
export function formatPhone(phone: string | null | undefined): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('60')) {
    const rest = digits.slice(2);
    const head = rest.slice(0, 2);
    const tail = rest.slice(2);
    if (tail.length === 7) return `+60 ${head}-${tail.slice(0, 3)} ${tail.slice(3)}`;
    if (tail.length === 8) return `+60 ${head}-${tail.slice(0, 4)} ${tail.slice(4)}`;
  }
  if (digits.startsWith('65') && digits.length === 10) return `+65 ${digits.slice(2, 6)} ${digits.slice(6)}`;
  return `+${digits}`;
}
