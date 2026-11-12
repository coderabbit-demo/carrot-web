import { describe, expect, it } from 'vitest';
import { formatNote } from './formatNote';

describe('formatNote', () => {
  it('leaves plain text unchanged', () => {
    expect(formatNote('Here are the carrots we discussed.')).toBe(
      'Here are the carrots we discussed.',
    );
  });

  it('turns **text** into a strong tag', () => {
    expect(formatNote('**Please review**')).toBe('<strong>Please review</strong>');
  });

  it('turns *text* into an em tag', () => {
    expect(formatNote('*by Friday*')).toBe('<em>by Friday</em>');
  });

  it('handles bold and italic together', () => {
    expect(formatNote('**Order ready**, *ships Monday*')).toBe(
      '<strong>Order ready</strong>, <em>ships Monday</em>',
    );
  });

  it('leaves unmatched asterisks as-is', () => {
    expect(formatNote('a * b')).toBe('a * b');
  });
});
