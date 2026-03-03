import { calculateNetToPayer } from './net-to-payer';

describe('calculateNetToPayer', () => {
  it('calculates a stable half split for two participants', () => {
    expect(calculateNetToPayer(3.99, 2)).toBe(2);
    expect(calculateNetToPayer(9.99, 2)).toBe(5);
    expect(calculateNetToPayer(15, 2)).toBe(7.5);
  });

  it('calculates split for more than two participants', () => {
    expect(calculateNetToPayer(12, 3)).toBe(8);
    expect(calculateNetToPayer(12, 4)).toBe(9);
  });

  it('returns undefined for invalid input', () => {
    expect(calculateNetToPayer(0, 2)).toBeUndefined();
    expect(calculateNetToPayer(-5, 2)).toBeUndefined();
    expect(calculateNetToPayer(10, 1)).toBeUndefined();
    expect(calculateNetToPayer(Number.NaN, 2)).toBeUndefined();
  });
});
