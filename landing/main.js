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
  const countdown = document.querySelector('[data-countdown]');
  if (countdown) {
    let secs = 12 * 60 + 41;
    setInterval(() => {
      secs = secs > 0 ? secs - 1 : 15 * 60;
      const m = Math.floor(secs / 60), s = String(secs % 60).padStart(2, '0');
      countdown.textContent = `בעוד ${m}:${s}`;
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

  // story: on mobile each step gets its own phone with its screen
  const storyPhone = document.querySelector('.story-phone');
  document.querySelectorAll('.step').forEach((step) => {
    const idx = step.dataset.step;
    const wrap = document.createElement('div');
    wrap.className = 'step-visual';
    wrap.setAttribute('aria-hidden', 'true');
    const phone = storyPhone.cloneNode(true);
    phone.classList.remove('story-phone');
    phone.querySelectorAll('.screen').forEach((s) => (s.dataset.screen === idx ? s.classList.add('is-active') : s.remove()));
    wrap.appendChild(phone);
    step.prepend(wrap);
  });

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
  const storySteps = document.querySelectorAll('.step');
  const screens = document.querySelectorAll('.story-phone .screen');
  const progress = document.querySelectorAll('.story-progress span');
  const setStep = (i) => {
    screens.forEach((s, k) => s.classList.toggle('is-active', k === i));
    storySteps.forEach((s, k) => s.classList.toggle('is-active', k === i));
    progress.forEach((p, k) => p.classList.toggle('on', k <= i));
  };
  setStep(0);

  if (!hasGsap || reduceMotion) {
    window.addEventListener('scroll', () => onScrollNav(window.scrollY), { passive: true });
    const stepIo = new IntersectionObserver((entries) => {
      entries.forEach((e) => e.isIntersecting && setStep(+e.target.dataset.step));
    }, { rootMargin: '-45% 0px -45% 0px' });
    storySteps.forEach((s) => stepIo.observe(s));
    document.querySelectorAll('[data-count]').forEach((el) => (el.textContent = el.dataset.count + (el.dataset.suffix || '')));
    document.querySelectorAll('[data-mock]').forEach((t) => t.classList.add('is-loaded'));
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

  // cursor glow
  const glow = document.querySelector('.cursor-glow');
  const gx = gsap.quickTo(glow, 'x', { duration: 0.8, ease: 'power3' });
  const gy = gsap.quickTo(glow, 'y', { duration: 0.8, ease: 'power3' });
  window.addEventListener('pointermove', (e) => { gx(e.clientX); gy(e.clientY); });

  /* ---- hero intro ---- */
  const heroPhone = document.querySelector('.hero-phone');
  const intro = gsap.timeline({ defaults: { ease: 'expo.out' } });
  intro
    .from('.nav', { y: -40, opacity: 0, duration: 1.2 })
    .from('.hero-eyebrow', { y: 20, opacity: 0, duration: 1 }, 0.1)
    .from('.hero-title .word', { yPercent: 115, rotate: -4, duration: 1.4, stagger: 0.08 }, 0.15)
    .from('.hero-sub', { y: 24, opacity: 0, duration: 1.2 }, 0.6)
    .from('.hero-stores .store-btn', { y: 24, opacity: 0, duration: 1, stagger: 0.1 }, 0.75)
    .from('.hero-note', { opacity: 0, duration: 1 }, 0.95)
    .from(heroPhone, { y: 220, rotateX: 38, rotateZ: -6, opacity: 0, duration: 2, ease: 'expo.out' }, 0.3)
    .from('.chat-list li', { x: -30, opacity: 0, duration: 0.9, stagger: 0.06 }, 1.1)
    .from('.stories-row .st', { scale: 0.4, opacity: 0, duration: 0.8, stagger: 0.05, ease: 'back.out(2)' }, 1)
    .from('.float-card', { scale: 0.6, opacity: 0, y: 30, duration: 1.1, stagger: 0.15, ease: 'back.out(1.6)' }, 1.2)
    .from('.scroll-hint', { opacity: 0, duration: 1 }, 1.6);

  // idle floating of cards
  gsap.utils.toArray('.float-card').forEach((c, i) => {
    gsap.to(c, { y: i % 2 ? 12 : -12, duration: 2.6 + i * 0.4, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 2 });
  });

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
    .to('.fc-1', { x: 80, y: -60, ease: 'none' }, 0)
    .to('.fc-2', { x: -90, ease: 'none' }, 0)
    .to('.fc-3', { x: 60, y: 60, ease: 'none' }, 0)
    .to('.hero-aurora', { yPercent: 30, opacity: 0.4, ease: 'none' }, 0);

  /* ---- manifesto word-by-word light-up ---- */
  gsap.to('.manifesto-text .w', {
    opacity: 1, ease: 'none', stagger: 0.1,
    scrollTrigger: { trigger: '.manifesto-text', start: 'top 75%', end: 'bottom 50%', scrub: 0.6 },
  });

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

  /* ---- story ---- */
  storySteps.forEach((step, i) => {
    ScrollTrigger.create({
      trigger: step,
      start: 'top 55%',
      end: 'bottom 55%',
      onToggle: (self) => self.isActive && setStep(i),
    });
  });
  gsap.from('.story-sticky .phone', {
    y: 120, rotateX: 20, opacity: 0, duration: 1.6, ease: 'expo.out',
    scrollTrigger: { trigger: '.story-grid', start: 'top 75%' },
  });
  // P&L line draws when journal screen shows
  const pnlStroke = document.querySelectorAll('.pnl-line .stroke');
  pnlStroke.forEach((p) => {
    const len = p.getTotalLength();
    p.style.strokeDasharray = len;
    p.style.strokeDashoffset = len;
  });
  const drawPnl = (root) => {
    root.querySelectorAll('.pnl-line .stroke').forEach((p) => gsap.to(p, { strokeDashoffset: 0, duration: 1.6, ease: 'power2.out' }));
    root.querySelectorAll('[data-pnl]').forEach((el) => {
      const o = { v: 0 };
      gsap.to(o, { v: 4812, duration: 1.6, ease: 'power2.out', onUpdate: () => (el.textContent = '+$' + Math.round(o.v).toLocaleString('en-US')) });
    });
  };
  ScrollTrigger.create({ trigger: '.step[data-step="2"]', start: 'top 55%', once: true, onEnter: () => drawPnl(document.querySelector('.story-phone')) });
  document.querySelectorAll('.step-visual').forEach((v) => {
    ScrollTrigger.create({ trigger: v, start: 'top 75%', once: true, onEnter: () => drawPnl(v) });
    gsap.from(v.querySelector('.phone'), { y: 80, opacity: 0, rotateX: 18, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: v, start: 'top 85%' } });
  });
  gsap.utils.toArray('.step').forEach((step) => {
    gsap.from(step.querySelectorAll('h3, .checks li'), {
      y: 40, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.07,
      scrollTrigger: { trigger: step, start: 'top 70%' },
    });
  });

  /* ---- numbers ---- */
  gsap.from('.num', { y: 60, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: 0.1, scrollTrigger: { trigger: '.numbers', start: 'top 85%' } });
  document.querySelectorAll('[data-count]').forEach((el) => {
    const o = { v: 0 }, target = +el.dataset.count, suffix = el.dataset.suffix || '';
    ScrollTrigger.create({
      trigger: el, start: 'top 90%', once: true,
      onEnter: () => gsap.to(o, { v: target, duration: 1.8, ease: 'power3.out', onUpdate: () => (el.textContent = Math.round(o.v) + suffix) }),
    });
  });

  /* ---- bento ---- */
  // hide before the batch is created: tiles already in view (restored scroll) reveal immediately
  gsap.set('.tile', { opacity: 0 });
  ScrollTrigger.batch('.tile', {
    start: 'top 88%',
    onEnter: (els) => gsap.fromTo(els, { y: 80, opacity: 0, scale: 0.96 }, { y: 0, opacity: 1, scale: 1, duration: 1.3, ease: 'expo.out', stagger: 0.1 }),
  });
  // each tile loads like the app: skeleton first, then the content fades in
  document.querySelectorAll('[data-mock]').forEach((tile, i) => {
    ScrollTrigger.create({
      trigger: tile, start: 'top 80%', once: true,
      onEnter: () => setTimeout(() => {
        tile.classList.add('is-loaded');
        const items = tile.querySelectorAll('.real-layer .n-card, .real-layer .c-card, .real-layer .t-card, .watch li, .e-tile, .heatmap i');
        gsap.from(items, { y: 10, opacity: 0, duration: 0.6, ease: 'expo.out', stagger: 0.04 });
      }, 900 + i * 120),
    });
  });

  /* ---- insiders: horizontal scroll (desktop), parallax portraits ---- */
  const mm = gsap.matchMedia();
  mm.add('(min-width: 901px)', () => {
    const head = document.querySelector('.insiders-head');
    const row = document.querySelector('.insiders-track');
    // RTL: the track runs off the left edge — slide everything right to reveal it
    const distance = () => Math.max(0, -row.lastElementChild.getBoundingClientRect().left + 48 - (gsap.getProperty(row, 'x') || 0));
    gsap.timeline({
      scrollTrigger: {
        trigger: '.insiders', start: 'top top', end: () => '+=' + distance(),
        pin: '.insiders-pin', scrub: 0.8, invalidateOnRefresh: true, anticipatePin: 1,
      },
    }).to([head, row], { x: () => distance(), ease: 'none' });
    gsap.utils.toArray('.person img').forEach((img) => {
      gsap.fromTo(img, { xPercent: -6 }, { xPercent: 6, ease: 'none', scrollTrigger: { trigger: '.insiders', start: 'top top', end: () => '+=' + distance(), scrub: true, invalidateOnRefresh: true } });
    });
  });
  gsap.from('.person', { y: 80, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: 0.08, scrollTrigger: { trigger: '.insiders', start: 'top 70%' } });

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
