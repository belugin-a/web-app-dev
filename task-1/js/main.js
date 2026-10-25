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

  /* ---------- 1. Шапка: фон и прогресс прокрутки ---------- */
  const header = $('#header');
  const progressBar = $('#progressBar');

  const onScroll = () => {
    const y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 40);

    const max = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? Math.min(y / max, 1) : 0;
    progressBar.style.width = `${ratio * 100}%`;
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- 2. Мобильное меню ---------- */
  const burger = $('#burger');
  const nav = $('#nav');

  const setMenu = (open) => {
    nav.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  };

  burger.addEventListener('click', () => {
    setMenu(burger.getAttribute('aria-expanded') !== 'true');
  });

  $$('a', nav).forEach((link) => link.addEventListener('click', () => setMenu(false)));

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && nav.classList.contains('is-open')) {
      setMenu(false);
      burger.focus();
    }
  });

  /* ---------- 3. Активный раздел в меню ---------- */
  const sections = $$('main section[id]');
  const navLinks = $$('.nav a');

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

    // на самом верху страницы не подсвечиваем раздел
    window.addEventListener('scroll', () => {
      if (window.scrollY < 200) navLinks.forEach((link) => link.classList.remove('is-active'));
    }, { passive: true });
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
  let currentShot = 0;
  let lastFocused = null;

  const showShot = (index) => {
    currentShot = (index + shots.length) % shots.length;
    const shot = shots[currentShot];
    const img = $('img', shot);
    lightboxImg.src = shot.dataset.full;
    lightboxImg.alt = img ? img.alt : '';
    lightboxCaption.textContent = shot.dataset.caption || '';
  };

  const openLightbox = (index) => {
    lastFocused = document.activeElement;
    showShot(index);
    lightbox.hidden = false;
    requestAnimationFrame(() => lightbox.classList.add('is-open'));
    document.body.style.overflow = 'hidden';
    $('.lightbox__close').focus();
  };

  const closeLightbox = () => {
    lightbox.classList.remove('is-open');
    document.body.style.overflow = '';
    window.setTimeout(() => { lightbox.hidden = true; }, 250);
    if (lastFocused) lastFocused.focus();
  };

  shots.forEach((shot, index) => {
    shot.addEventListener('click', () => openLightbox(index));
  });

  $('.lightbox__close').addEventListener('click', closeLightbox);
  $('.lightbox__nav--prev').addEventListener('click', () => showShot(currentShot - 1));
  $('.lightbox__nav--next').addEventListener('click', () => showShot(currentShot + 1));
  lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox) closeLightbox();
  });

  document.addEventListener('keydown', (event) => {
    if (lightbox.hidden) return;
    if (event.key === 'Escape') closeLightbox();
    if (event.key === 'ArrowLeft') showShot(currentShot - 1);
    if (event.key === 'ArrowRight') showShot(currentShot + 1);
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

    const paint = () => {
      const duration = audio.duration;
      fill.style.width = duration ? `${(audio.currentTime / duration) * 100}%` : '0%';
      time.textContent = fmt(audio.currentTime || duration || 0);
    };

    const stop = () => {
      audio.pause();
      root.classList.remove('is-playing');
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

    audio.addEventListener('play', () => root.classList.add('is-playing'));
    audio.addEventListener('pause', () => root.classList.remove('is-playing'));
    audio.addEventListener('ended', () => { audio.currentTime = 0; paint(); });
    audio.addEventListener('loadedmetadata', () => {
      time.textContent = fmt(audio.duration);
    });
    audio.addEventListener('timeupdate', paint);

    bar.addEventListener('click', (event) => {
      if (!audio.duration) return;
      const rect = bar.getBoundingClientRect();
      audio.currentTime = ((event.clientX - rect.left) / rect.width) * audio.duration;
      paint();
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
