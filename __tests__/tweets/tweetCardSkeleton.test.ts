import { readFileSync } from 'fs';
import { join } from 'path';
import {
  TWEET_CARD_SKELETON_LAYOUT,
  tweetCardSkeletonActionsRow,
  tweetCardSkeletonHeaderRow,
  tweetCardSkeletonTextBlock,
} from '../../screens/Tweets/TweetCardSkeleton';

const feedSrc = readFileSync(
  join(__dirname, '../../screens/Tweets/TweetsFeed.tsx'),
  'utf8'
);

const postCardStart = feedSrc.indexOf('function PostCard(');
const postCardEnd = feedSrc.indexOf('function FeedTabToggle');
const postCardSrc = feedSrc.slice(postCardStart, postCardEnd);

describe('TweetCardSkeleton RTL — matches live PostCard', () => {
  it('uses LTR Yoga + row-reverse (avatar first = physical right)', () => {
    expect(TWEET_CARD_SKELETON_LAYOUT.headerRowDirection).toBe('row-reverse');
    expect(TWEET_CARD_SKELETON_LAYOUT.headerDirection).toBeUndefined();
    expect(TWEET_CARD_SKELETON_LAYOUT.avatarFirst).toBe(true);
    expect(tweetCardSkeletonHeaderRow.flexDirection).toBe('row-reverse');
    expect(tweetCardSkeletonHeaderRow.direction).toBeUndefined();
  });

  it('does not double-flip rtl + row-reverse', () => {
    expect(tweetCardSkeletonHeaderRow.flexDirection).toBe('row-reverse');
    expect(tweetCardSkeletonHeaderRow.direction).not.toBe('rtl');
    expect(tweetCardSkeletonTextBlock.alignItems).toBe('flex-end');
    expect(TWEET_CARD_SKELETON_LAYOUT.textAlignItems).toBe('flex-end');
  });

  it('keeps actions in the same LTR row as the live card', () => {
    expect(tweetCardSkeletonActionsRow.flexDirection).toBe('row');
    expect(TWEET_CARD_SKELETON_LAYOUT.actionsRowDirection).toBe('row');
  });

  it('matches the live PostCard header (row-reverse, no direction:rtl)', () => {
    const headerStart = postCardSrc.indexOf("flexDirection: 'row-reverse'");
    const headerSrc = postCardSrc.slice(headerStart, headerStart + 220);
    expect(headerSrc).toMatch(/flexDirection:\s*'row-reverse'/);
    expect(headerSrc).not.toMatch(/direction:\s*'rtl'/);
    expect(postCardSrc).toMatch(/textAlign:\s*'right'/);
  });

  it('is the tweets-feed placeholder, only when loading with no cached posts', () => {
    expect(feedSrc).toMatch(/import \{ TweetCardSkeleton \} from '\.\/TweetCardSkeleton'/);
    expect(feedSrc).not.toMatch(/from ['"].*SkeletonLoader['"]/);
    expect(feedSrc).toMatch(/if \(loading && posts\.length === 0\)/);
  });
});
