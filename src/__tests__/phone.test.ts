jest.mock('@/lib/supabase', () => require('../testUtils/supabaseMock'));

import { normalizePhone } from '@/store/userStore';

describe('normalizePhone', () => {
  it('strips spaces, dashes and brackets but keeps the leading +', () => {
    expect(normalizePhone(' +60 12-345 6789 ')).toBe('+60123456789');
    expect(normalizePhone('+1 (555) 123-4567')).toBe('+15551234567');
    expect(normalizePhone('60123456789')).toBe('60123456789');
  });
});
