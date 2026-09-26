import {
  moverImpactReturnLine,
  moverImpactRow,
  moverImpactTextCol,
  moverImpactTicker,
  moverImpactValueLine,
} from '../../screens/Portfolios/utils/moverImpactAlign';

describe('moverImpactAlign — השפעה על התיק', () => {
  it('keeps the row RTL + row (no row-reverse double flip)', () => {
    expect(moverImpactRow.direction).toBe('rtl');
    expect(moverImpactRow.flexDirection).toBe('row');
    expect(moverImpactRow.justifyContent).toBe('flex-start');
  });

  it('puts ticker, price and return in one LTR box aligned to the physical right', () => {
    expect(moverImpactTextCol.direction).toBe('ltr');
    expect(moverImpactTextCol.alignItems).toBe('stretch');
    expect(moverImpactTicker.textAlign).toBe('right');
    expect(moverImpactTicker.writingDirection).toBe('ltr');
    expect(moverImpactValueLine.textAlign).toBe('right');
    expect(moverImpactValueLine.writingDirection).toBe('ltr');
    expect(moverImpactReturnLine.textAlign).toBe('right');
    expect(moverImpactReturnLine.direction).toBe('ltr');
  });
});
