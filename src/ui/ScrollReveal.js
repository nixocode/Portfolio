// Scroll-driven reveals for project cards. Uses clip-path + 3D rotateX so
// cards feel like they're being peeled onto the screen, not fading in.

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { splitText } from './Typography.js';

export function revealProjects() {
  const cards = document.querySelectorAll('.project-details');

  cards.forEach((card) => {
    // Split the card's title so chars can stagger in with the unfold.
    const title = card.querySelector('.split-target');
    const { chars } = title ? splitText(title) : { chars: [] };

    // Pre-state: clipped, tilted, offset.
    gsap.set(card, {
      clipPath: 'inset(0% 100% 0% 0%)',
      rotateX: 18,
      y: 60,
      opacity: 0,
      transformPerspective: 1000,
      transformOrigin: 'left center',
    });
    if (chars.length) gsap.set(chars, { yPercent: 110, opacity: 0 });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: card,
        start: 'top 82%',
        toggleActions: 'play none none reverse',
      },
    });

    tl.to(card, {
      clipPath: 'inset(0% 0% 0% 0%)',
      rotateX: 0,
      y: 0,
      opacity: 1,
      duration: 1.1,
      ease: 'expo.out',
    });

    if (chars.length) {
      tl.to(chars, {
        yPercent: 0,
        opacity: 1,
        stagger: 0.02,
        duration: 0.7,
        ease: 'expo.out',
      }, '-=0.8');
    }

    const badges = card.querySelectorAll('.tech-badge');
    if (badges.length) {
      gsap.set(badges, { y: 20, opacity: 0 });
      tl.to(badges, {
        y: 0,
        opacity: 1,
        stagger: 0.06,
        duration: 0.5,
        ease: 'power3.out',
      }, '-=0.5');
    }
  });
}

// Proximity-to-camera → which project node pulses. Called every frame.
export function currentProjectIndex(totalCards) {
  const cards = document.querySelectorAll('.project-section');
  const vh = window.innerHeight;
  const center = vh * 0.5;
  let best = -1;
  let bestDist = Infinity;
  cards.forEach((card, i) => {
    const rect = card.getBoundingClientRect();
    const cardCenter = rect.top + rect.height / 2;
    const d = Math.abs(cardCenter - center);
    if (d < bestDist && d < vh * 0.6) {
      best = i;
      bestDist = d;
    }
  });
  return best >= 0 && best < totalCards ? best : -1;
}
