/** Intake questionnaire options — DB values are English snake_case; labels are Hebrew UI. */

export type AgeRange =
  | 'under_18'
  | '18_24'
  | '25_34'
  | '35_44'
  | '45_54'
  | '55_plus';

export type ExperienceLevel =
  | 'first_steps'
  | 'beginner'
  | 'intermediate'
  | 'advanced';

export type TradingFocus = 'day_trading' | 'swing' | 'long_term';

export type TradingPlatform =
  | 'bank'
  | 'interactive_brokers'
  | 'tradestation'
  | 'colmex'
  | 'other';

export type PortfolioSize =
  | 'under_10k'
  | '10k_50k'
  | '50k_100k'
  | 'over_100k';

export type OnboardingIntroData = {
  /** גיל מספרי - החדש והמועדף */
  age?: number | null;
  /** @deprecated - טווח גיל מרשימה, נשאר לתמיכה לאחור */
  age_range?: AgeRange | '';
  experience_level: ExperienceLevel | '';
  trading_focus: TradingFocus | '';
  /** Multi-select — legacy rows may still hold a single string */
  trading_platform: TradingPlatform[];
  /** Optional — may be empty string when skipped */
  portfolio_size: PortfolioSize | '';
};

export const AGE_RANGE_OPTIONS: { label: string; value: AgeRange }[] = [
  { label: 'מתחת ל-18', value: 'under_18' },
  { label: '18–24', value: '18_24' },
  { label: '25–34', value: '25_34' },
  { label: '35–44', value: '35_44' },
  { label: '45–54', value: '45_54' },
  { label: '55+', value: '55_plus' },
];

export const EXPERIENCE_LEVEL_OPTIONS: { label: string; value: ExperienceLevel }[] = [
  { label: 'עושה צעדים ראשונים', value: 'first_steps' },
  { label: 'סוחר מתחיל', value: 'beginner' },
  { label: 'סוחר בינוני', value: 'intermediate' },
  { label: 'סוחר מתקדם', value: 'advanced' },
];

export const TRADING_FOCUS_OPTIONS: { label: string; value: TradingFocus }[] = [
  { label: 'מסחר יומי', value: 'day_trading' },
  { label: 'מסחר סווינג', value: 'swing' },
  { label: 'השקעה לטווח ארוך', value: 'long_term' },
];

export const TRADING_PLATFORM_OPTIONS: { label: string; value: TradingPlatform }[] = [
  { label: 'בנק', value: 'bank' },
  { label: 'אינטראקטיב ברוקרס', value: 'interactive_brokers' },
  { label: 'טריידסטיישן', value: 'tradestation' },
  { label: 'קולמקס', value: 'colmex' },
  { label: 'אחר', value: 'other' },
];

export const PORTFOLIO_SIZE_OPTIONS: { label: string; value: PortfolioSize }[] = [
  { label: 'עד $10K', value: 'under_10k' },
  { label: 'בין $10K ל-$50K', value: '10k_50k' },
  { label: 'בין $50K ל-$100K', value: '50k_100k' },
  { label: 'מעל $100K', value: 'over_100k' },
];

function labelFor<T extends string>(
  options: { label: string; value: T }[],
  value: string | null | undefined
): string | null {
  if (!value) return null;
  return options.find((o) => o.value === value)?.label ?? value;
}

export function getAgeRangeLabel(value?: string | null) {
  return labelFor(AGE_RANGE_OPTIONS, value);
}

export function getExperienceLevelLabel(value?: string | null) {
  return labelFor(EXPERIENCE_LEVEL_OPTIONS, value);
}

export function getTradingFocusLabel(value?: string | null) {
  return labelFor(TRADING_FOCUS_OPTIONS, value);
}

export function getTradingPlatformLabel(value?: string | null) {
  return labelFor(TRADING_PLATFORM_OPTIONS, value);
}

/**
 * Normalize a trading_platform value to an array.
 * Accepts the current array shape plus legacy single-string / CSV rows.
 */
export function toTradingPlatformArray(value: unknown): TradingPlatform[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is TradingPlatform => typeof v === 'string' && v !== '');
  }
  if (typeof value === 'string' && value !== '') {
    return value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean) as TradingPlatform[];
  }
  return [];
}

/** Joined Hebrew labels for one or more platforms (null when nothing selected). */
export function getTradingPlatformLabels(value: unknown): string | null {
  const labels = toTradingPlatformArray(value)
    .map((v) => getTradingPlatformLabel(v))
    .filter((l): l is string => !!l);
  return labels.length ? labels.join(', ') : null;
}

export function getPortfolioSizeLabel(value?: string | null) {
  return labelFor(PORTFOLIO_SIZE_OPTIONS, value);
}

/** Field labels (Hebrew) for admin / profile display of intro_data keys. */
export const INTRO_DATA_FIELD_LABELS: Partial<Record<keyof OnboardingIntroData, string>> = {
  age: 'גיל',
  age_range: 'טווח גיל',
  experience_level: 'רמת ניסיון',
  trading_focus: 'סגנון מסחר',
  trading_platform: 'פלטפורמת מסחר',
  portfolio_size: 'גודל תיק',
};

export type IntroDataDisplayRow = {
  key: keyof OnboardingIntroData;
  fieldLabel: string;
  valueLabel: string;
};

/** Normalize raw JSONB into Hebrew label rows (skips empty / unknown empty values). */
export function formatIntroDataRows(
  raw: unknown
): IntroDataDisplayRow[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  const data = raw as Record<string, unknown>;

  const rows: IntroDataDisplayRow[] = [];

  // טיפול בגיל - מעדיף age מספרי על פני age_range
  if (typeof data.age === 'number' && data.age > 0) {
    const fieldLabel = INTRO_DATA_FIELD_LABELS.age;
    if (fieldLabel) {
      rows.push({
        key: 'age',
        fieldLabel,
        valueLabel: String(data.age),
      });
    }
  } else if (data.age_range && data.age_range !== '') {
    const valueLabel = getAgeRangeLabel(String(data.age_range));
    const fieldLabel = INTRO_DATA_FIELD_LABELS.age_range;
    if (valueLabel && fieldLabel) {
      rows.push({
        key: 'age_range',
        fieldLabel,
        valueLabel,
      });
    }
  }

  // שאר השדות
  const resolvers: {
    key: keyof OnboardingIntroData;
    getLabel: (v: unknown) => string | null;
  }[] = [
    { key: 'experience_level', getLabel: (v) => getExperienceLevelLabel(String(v)) },
    { key: 'trading_focus', getLabel: (v) => getTradingFocusLabel(String(v)) },
    { key: 'trading_platform', getLabel: getTradingPlatformLabels },
    { key: 'portfolio_size', getLabel: (v) => getPortfolioSizeLabel(String(v)) },
  ];

  for (const { key, getLabel } of resolvers) {
    const rawVal = data[key];
    if (rawVal == null || rawVal === '') continue;
    if (Array.isArray(rawVal) && rawVal.length === 0) continue;
    const valueLabel = getLabel(rawVal);
    const fieldLabel = INTRO_DATA_FIELD_LABELS[key];
    if (!valueLabel || !fieldLabel) continue;
    rows.push({
      key,
      fieldLabel,
      valueLabel,
    });
  }
  return rows;
}

export function hasIntroDataAnswers(raw: unknown): boolean {
  return formatIntroDataRows(raw).length > 0;
}

export function buildOnboardingIntroData(input: {
  age?: number | null;
  ageRange?: string | null;
  experienceLevel?: string | null;
  tradingFocus?: string | null;
  tradingPlatform?: string[] | string | null;
  portfolioSize?: string | null;
}): OnboardingIntroData {
  const result: OnboardingIntroData = {
    experience_level: (input.experienceLevel || '') as OnboardingIntroData['experience_level'],
    trading_focus: (input.tradingFocus || '') as OnboardingIntroData['trading_focus'],
    trading_platform: toTradingPlatformArray(input.tradingPlatform),
    portfolio_size: (input.portfolioSize || '') as OnboardingIntroData['portfolio_size'],
  };

  // מעדיף age מספרי על age_range
  if (typeof input.age === 'number' && input.age > 0) {
    result.age = input.age;
  } else if (input.ageRange) {
    result.age_range = input.ageRange as OnboardingIntroData['age_range'];
  }

  return result;
}

export function isOnboardingQuestionnaireComplete(data: {
  age?: number | null;
  ageRange?: string | null;
  experienceLevel?: string | null;
  tradingFocus?: string | null;
  tradingPlatform?: string[] | string | null;
}): boolean {
  const hasAge = (typeof data.age === 'number' && data.age > 0) || !!data.ageRange;
  return !!(
    hasAge &&
    data.experienceLevel &&
    data.tradingFocus &&
    toTradingPlatformArray(data.tradingPlatform).length > 0
  );
}
