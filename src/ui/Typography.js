// Vanilla SplitText. Wraps each word in an overflow-hidden span and each
// char in a translate-ready inner span. GSAP animates the chars.
//
// Usage: splitText(el) returns { chars, words }.

import gsap from 'gsap';

export function splitText(el) {
  if (!el || el.dataset.split === 'true') {
    return {
      chars: el ? el.querySelectorAll('.char') : [],
      words: el ? el.querySelectorAll('.word') : [],
    };
  }

  const text = el.textContent.trim();
  el.innerHTML = '';
  const words = [];
  const chars = [];

  text.split(/(\s+)/).forEach((token) => {
    if (/^\s+$/.test(token)) {
      el.appendChild(document.createTextNode(' '));
      return;
    }
    const word = document.createElement('span');
    word.className = 'word';
    words.push(word);
    for (const ch of token) {
      const c = document.createElement('span');
      c.className = 'char';
      c.textContent = ch;
      word.appendChild(c);
      chars.push(c);
    }
    el.appendChild(word);
  });

  el.dataset.split = 'true';
  return { chars, words };
}

export function revealHeadline(el, { delay = 0, stagger = 0.025 } = {}) {
  const { chars } = splitText(el);
  gsap.set(chars, { yPercent: 110, opacity: 0 });
  return gsap.to(chars, {
    yPercent: 0,
    opacity: 1,
    duration: 0.9,
    ease: 'expo.out',
    stagger,
    delay,
  });
}
