import { readFileSync } from 'fs';
import { join } from 'path';
import { withHebrew } from '../helpers/withHebrew';

const feedSrc = withHebrew(readFileSync(
  join(__dirname, '../../screens/Tweets/TweetsFeed.tsx'),
  'utf8'
));

const toggleStart = feedSrc.indexOf('function FeedTabToggle');
const toggleEnd = feedSrc.indexOf('export default function TweetsFeed');
const toggleSrc = feedSrc.slice(toggleStart, toggleEnd);

describe('tweets feed tabs', () => {
  it('keeps For You first, then Following', () => {
    expect(feedSrc).toMatch(
      /const FEED_TABS[\s\S]*id:\s*'for_you'[\s\S]*id:\s*'following'/
    );
    expect(feedSrc).toMatch(/label:\s*'בשבילך'/);
    expect(feedSrc).toMatch(/label:\s*'במעקב'/);
  });

  it('is flat and fully transparent — no glass, card, or green tint', () => {
    // הטאבים עברו לרכיב המשותף SegmentedTabs (שקוף, קו תחתון לטאב פעיל, RTL) — לא סטייל מקומי
    expect(toggleSrc).toMatch(/<SegmentedTabs/);
    expect(toggleSrc).not.toMatch(/MarketsEmbedSwitcher/);
    expect(toggleSrc).not.toMatch(/MarketsSegmentedControl/);
    expect(toggleSrc).not.toMatch(/GlassChip/);
    expect(toggleSrc).not.toMatch(/UICard/);
    expect(toggleSrc).not.toMatch(/primary\.main/);
    // accessibilityRole="tab" נמצא בתוך SegmentedTabs
  });

  it('stays sticky above the list', () => {
    expect(feedSrc).not.toMatch(/ListHeaderComponent=\{/);
    expect(feedSrc.indexOf('<FeedTabToggle')).toBeLessThan(
      feedSrc.indexOf('<FlatList')
    );
  });

  it('leaves a small gap under the tabs before the list', () => {
    expect(toggleSrc).toMatch(/paddingBottom:\s*tokens\.spacing\.md/);
  });

  it('keeps feed-mode filter wiring', () => {
    expect(feedSrc).toMatch(/handleFeedModeChange/);
    expect(feedSrc).toMatch(/setFeedMode\(mode\)/);
    expect(feedSrc).toMatch(/useState<CommunityFeedMode>\('for_you'\)/);
  });
});
