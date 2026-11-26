import { readFileSync } from 'fs';
import { join } from 'path';
import { HELP_SHEET_GOT_IT } from '../../components/ui/HelpSheet';

const src = readFileSync(join(__dirname, '../../components/ui/HelpSheet.tsx'), 'utf8');

describe('HelpSheet', () => {
  it('closes with הבנתי — a sheet, not a centered dialog', () => {
    expect(HELP_SHEET_GOT_IT).toBe('הבנתי');
  });

  it('puts title + body on the sheet glass — no nested UICard', () => {
    expect(src).not.toMatch(/UICard/);
    expect(src).toMatch(/appSheetTitleStyle/);
    expect(src).toMatch(/appBodyTextStyle/);
  });

  it('uses the glass SheetActionButton pill, not a solid filled Pressable', () => {
    // הוסר: HelpSheet עבר ל-UIButton primary לפי הטופו
    // הוסר: HelpSheet עבר ל-UIButton primary לפי הטופו
    expect(src).not.toMatch(/backgroundColor:\s*tokens\.colors\.background\.(cardSolid|primary)/);
  });
});
