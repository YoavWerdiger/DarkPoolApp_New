import { readFileSync } from 'fs';
import { join } from 'path';
import { Platform } from 'react-native';
import {
  CHAT_STACK_ANIMATION,
  CHAT_STACK_ANIMATION_MS,
  createChatStackScreenOptions,
  createLearningStackScreenOptions,
  learningStackScreenListeners,
  chatStackScreenListeners,
} from '../../navigation/chatStackTransition';

const learningStackSrc = readFileSync(
  join(__dirname, '../../navigation/LearningStack.tsx'),
  'utf8',
);

describe('learning stack transitions', () => {
  it('reuses the chat native slide instead of a short fade', () => {
    const options = createLearningStackScreenOptions();
    expect(createLearningStackScreenOptions).toBe(createChatStackScreenOptions);
    expect(learningStackScreenListeners).toBe(chatStackScreenListeners);
    expect(options.animation).toBe('slide_from_right');
    expect(options.animation).toBe(CHAT_STACK_ANIMATION);
    expect(options.freezeOnBlur).toBe(false);
    expect(options.contentStyle).toEqual({ backgroundColor: 'transparent' });
    expect(options.animationDuration).toBe(CHAT_STACK_ANIMATION_MS);
    expect(CHAT_STACK_ANIMATION_MS).toBeGreaterThanOrEqual(300);
    expect(CHAT_STACK_ANIMATION_MS).toBe(Platform.OS === 'android' ? 300 : 350);
  });

  it('does not keep the stuck fade / short duration / freezeOnBlur on academy screens', () => {
    expect(learningStackSrc).toContain('createLearningStackScreenOptions');
    expect(learningStackSrc).toContain('learningStackScreenListeners');
    expect(learningStackSrc).not.toContain("animation: 'fade'");
    expect(learningStackSrc).not.toContain('animationDuration: 90');
    expect(learningStackSrc).not.toContain('animationDuration: 200');
    expect(learningStackSrc).not.toContain('freezeOnBlur: true');
  });
});
