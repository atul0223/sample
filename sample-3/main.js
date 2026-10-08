(() => {
  const root = document.documentElement;
  const header = document.querySelector('[data-header]');

  if (!window.gsap || !window.ScrollTrigger || !window.SplitText) {
    root.classList.remove('motion');
    return;
  }
  gsap.registerPlugin(ScrollTrigger, SplitText);

  ScrollTrigger.create({
    start: 60,
    end: 'max',
    onToggle: (self) => header.classList.toggle('is-scrolled', self.isActive),
  });

  const mm = gsap.matchMedia();

  mm.add('(prefers-reduced-motion: no-preference)', () => {
    let lenis = null;
    let tick = null;
    if (window.Lenis) {
      // Wheel gets smoothed; touch devices keep native scrolling.
      lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
      lenis.on('scroll', ScrollTrigger.update);
      tick = (time) => lenis && lenis.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
      document.querySelectorAll('a[href^="#"]').forEach((a) => {
        a.addEventListener('click', (e) => {
          const id = a.getAttribute('href');
          const target = id.length > 1 && document.querySelector(id);
          if (!lenis || !target) return;
          e.preventDefault();
          lenis.scrollTo(target, { offset: -72, duration: 1.4 });
        });
      });
    }

    document.fonts.ready.then(() => {
      // Hero intro
      const title = document.querySelector('.hero-title');
      const heroSplit = SplitText.create(title, { type: 'lines', mask: 'lines' });
      title.classList.add('split-ready');
      gsap.timeline({ defaults: { ease: 'expo.out' } })
        .from(heroSplit.lines, { yPercent: 110, duration: 1.5, stagger: 0.12 })
        .from('.hero [data-fade]', { y: 28, autoAlpha: 0, duration: 1.3, stagger: 0.1 }, '-=1.1')
        .fromTo('.hero-media-frame',
          { clipPath: 'inset(22% 10% 0% 10% round 8px)' },
          { clipPath: 'inset(0% 0% 0% 0% round 8px)', duration: 1.8, ease: 'expo.inOut' }, '-=1.3')
        .from('.hero-media img', { scale: 1.35, duration: 2.2 }, '<');

      // Hero image drifts slower than the page.
      gsap.fromTo('.hero-media img', { yPercent: 0 }, {
        yPercent: -12, ease: 'none',
        scrollTrigger: { trigger: '.hero-media', start: 'top bottom', end: 'bottom top', scrub: true },
      });

      // Statement: words light up as the reader scrolls through it.
      const statement = document.querySelector('[data-words]');
      const words = SplitText.create(statement, { type: 'words', wordsClass: 'word' }).words;
      gsap.fromTo(words, { opacity: 0.15 }, {
        opacity: 1, stagger: 0.1, ease: 'none',
        scrollTrigger: { trigger: statement, start: 'top 82%', end: 'bottom 50%', scrub: true },
      });

      // Section titles rise out of a mask.
      document.querySelectorAll('[data-split]:not(.hero-title)').forEach((el) => {
        const s = SplitText.create(el, { type: 'lines', mask: 'lines' });
        el.classList.add('split-ready');
        gsap.from(s.lines, {
          yPercent: 110, duration: 1.3, ease: 'expo.out', stagger: 0.1,
          scrollTrigger: { trigger: el, start: 'top 86%' },
        });
      });

      gsap.utils.toArray('[data-fade]').filter((el) => !el.closest('.hero')).forEach((el) => {
        gsap.from(el, {
          y: 32, autoAlpha: 0, duration: 1.2, ease: 'expo.out',
          scrollTrigger: { trigger: el, start: 'top 90%' },
        });
      });

      // Photos wipe in, then parallax inside their frames.
      gsap.utils.toArray('[data-parallax]').forEach((fig) => {
        const img = fig.querySelector('img');
        gsap.fromTo(fig, { clipPath: 'inset(100% 0% 0% 0%)' }, {
          clipPath: 'inset(0% 0% 0% 0%)', duration: 1.5, ease: 'expo.inOut',
          scrollTrigger: { trigger: fig, start: 'top 88%' },
        });
        gsap.fromTo(img, { yPercent: -8, scale: 1.08 }, {
          yPercent: 0, scale: 1, ease: 'none',
          scrollTrigger: { trigger: fig, start: 'top bottom', end: 'bottom top', scrub: true },
        });
      });

      // Phone number digits rise one by one.
      const phone = document.querySelector('[data-chars]');
      const chars = SplitText.create(phone, { type: 'chars', charsClass: 'char', mask: 'chars' }).chars;
      gsap.from(chars, {
        yPercent: 105, duration: 1.2, ease: 'expo.out', stagger: 0.045,
        scrollTrigger: { trigger: phone, start: 'top 88%' },
      });

      gsap.fromTo('[data-footer-mark]', { yPercent: 60 }, {
        yPercent: 12, ease: 'none',
        scrollTrigger: { trigger: '.site-footer', start: 'top bottom', end: 'bottom bottom', scrub: true },
      });

      ScrollTrigger.refresh();
    });

    if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
      document.querySelectorAll('[data-magnetic]').forEach((el) => {
        const xTo = gsap.quickTo(el, 'x', { duration: 0.7, ease: 'expo.out' });
        const yTo = gsap.quickTo(el, 'y', { duration: 0.7, ease: 'expo.out' });
        el.addEventListener('pointermove', (e) => {
          const r = el.getBoundingClientRect();
          xTo((e.clientX - r.left - r.width / 2) * 0.25);
          yTo((e.clientY - r.top - r.height / 2) * 0.35);
        });
        el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
      });
    }

    return () => {
      if (tick) gsap.ticker.remove(tick);
      if (lenis) lenis.destroy();
      lenis = null;
    };
  });

  // Desktop: pin the enquiry section and step through it while scrolling.
  mm.add('(min-width: 1025px) and (prefers-reduced-motion: no-preference)', () => {
    const section = document.querySelector('[data-enquire]');
    const steps = gsap.utils.toArray('[data-step]');
    section.classList.add('is-pinned');
    gsap.set(steps.slice(1), { autoAlpha: 0, y: 70 });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section, start: 'top top', end: () => '+=' + innerHeight * 2.2,
        pin: true, scrub: 0.7, anticipatePin: 1, invalidateOnRefresh: true,
      },
    });
    tl.fromTo('[data-progress]', { scaleY: 1 / steps.length }, { scaleY: 1, ease: 'none', duration: steps.length }, 0);
    steps.forEach((step, i) => {
      if (i === 0) return;
      tl.to(steps[i - 1], { autoAlpha: 0, y: -70, duration: 0.45, ease: 'power2.in' }, i - 0.55)
        .to(step, { autoAlpha: 1, y: 0, duration: 0.45, ease: 'power2.out' }, i - 0.3);
    });

    return () => section.classList.remove('is-pinned');
  });

  // Tablet and phone: each step reveals as it scrolls in.
  mm.add('(max-width: 1024px) and (prefers-reduced-motion: no-preference)', () => {
    gsap.utils.toArray('[data-step]').forEach((step) => {
      gsap.from(step, {
        y: 40, autoAlpha: 0, duration: 1.1, ease: 'expo.out',
        scrollTrigger: { trigger: step, start: 'top 88%' },
      });
    });
  });
})();
