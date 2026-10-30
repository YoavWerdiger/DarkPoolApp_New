/* DarkPool landing — scroll & motion */
(() => {
  // קישורי החנויות — להדביק כאן את הקישורים האמיתיים כשהאפליקציה מפורסמת
  const STORE_LINKS = {
    ios: '',
    android: '',
  };

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isDesktop = () => window.matchMedia('(min-width: 901px)').matches;
  const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  document.documentElement.classList.toggle('js', hasGsap && !reduceMotion);

  document.querySelector('[data-year]').textContent = new Date().getFullYear();

  // theme toggle — explicit choice overrides the system setting
  const root = document.documentElement;
  const systemLight = window.matchMedia('(prefers-color-scheme: light)');
  const currentTheme = () => root.dataset.theme || (systemLight.matches ? 'light' : 'dark');
  document.querySelector('.theme-toggle').addEventListener('click', () => {
    const next = currentTheme() === 'light' ? 'dark' : 'light';
    root.dataset.theme = next;
    try { localStorage.setItem('dp-theme', next); } catch (e) {}
  });

  document.querySelectorAll('[data-store]').forEach((a) => {
    const href = STORE_LINKS[a.dataset.store];
    if (href) {
      a.href = href;
      a.target = '_blank';
      a.rel = 'noopener';
    } else {
      a.addEventListener('click', (e) => e.preventDefault());
    }
  });

  /* ---------- generated mock content ---------- */
  const TICKERS = [
    ['NVDA', 138.42, 2.31], ['AAPL', 231.17, 0.84], ['TSLA', 262.9, -1.42], ['MSFT', 428.6, 0.37],
    ['AMZN', 191.3, 1.12], ['META', 581.2, -0.56], ['GOOGL', 166.8, 0.92], ['AMD', 152.4, 3.08],
    ['TEVA', 18.62, 1.65], ['NFLX', 754.1, -0.31], ['PLTR', 41.85, 4.12], ['SPY', 579.3, 0.44],
    ['QQQ', 497.2, 0.61], ['COIN', 204.5, -2.1], ['ת״א 35', 2214.6, 0.72],
  ];
  const fmt = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sign = (n) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';

  // candle chart in chat message
  const candles = document.querySelector('.candles');
  if (candles) {
    // y grows downward, so a falling y is a rising price — bias toward an uptrend
    let price = 66, out = '';
    for (let i = 0; i < 22; i++) {
      const open = price;
      price = Math.max(10, Math.min(72, price + (Math.random() - 0.64) * 12));
      const close = price;
      const hi = Math.min(open, close) - Math.random() * 5;
      const lo = Math.max(open, close) + Math.random() * 5;
      const x = 6 + i * 8.6;
      const up = close < open; // y axis is inverted
      const col = up ? '#00e654' : '#ff5a52';
      out += `<line x1="${x + 2.5}" x2="${x + 2.5}" y1="${hi}" y2="${lo}" stroke="${col}"/>`;
      out += `<rect class="${up ? 'u' : 'd'}" x="${x}" y="${Math.min(open, close)}" width="5" height="${Math.max(1.5, Math.abs(close - open))}" rx="1"/>`;
    }
    candles.innerHTML = out;
  }

  // voice note waveform
  document.querySelectorAll('.wave').forEach((w) => {
    w.innerHTML = Array.from({ length: 26 }, (_, i) =>
      `<i class="${i < 10 ? 'p' : ''}" style="--h:${(20 + Math.abs(Math.sin(i * 1.7)) * 70 + Math.random() * 10).toFixed(0)}%"></i>`
    ).join('');
  });

  // journal P&L calendar
  const cal = document.querySelector('.cal');
  if (cal) {
    let cells = '';
    for (let i = 0; i < 35; i++) {
      const weekend = i % 7 === 5 || i % 7 === 6;
      if (weekend || i > 30) { cells += '<i></i>'; continue; }
      const win = Math.random() > 0.34;
      cells += `<i class="${win ? 'g' : 'r'}" style="--a:${(0.25 + Math.random() * 0.7).toFixed(2)}"></i>`;
    }
    cal.innerHTML = cells;
  }

  // heatmap
  const heat = document.querySelector('.heatmap');
  const heatColor = (c) => {
    const a = Math.min(1, 0.55 + Math.abs(c) / 9);
    return c >= 0 ? `rgba(0, 200, 80, ${a})` : `rgba(235, 70, 64, ${a})`;
  };
  const heatCells = [];
  if (heat) {
    const layout = ['big', 'big', 'wide', '', '', 'wide', '', '', '', '', 'wide', '', '', '', '', '', '', '', '', ''];
    const names = ['NVDA', 'AAPL', 'MSFT', 'AMD', 'META', 'GOOGL', 'TSLA', 'NFLX', 'PLTR', 'COIN', 'AMZN', 'AVGO', 'ORCL', 'CRM', 'INTC', 'TEVA', 'UBER', 'SHOP', 'JPM', 'V'];
    heat.innerHTML = names.map((n, i) => `<i class="${layout[i] || ''}">${n}</i>`).join('');
    heat.querySelectorAll('i').forEach((el) => {
      const cell = { el, c: (Math.random() - 0.4) * 6 };
      el.style.backgroundColor = heatColor(cell.c);
      heatCells.push(cell);
    });
  }

  // watchlist — rows like the app's watchlist screen
  const watch = document.querySelector('[data-watch]');
  const watchRows = [];
  const NAMES = { NVDA: 'NVIDIA', AAPL: 'Apple', TSLA: 'Tesla', MSFT: 'Microsoft' };
  if (watch) {
    TICKERS.slice(0, 4).forEach(([s, p, c]) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="w-logo" data-logo="${s}">${s[0]}</span><span class="w-name"><b>${s}</b><small>${NAMES[s]}</small></span><span class="w-px"><b class="px">$${fmt(p)}</b><span class="chg ${c >= 0 ? 'up' : 'down'}">${sign(c)}</span></span>`;
      watch.appendChild(li);
      watchRows.push({ li, p, c, base: p / (1 + c / 100) });
    });
  }

  // ticker logos — same Brandfetch source as the app's TickerLogo, letter fallback on failure
  const BRANDFETCH_ID = '1idgv-PUKssFHXQBcKA';
  document.querySelectorAll('[data-logo]').forEach((el) => {
    const img = new Image();
    img.alt = '';
    img.decoding = 'async';
    img.onload = () => el.appendChild(img);
    img.src = `https://cdn.brandfetch.io/ticker/${encodeURIComponent(el.dataset.logo)}/icon?c=${BRANDFETCH_ID}&theme=light&fallback=lettermark`;
  });

  // economic calendar countdown — counts down like the app's next-event badge
  const countdowns = document.querySelectorAll('[data-countdown]');
  if (countdowns.length) {
    let secs = 12 * 60 + 41;
    setInterval(() => {
      secs = secs > 0 ? secs - 1 : 15 * 60;
      const m = Math.floor(secs / 60), s = String(secs % 60).padStart(2, '0');
      countdowns.forEach((el) => (el.textContent = `בעוד ${m}:${s}`));
    }, 1000);
  }

  // live-ish updates (only while visible on screen)
  const visible = new Set();
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target)));
  });
  if (heat) io.observe(heat);
  if (watch) io.observe(watch);
  if (!reduceMotion) {
    setInterval(() => {
      if (visible.has(heat)) {
        for (let k = 0; k < 3; k++) {
          const cell = heatCells[(Math.random() * heatCells.length) | 0];
          cell.c = Math.max(-5, Math.min(5, cell.c + (Math.random() - 0.5) * 2.2));
          cell.el.style.backgroundColor = heatColor(cell.c);
        }
      }
      if (visible.has(watch)) {
        const r = watchRows[(Math.random() * watchRows.length) | 0];
        r.p = r.p * (1 + (Math.random() - 0.48) * 0.004);
        r.c = (r.p / r.base - 1) * 100;
        const px = r.li.querySelector('.px');
        const chg = r.li.querySelector('.chg');
        px.textContent = '$' + fmt(r.p);
        chg.textContent = sign(r.c);
        chg.className = 'chg ' + (r.c >= 0 ? 'up' : 'down');
        px.classList.remove('flash'); void px.offsetWidth; px.classList.add('flash');
      }
    }, 1100);
  }

  // fit the sticky phone to the window height (660px phone + room for the navbar)
  const PHONE_H = 660, NAV_SPACE = 96, BREATHING = 32;
  const fitPhone = () => {
    const fit = Math.min(1, Math.max(0.55, (window.innerHeight - NAV_SPACE - BREATHING) / PHONE_H));
    document.documentElement.style.setProperty('--phone-fit', fit.toFixed(3));
  };
  fitPhone();
  window.addEventListener('resize', fitPhone, { passive: true });

  // manifesto words
  const manifesto = document.querySelector('[data-split]');
  const HL = ['מקום', 'אחד'];
  manifesto.innerHTML = manifesto.textContent.trim().split(/\s+/)
    .map((w) => `<span class="w${HL.includes(w) ? ' hl' : ''}">${w}</span>`).join(' ');

  // FAQ: one open at a time
  const details = document.querySelectorAll('.faq details');
  details.forEach((d) => d.addEventListener('toggle', () => {
    if (d.open) details.forEach((o) => o !== d && (o.open = false));
  }));

  // bento spotlight
  document.querySelectorAll('.tile').forEach((t) => {
    t.addEventListener('pointermove', (e) => {
      const r = t.getBoundingClientRect();
      t.style.setProperty('--mx', `${e.clientX - r.left}px`);
      t.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });

  // nav hide on scroll down
  const nav = document.getElementById('nav');
  let lastY = 0;
  const onScrollNav = (y) => {
    nav.classList.toggle('is-hidden', y > lastY && y > 400);
    lastY = y;
  };

  /* ---------- no-motion fallback ---------- */
  const storyPhone = document.querySelector('.story-phone');
  const screens = storyPhone.querySelectorAll('.screen');
  const storySteps = document.querySelectorAll('.step');
  const progress = document.querySelectorAll('.story-progress span');
  const JOURNAL = 3, STORIES = 1;
  let current = -1;
  let onStepChange = () => {};
  const setStep = (i) => {
    if (i === current) return;
    current = i;
    screens.forEach((s, k) => s.classList.toggle('is-active', k === i));
    storySteps.forEach((s, k) => s.classList.toggle('is-active', k === i));
    progress.forEach((p, k) => { p.classList.toggle('on', k <= i); p.classList.toggle('now', k === i); });
    storyPhone.toggleAttribute('data-screen-bleed', i === STORIES);
    onStepChange(i);
  };
  setStep(0);

  // on phones each step carries its own copy of the phone, showing just its screen
  storySteps.forEach((step) => {
    const idx = step.dataset.step;
    const wrap = document.createElement('div');
    wrap.className = 'step-visual';
    wrap.setAttribute('aria-hidden', 'true');
    const phone = storyPhone.cloneNode(true);
    phone.classList.remove('story-phone');
    phone.querySelectorAll('.screen').forEach((s) => (s.dataset.screen === idx ? s.classList.add('is-active') : s.remove()));
    if (idx === String(STORIES)) phone.setAttribute('data-screen-bleed', '');
    wrap.appendChild(phone);
    step.prepend(wrap);
  });

  if (!hasGsap || reduceMotion) {
    root.classList.remove('intro-on');
    window.addEventListener('scroll', () => onScrollNav(window.scrollY), { passive: true });
    const stepIo = new IntersectionObserver((entries) => {
      entries.forEach((e) => e.isIntersecting && setStep(+e.target.dataset.step));
    }, { rootMargin: '-45% 0px -45% 0px' });
    storySteps.forEach((s) => stepIo.observe(s));
    return;
  }

  /* ================= MOTION ================= */
  gsap.registerPlugin(ScrollTrigger);

  // smooth scroll
  let lenis = null;
  if (typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
    lenis.on('scroll', (e) => { ScrollTrigger.update(); onScrollNav(e.scroll); });
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const id = a.getAttribute('href');
        if (id.length < 2) return;
        const target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        lenis.scrollTo(target, { offset: id === '#top' ? 0 : -20, duration: 1.6 });
      });
    });
  } else {
    window.addEventListener('scroll', () => onScrollNav(window.scrollY), { passive: true });
  }


  /* ---- hero intro ---- */
  const heroPhone = document.querySelector('.hero-phone');
  const intro = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } });
  intro
    .fromTo('.nav', { y: -40, opacity: 0 }, { y: 0, opacity: 1, duration: 1.2, immediateRender: true })
    .from('.hero-title .word', { yPercent: 115, rotate: -4, duration: 1.4, stagger: 0.08 }, 0.15)
    .from('.hero-sub', { y: 24, opacity: 0, duration: 1.2 }, 0.6)
    .from('.hero-stores .store-btn', { y: 24, opacity: 0, duration: 1, stagger: 0.1 }, 0.75)
    .from('.hero-note', { opacity: 0, duration: 1 }, 0.95)
    .from(heroPhone, { y: 220, rotateX: 38, rotateZ: -6, opacity: 0, duration: 2, ease: 'expo.out' }, 0.3)
    .from('.cm-list li', { x: -24, opacity: 0, duration: 0.9, stagger: 0.06 }, 1.1)
    .from('.cm-story', { scale: 0.85, opacity: 0, duration: 0.8, stagger: 0.05, ease: 'back.out(1.6)' }, 1)
    .from('.scroll-hint', { opacity: 0, duration: 1 }, 1.6);

  /* ---- opening scene: bull and bear meet, then the curtain lifts ---- */
  const introEl = document.querySelector('.intro');
  if (root.classList.contains('intro-on') && introEl) {
    if (lenis) lenis.stop();
    try { sessionStorage.setItem('dp-intro', '1'); } catch (e) {}
    const finish = () => {
      root.classList.remove('intro-on');
      introEl.remove();
      if (lenis) lenis.start();
      ScrollTrigger.refresh();
    };
    const scene = gsap.timeline({ onComplete: finish });
    scene
      .fromTo('.intro-bull', { xPercent: -55, rotate: -14, opacity: 0 }, { xPercent: 0, rotate: 0, opacity: 1, duration: 0.9, ease: 'power3.out' }, 0)
      .fromTo('.intro-bear', { xPercent: 55, rotate: 14, opacity: 0 }, { xPercent: 0, rotate: 0, opacity: 1, duration: 0.9, ease: 'power3.out' }, 0)
      .from('.intro-word span', { yPercent: 110, duration: 0.7, ease: 'expo.out', stagger: 0.035 }, 0.55)
      .from('.intro-tag', { opacity: 0, y: 8, duration: 0.6, ease: 'power2.out' }, 0.85)
      .to('.intro-mark, .intro-word, .intro-tag', { opacity: 0, y: -16, duration: 0.45, ease: 'power2.in' }, 1.7)
      .to(introEl, { clipPath: 'inset(0 0 100% 0)', duration: 0.9, ease: 'power4.inOut' }, 1.9)
      .add(() => intro.play(), 2.15);
    introEl.addEventListener('click', () => { scene.progress(1); intro.play(); }, { once: true });
  } else {
    intro.play();
  }

  // mouse tilt on hero phone (desktop)
  const stage = document.querySelector('.hero-stage');
  const tiltX = gsap.quickTo(heroPhone, 'rotateY', { duration: 1, ease: 'power3' });
  const tiltY = gsap.quickTo(heroPhone, 'rotateX', { duration: 1, ease: 'power3' });
  window.addEventListener('pointermove', (e) => {
    if (!isDesktop()) return;
    tiltX(((e.clientX / window.innerWidth) - 0.5) * 16);
    tiltY(((e.clientY / window.innerHeight) - 0.5) * -10);
  });

  // hero scroll-out
  gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } })
    .to('.hero-copy', { y: -120, opacity: 0, ease: 'none' }, 0)
    .to(stage, { y: 120, scale: 0.92, ease: 'none' }, 0)
    .to('.hero-aurora', { yPercent: 30, opacity: 0.4, ease: 'none' }, 0);

  /* ---- manifesto word-by-word light-up ---- */
  gsap.timeline({
    scrollTrigger: { trigger: '.manifesto', start: 'top top', end: '+=110%', pin: true, scrub: 0.6, anticipatePin: 1 },
  })
    .fromTo('.manifesto-text', { scale: 0.86 }, { scale: 1, ease: 'none', duration: 1 }, 0)
    .to('.manifesto-text .w', { opacity: 1, ease: 'none', stagger: 0.1, duration: 0.5 }, 0)
    .fromTo('.manifesto-aside', { opacity: 0, y: 16 }, { opacity: 1, y: 0, ease: 'none', duration: 0.25 }, 0.75);

  /* ---- generic reveals ---- */
  gsap.utils.toArray('.reveal').forEach((el) => {
    gsap.fromTo(el, { y: 50, opacity: 0, filter: 'blur(8px)' }, {
      y: 0, opacity: 1, filter: 'blur(0px)', duration: 1.3, ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 88%' },
    });
  });
  gsap.utils.toArray('.eyebrow').forEach((el) => {
    if (el.closest('.hero')) return;
    gsap.from(el, { x: 30, opacity: 0, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%' } });
  });

  const mm = gsap.matchMedia();

  /* ---- story: every system, one phone ---- */
  // P&L line draws the first time the journal screen shows
  storyPhone.querySelectorAll('.pnl-line .stroke').forEach((p) => {
    const len = p.getTotalLength();
    p.style.strokeDasharray = len;
    p.style.strokeDashoffset = len;
  });
  let pnlDrawn = false;
  onStepChange = (i) => {
    if (i !== JOURNAL || pnlDrawn) return;
    pnlDrawn = true;
    storyPhone.querySelectorAll('.pnl-line .stroke').forEach((p) => gsap.to(p, { strokeDashoffset: 0, duration: 1.4, ease: 'power2.out' }));
    storyPhone.querySelectorAll('[data-pnl]').forEach((el) => {
      const o = { v: 0 };
      gsap.to(o, { v: 4812, duration: 1.4, ease: 'power2.out', onUpdate: () => (el.textContent = '+$' + Math.round(o.v).toLocaleString('en-US')) });
    });
  };

  gsap.from('.story-sticky .phone', { y: 100, rotateX: 16, opacity: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '.story-grid', start: 'top 75%' } });
  // headline words rise from behind a mask
  storySteps.forEach((step) => {
    const h = step.querySelector('h3');
    h.innerHTML = h.innerHTML.split(/(<br\s*\/?>)/).map((part) =>
      /^<br/.test(part) ? part : part.trim().split(/\s+/).filter(Boolean).map((w) => `<span class="mw"><span>${w}</span></span>`).join(' ')
    ).join('');
  });
  // the sticky phone follows the scroll continuously: between two steps the old screen
  // drifts up and fades while the next rises in, so nothing ever jumps
  const storyNum = document.querySelector('.story-num');
  const renderStory = () => {
    const mid = window.innerHeight * 0.55;
    const c = Array.from(storySteps, (s) => { const r = s.getBoundingClientRect(); return r.top + r.height / 2; });
    let pos = 0;
    if (mid >= c[c.length - 1]) pos = c.length - 1;
    else if (mid > c[0]) {
      for (let k = 0; k < c.length - 1; k++) {
        if (mid >= c[k] && mid < c[k + 1]) { pos = k + (mid - c[k]) / (c[k + 1] - c[k]); break; }
      }
    }
    // the next screen slides up over the current one like a sheet, synced to the scroll
    const k = Math.min(screens.length - 1, Math.floor(pos));
    const f = pos - k;
    const raw = Math.min(1, Math.max(0, (f - 0.3) / 0.4));
    const t = raw * raw * (3 - 2 * raw);
    screens.forEach((s, i) => {
      const st = s.style;
      if (i === k) {
        st.visibility = 'visible'; st.zIndex = '1'; st.opacity = (1 - 0.4 * t).toFixed(3);
        st.clipPath = 'none'; st.transform = `translate3d(0, ${(-26 * t).toFixed(1)}px, 0)`;
      } else if (i === k + 1 && t > 0) {
        st.visibility = 'visible'; st.zIndex = '2'; st.opacity = '1';
        st.clipPath = `inset(${((1 - t) * 100).toFixed(2)}% 0 0 0)`;
        st.transform = `translate3d(0, ${((1 - t) * 18).toFixed(1)}px, 0)`;
      } else {
        st.visibility = 'hidden'; st.opacity = '0'; st.zIndex = '0';
      }
    });
    const near = t > 0.5 ? Math.min(screens.length - 1, k + 1) : k;
    if (storyNum) {
      const txt = String(near + 1).padStart(2, '0');
      if (storyNum.textContent !== txt) storyNum.textContent = txt;
      storyNum.style.opacity = (t === 0 ? 1 : Math.abs(t - 0.5) * 2).toFixed(3);
    }
    setStep(near);
  };
  storyPhone.classList.add('gsap-screens');
  ScrollTrigger.create({ trigger: '.story-steps', start: 'top bottom', end: 'bottom top', onUpdate: renderStory, onRefresh: renderStory });
  renderStory();
  storySteps.forEach((step, i) => {
    gsap.timeline({ scrollTrigger: { trigger: step, start: 'top 72%' } })
      .from(step.querySelectorAll('.step-num, .eyebrow'), { y: 20, opacity: 0, duration: 0.9, ease: 'expo.out', stagger: 0.06 }, 0)
      .from(step.querySelectorAll('h3 .mw > span'), { yPercent: 110, duration: 1, ease: 'expo.out', stagger: 0.05 }, 0.05)
      .from(step.querySelectorAll('p:not(.eyebrow)'), { y: 20, opacity: 0, duration: 1, ease: 'expo.out' }, 0.25);
  });
  document.querySelectorAll('.step-visual').forEach((v) => {
    gsap.from(v.querySelector('.phone'), { y: 70, opacity: 0, duration: 1.3, ease: 'expo.out', scrollTrigger: { trigger: v, start: 'top 85%' } });
    if (v.querySelector('.pnl-line')) {
      ScrollTrigger.create({ trigger: v, start: 'top 75%', once: true, onEnter: () => {
        v.querySelectorAll('.pnl-line .stroke').forEach((p) => gsap.fromTo(p, { strokeDashoffset: p.getTotalLength(), strokeDasharray: p.getTotalLength() }, { strokeDashoffset: 0, duration: 1.4, ease: 'power2.out' }));
      } });
    }
  });

  /* ---- insiders: horizontal scroll (desktop), parallax portraits ---- */
  mm.add('(min-width: 901px)', () => {
    const head = document.querySelector('.insiders-head');
    const row = document.querySelector('.insiders-track');
    // RTL: the track runs off the left edge — slide everything right to reveal it
    const people = gsap.utils.toArray('.person:not(.more)');
    const tintPeople = () => {
      const mid = window.innerWidth / 2;
      people.forEach((p) => {
        const r = p.getBoundingClientRect();
        const d = Math.abs(r.left + r.width / 2 - mid) / (window.innerWidth * 0.42);
        p.style.setProperty('--g', Math.min(1, d).toFixed(3));
      });
    };
    tintPeople();
    const distance = () => Math.max(0, -row.lastElementChild.getBoundingClientRect().left + 48 - (gsap.getProperty(row, 'x') || 0));
    gsap.timeline({
      scrollTrigger: {
        trigger: '.insiders', start: 'top top', end: () => '+=' + distance(),
        pin: '.insiders-pin', scrub: 0.8, invalidateOnRefresh: true, anticipatePin: 1,
      },
    }).to([head, row], { x: () => distance(), ease: 'none', onUpdate: tintPeople });
    gsap.utils.toArray('.person img').forEach((img) => {
      gsap.fromTo(img, { xPercent: -6 }, { xPercent: 6, ease: 'none', scrollTrigger: { trigger: '.insiders', start: 'top top', end: () => '+=' + distance(), scrub: true, invalidateOnRefresh: true } });
    });
  });
  gsap.from('.person', { y: 80, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: 0.08, scrollTrigger: { trigger: '.insiders', start: 'top 70%' } });

  /* ---- how it works: the line draws, each number lights up as it is reached ---- */
  const howLine = document.querySelector('.how-line');
  const howSteps = document.querySelectorAll('.how-step');
  ScrollTrigger.create({
    trigger: '.how-wrap', start: 'top 70%', end: 'bottom 55%', scrub: 0.6,
    onUpdate: (self) => {
      howLine.style.setProperty('--p', self.progress.toFixed(3));
      howSteps.forEach((st, k) => st.classList.toggle('on', self.progress >= k / (howSteps.length - 1) - 0.02));
    },
  });
  gsap.from('.how-step', { y: 40, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.12, scrollTrigger: { trigger: '.how-wrap', start: 'top 80%' } });

  /* ---- faq ---- */
  gsap.from('.faq details', { y: 30, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.07, scrollTrigger: { trigger: '.faq-list', start: 'top 85%' } });

  /* ---- final: bull & bear meet ---- */
  gsap.timeline({ scrollTrigger: { trigger: '.final', start: 'top 85%', end: 'top 15%', scrub: 1 } })
    .fromTo('.em-bull', { xPercent: -70, rotate: -18, opacity: 0 }, { xPercent: 0, rotate: 0, opacity: 1, ease: 'power2.out' }, 0)
    .fromTo('.em-bear', { xPercent: 70, rotate: 18, opacity: 0 }, { xPercent: 0, rotate: 0, opacity: 1, ease: 'power2.out' }, 0)
    .fromTo('.final-glow', { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, ease: 'none' }, 0);
  gsap.from('.final-title, .final-sub, .final .store-btn', {
    y: 50, opacity: 0, duration: 1.3, ease: 'expo.out', stagger: 0.1,
    scrollTrigger: { trigger: '.final-title', start: 'top 88%' },
  });

  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
