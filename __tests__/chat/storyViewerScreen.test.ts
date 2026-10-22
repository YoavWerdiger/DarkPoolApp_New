import { readFileSync } from 'fs';
import { join } from 'path';
import { buildStoryViewerParams, getStoryViewerUser, rememberStoryViewerUsers } from '../../lib/storyViewerSession';
import { resolveStoryIndex, storyAuthoredFrame, isPlayableMediaUri } from '../../components/stories/storyLayout';

const root = join(__dirname, '../..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('story viewer screen', () => {
  it('builds id-only params and keeps user details in memory', () => {
    const users = [
      { user_id: 'a', user: { display_name: 'A', full_name: null, profile_picture: null } },
      { user_id: 'me', user: { display_name: 'Me', full_name: null, profile_picture: 'p.jpg' } },
    ];
    expect(buildStoryViewerParams(users, 'me')).toEqual({ userIds: ['a', 'me'], startUserId: 'me' });
    expect(buildStoryViewerParams(users, 'me', 'last')).toEqual({ userIds: ['a', 'me'], startUserId: 'me', startStoryIndex: 'last' });
    expect(buildStoryViewerParams(users, 'missing')).toBeNull();
    rememberStoryViewerUsers(users);
    expect(getStoryViewerUser('me').user?.profile_picture).toBe('p.jpg');
    expect(getStoryViewerUser('unknown')).toEqual({ user_id: 'unknown', user: null });
  });

  it('resolves landing story index', () => {
    expect(resolveStoryIndex(3, 'last')).toBe(2);
    expect(resolveStoryIndex(3, 7)).toBe(2);
    expect(resolveStoryIndex(3, -1)).toBe(0);
    expect(resolveStoryIndex(0, 'last')).toBe(0);
  });

  it('parses the authored frame and playable uris', () => {
    expect(storyAuthoredFrame(null)).toBeNull();
    expect(storyAuthoredFrame('plain text')).toBeNull();
    expect(storyAuthoredFrame('{"canvasWidth":100,"canvasHeight":200}')).not.toBeNull();
    expect(isPlayableMediaUri('file:///x.jpg')).toBe(true);
    expect(isPlayableMediaUri('stories/u/1.jpg')).toBe(false);
  });

  it('is a root-stack screen, not an RN Modal', () => {
    const app = read('App.tsx');
    expect(app).toMatch(/name="StoryViewer"[\s\S]{0,200}presentation: 'transparentModal'/);
    const screen = read('screens/Stories/StoryViewerScreen.tsx');
    expect(screen).not.toMatch(/<Modal\b/);
    expect(screen).not.toMatch(/<FlatList|initialScrollIndex=|scrollToOffset\(/);
    const list = read('screens/ChatNew/ChatGroupsListScreen.tsx');
    expect(list).not.toMatch(/<StoryViewer\b/);
    expect(list).toMatch(/openStoryViewer\(/);
  });
});
