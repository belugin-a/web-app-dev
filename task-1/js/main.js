/* ============================================================
   Самарская Лука — поведение интерфейса
   Без зависимостей: меню, прогресс, появление, лайтбокс,
   аудиоплеер и видео по клику.
   ============================================================ */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* блокировка прокрутки общая для меню и лайтбокса */
  let scrollLocks = 0;
  const lockScroll = (on) => {
    scrollLocks = Math.max(0, scrollLocks + (on ? 1 : -1));
    document.documentElement.classList.toggle('is-locked', scrollLocks > 0);
  };

  /* ---------- 1. Шапка: фон и прогресс прокрутки ---------- */
  const header = $('#header');
  const progressBar = $('#progressBar');
  const navLinks = $$('.nav a');

  const onScroll = () => {
    const y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 40);

    const max = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? Math.min(y / max, 1) : 0;
    progressBar.style.width = `${ratio * 100}%`;

    // на самом верху страницы не подсвечиваем раздел
    if (y < 200) navLinks.forEach((link) => link.classList.remove('is-active'));
  };

  let scrollQueued = false;
  window.addEventListener('scroll', () => {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(() => {
      scrollQueued = false;
      onScroll();
    });
  }, { passive: true });
  onScroll();

  /* ---------- 2. Мобильное меню ---------- */
  const burger = $('#burger');
  const nav = $('#nav');

  const setMenu = (open) => {
    if (open === nav.classList.contains('is-open')) return;
    nav.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    lockScroll(open);
  };

  burger.addEventListener('click', () => {
    setMenu(burger.getAttribute('aria-expanded') !== 'true');
  });

  $$('a', nav).forEach((link) => link.addEventListener('click', () => setMenu(false)));

  // меню видно только до 820px: при расширении окна снимаем блокировку
  const wideQuery = window.matchMedia('(min-width: 821px)');
  const onWide = (event) => { if (event.matches) setMenu(false); };
  if (wideQuery.addEventListener) wideQuery.addEventListener('change', onWide);
  else if (wideQuery.addListener) wideQuery.addListener(onWide);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && nav.classList.contains('is-open')) {
      setMenu(false);
      burger.focus();
    }
  });

  /* ---------- 3. Активный раздел в меню ---------- */
  const sections = $$('main section[id]');

  if ('IntersectionObserver' in window) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = entry.target.id;
        navLinks.forEach((link) => {
          link.classList.toggle('is-active', link.getAttribute('href') === `#${id}`);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    sections.forEach((section) => spy.observe(section));
  }

  /* ---------- 4. Появление блоков ---------- */
  const revealItems = $$('.reveal');

  if (reduced || !('IntersectionObserver' in window)) {
    revealItems.forEach((el) => el.classList.add('is-in'));
  } else {
    const revealer = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry, i) => {
        if (!entry.isIntersecting) return;
        setTimeout(() => entry.target.classList.add('is-in'), i * 90);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.18 });

    revealItems.forEach((el) => revealer.observe(el));
  }

  /* ---------- 5. Лайтбокс ---------- */
  const shots = $$('.shot');
  const lightbox = $('#lightbox');
  const lightboxImg = $('#lightboxImg');
  const lightboxCaption = $('#lightboxCaption');
  const closeBtn = $('.lightbox__close');
  const prevBtn = $('.lightbox__nav--prev');
  const nextBtn = $('.lightbox__nav--next');
  const pageRegions = $$('.skip-link, #header, main, .footer');
  let currentShot = 0;
  let lastFocused = null;
  let lightboxOpen = false;

  const showShot = (index) => {
    currentShot = (index + shots.length) % shots.length;
    const shot = shots[currentShot];
    const img = $('img', shot);
    lightboxImg.src = shot.dataset.full;
    lightboxImg.alt = img ? img.alt : '';
    lightboxCaption.textContent = shot.dataset.caption || '';
  };

  const openLightbox = (index) => {
    if (lightboxOpen) return;
    lightboxOpen = true;
    showShot(index);
    lastFocused = shots[currentShot];
    lightbox.hidden = false;
    pageRegions.forEach((el) => { el.inert = true; });
    requestAnimationFrame(() => lightbox.classList.add('is-open'));
    lockScroll(true);
    closeBtn.focus();
  };

  const closeLightbox = () => {
    if (!lightboxOpen) return;
    lightboxOpen = false;
    lightbox.classList.remove('is-open');
    pageRegions.forEach((el) => { el.inert = false; });
    lockScroll(false);
    window.setTimeout(() => {
      if (!lightboxOpen) lightbox.hidden = true;
    }, 250);
    if (lastFocused) lastFocused.focus();
  };

  shots.forEach((shot, index) => {
    shot.addEventListener('click', () => openLightbox(index));
  });

  closeBtn.addEventListener('click', closeLightbox);
  prevBtn.addEventListener('click', () => showShot(currentShot - 1));
  nextBtn.addEventListener('click', () => showShot(currentShot + 1));
  lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox) closeLightbox();
  });

  document.addEventListener('keydown', (event) => {
    if (!lightboxOpen) return;
    if (event.key === 'Escape') {
      closeLightbox();
      return;
    }
    if (event.key === 'ArrowLeft') showShot(currentShot - 1);
    if (event.key === 'ArrowRight') showShot(currentShot + 1);

    // фокус не должен уходить на страницу под лайтбоксом
    if (event.key === 'Tab') {
      const focusables = $$('button, [href], [tabindex]:not([tabindex="-1"])', lightbox)
        .filter((el) => !el.disabled && el.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  /* ---------- 6. Аудиоплеер ---------- */
  const fmt = (seconds) => {
    if (!Number.isFinite(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const tracks = $$('.track').map((root) => {
    const audio = new Audio();
    audio.preload = 'none';
    audio.src = root.dataset.src;

    const button = $('.track__play', root);
    const time = $('[data-time]', root);
    const bar = $('[data-bar]', root);
    const fill = $('[data-fill]', root);
    const name = $('.track__name', root).textContent.trim();

    const setButtonLabel = () => {
      button.setAttribute('aria-label', audio.paused
        ? `Слушать трек «${name}»`
        : `Пауза — трек «${name}»`);
    };

    const paint = () => {
      const duration = audio.duration;
      fill.style.width = duration ? `${(audio.currentTime / duration) * 100}%` : '0%';
      time.textContent = fmt(audio.currentTime || duration || 0);
      bar.setAttribute('aria-valuenow', duration ? String(Math.round((audio.currentTime / duration) * 100)) : '0');
      bar.setAttribute('aria-valuetext', `${fmt(audio.currentTime)} из ${fmt(duration)}`);
    };

    const stop = () => {
      audio.pause();
      root.classList.remove('is-playing');
    };

    const seek = (seconds) => {
      if (!audio.duration) return;
      audio.currentTime = Math.min(Math.max(seconds, 0), audio.duration);
      paint();
    };

    button.addEventListener('click', () => {
      if (audio.paused) {
        tracks.forEach((other) => other !== api && other.stop());
        audio.play().catch(() => {
          time.textContent = 'н/д';
        });
      } else {
        audio.pause();
      }
    });

    audio.addEventListener('play', () => {
      root.classList.add('is-playing');
      setButtonLabel();
    });
    audio.addEventListener('pause', () => {
      root.classList.remove('is-playing');
      setButtonLabel();
    });
    audio.addEventListener('ended', () => { audio.currentTime = 0; paint(); });
    audio.addEventListener('loadedmetadata', () => {
      time.textContent = fmt(audio.duration);
      paint();
    });
    audio.addEventListener('timeupdate', paint);

    bar.addEventListener('click', (event) => {
      if (!audio.duration) return;
      const rect = bar.getBoundingClientRect();
      audio.currentTime = ((event.clientX - rect.left) / rect.width) * audio.duration;
      paint();
    });

    bar.addEventListener('keydown', (event) => {
      if (!audio.duration) return;
      const step = { ArrowRight: 5, ArrowLeft: -5, PageUp: 10, PageDown: -10 }[event.key];
      if (step) {
        event.preventDefault();
        seek(audio.currentTime + step);
      } else if (event.key === 'Home') {
        event.preventDefault();
        seek(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        seek(audio.duration);
      }
    });

    const api = { root, audio, stop };
    return api;
  });

  /* ---------- 7. Видео по клику ---------- */
  const videoButton = $('#videoBtn');

  videoButton.addEventListener('click', () => {
    const video = document.createElement('video');
    video.src = 'assets/img/clip.mp4';
    video.poster = 'assets/img/video-poster.webp';
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    video.className = 'video__player';
    video.setAttribute('aria-label', 'Видео о Самарской Луке');

    videoButton.replaceWith(video);
    video.play().catch(() => {});
  });
})();
