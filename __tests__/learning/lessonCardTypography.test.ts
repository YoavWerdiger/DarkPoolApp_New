import { readFileSync } from 'fs';
import { join } from 'path';
import { APP_LAYOUT } from '../../components/ui/appLayout';

const lessonRowSrc = readFileSync(
  join(__dirname, '../../components/learning/LessonRow.tsx'),
  'utf8',
);
const courseCardSrc = readFileSync(
  join(__dirname, '../../components/learning/CourseCard.tsx'),
  'utf8',
);

describe('academy lesson card typography', () => {
  it('LessonRow uses card title/body tokens and title-to-body gap', () => {
    expect(lessonRowSrc).toContain('appCardTitleStyle');
    expect(lessonRowSrc).toContain('appCardBodyStyle');
    expect(lessonRowSrc).toContain('cardTitleToBodyGap');
    expect(lessonRowSrc).not.toContain('marginTop: T.spacing.xs');
  });

  it('CourseCard binds subtitle to cardTitleToSubtitleGap via appCardSubtitleStyle', () => {
    expect(courseCardSrc).toContain('appCardTitleStyle');
    expect(courseCardSrc).toContain('appCardSubtitleStyle');
    expect(APP_LAYOUT.cardTitleToSubtitleGap).toBe(2);
  });
});
