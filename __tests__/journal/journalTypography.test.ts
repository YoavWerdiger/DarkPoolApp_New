import {
  JOURNAL_LAYOUT,
  JOURNAL_TYPE,
  journalCardMetricValueStyle,
  journalCardTitleStyle,
  journalPhysicalRightText,
  journalSectionTitleStyle,
  journalSectionSubtitleStyle,
  journalBodyTextStyle,
} from '../../screens/Journal/journalLayout';

describe('Journal typography matches shared APP_TYPE scale', () => {
  it('locks section / subtitle / body / caption numbers', () => {
    expect(JOURNAL_TYPE.sectionTitle).toEqual({
      fontSize: 22,
      fontWeight: '700',
      lineHeight: 28,
      letterSpacing: -0.42,
    });
    expect(JOURNAL_TYPE.sectionSubtitle).toEqual({
      fontSize: 15,
      lineHeight: 22,
      fontWeight: '400',
    });
    expect(JOURNAL_TYPE.body).toEqual({
      fontSize: 16,
      fontWeight: '400',
      lineHeight: 24,
    });
    expect(JOURNAL_TYPE.caption.fontSize).toBe(12);
    expect(JOURNAL_TYPE.caption2.fontSize).toBe(11);
  });

  it('uses the Explore LTR-box + textAlign right trick', () => {
    expect(journalPhysicalRightText.direction).toBe('ltr');
    expect(journalPhysicalRightText.textAlign).toBe('right');
    expect(journalPhysicalRightText.writingDirection).toBe('rtl');
    expect(journalSectionTitleStyle.fontSize).toBe(22);
    expect(journalSectionTitleStyle.fontWeight).toBe('700');
    expect(journalSectionSubtitleStyle.fontSize).toBe(15);
    expect(journalBodyTextStyle.fontSize).toBe(16);
    expect(journalBodyTextStyle.lineHeight).toBe(24);
  });

  it('exposes card KPI typography and spacing', () => {
    expect(journalCardTitleStyle.fontSize).toBe(17);
    expect(journalCardMetricValueStyle.fontSize).toBe(28);
    expect(JOURNAL_LAYOUT.cardMetricLabelToValueGap).toBe(4);
    expect(JOURNAL_LAYOUT.cardTitleToSubtitleGap).toBe(2);
  });
});
