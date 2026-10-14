jest.mock('@/lib/supabase', () => require('../testUtils/supabaseMock'));

import { normalizePhone } from '@/store/userStore';
import { composePhone, formatPhone, looksComplete, PHONE_COUNTRIES } from '@/utils/phone';

const MY = PHONE_COUNTRIES[0];
const SG = PHONE_COUNTRIES[1];

describe('normalizePhone', () => {
  it('strips spaces, dashes and brackets but keeps the leading +', () => {
    expect(normalizePhone(' +60 12-345 6789 ')).toBe('+60123456789');
    expect(normalizePhone('+1 (555) 123-4567')).toBe('+15551234567');
    expect(normalizePhone('60123456789')).toBe('60123456789');
  });
});

describe('composePhone', () => {
  it('turns local numbers into international ones', () => {
    expect(composePhone(MY, '012-233 9276')).toBe('+60122339276');
    expect(composePhone(MY, '12 233 9276')).toBe('+60122339276');
    expect(composePhone(MY, '011-2233 9276')).toBe('+601122339276');
    expect(composePhone(SG, '9123 4567')).toBe('+6591234567');
  });

  it('accepts numbers that already have a country code', () => {
    expect(composePhone(MY, '+60 12-233 9276')).toBe('+60122339276');
    expect(composePhone(MY, '60122339276')).toBe('+60122339276');
    expect(composePhone(MY, '+65 9123 4567')).toBe('+6591234567');
  });

  it('knows when a number is long enough to send', () => {
    expect(looksComplete(MY, '012')).toBe(false);
    expect(looksComplete(MY, '012-233 9276')).toBe(true);
  });
});

describe('formatPhone', () => {
  it('formats Malaysian and Singapore mobiles', () => {
    expect(formatPhone('60122339276')).toBe('+60 12-233 9276');
    expect(formatPhone('+601122339276')).toBe('+60 11-2233 9276');
    expect(formatPhone('6591234567')).toBe('+65 9123 4567');
    expect(formatPhone('15551234567')).toBe('+15551234567');
    expect(formatPhone(null)).toBe('');
  });
});
