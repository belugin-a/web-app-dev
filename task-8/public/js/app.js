import { api } from './api.js';
import { clearSession, getSession, setSession } from './store.js';
import { clearFormError, setFormBusy, showFormError, toast } from './ui.js';
import {
  editTemplate,
  errorTemplate,
  homeTemplate,
  loadingTemplate,
  notFoundTemplate,
  profileTemplate,
  usersTemplate,
} from './views.js';

const appEl = document.getElementById('app');
const headerEl = document.getElementById('header');
const dialogEl = document.getElementById('confirm-dialog');
const dialogTextEl = document.getElementById('confirm-text');

const USERS_ICON = `
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
    <circle cx="9" cy="8.5" r="3.2" stroke="currentColor" stroke-width="1.8" />
    <path d="M3.2 19.2c0-2.9 2.6-5 5.8-5s5.8 2.1 5.8 5"
          stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    <path d="M15.4 5.6a3.2 3.2 0 0 1 0 5.8"
          stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    <path d="M17.4 14.6c2.1.7 3.4 2.3 3.4 4.6"
          stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
  </svg>
`;

let session = getSession();
let authMode = 'login';
let users = [];
let renderId = 0;
let userToDelete = null;

function routeFromHash() {
  const hash = location.hash.replace(/^#/, '') || '/';

  if (hash === '/users') {
    return { page: 'users' };
  }

  // Прямые ссылки на формы — чтобы на регистрацию можно было вести ссылкой.
  if (hash === '/register' || hash === '/login') {
    return { page: 'home', authMode: hash === '/register' ? 'register' : 'login' };
  }

  const edit = /^\/u\/([^/]+)\/edit$/.exec(hash);
  if (edit) {
    return { page: 'edit', id: edit[1] };
  }

  const profile = /^\/u\/([^/]+)$/.exec(hash);
  return profile ? { page: 'profile', id: profile[1] } : { page: 'home' };
}

function navigate(hash) {
  if (location.hash === hash) {
    render();
    return;
  }

  location.hash = hash;
}

function renderHeader() {
  headerEl.innerHTML = `
    <div class="topbar__inner">
      <a class="brand" href="#/">
        <span class="brand__icon">${USERS_ICON}</span>
        <span class="brand__title">Профили пользователей</span>
      </a>
      <nav class="nav">
        <a class="nav__link" href="#/users">Все профили</a>
        ${
          session
            ? `<a class="nav__link" href="#/u/${encodeURIComponent(session.id)}">Мой профиль</a>
               <button class="btn btn--ghost btn--sm" type="button" data-action="logout">Выйти</button>`
            : ''
        }
      </nav>
    </div>
  `;
}

async function render() {
  const token = ++renderId;
  const route = routeFromHash();

  renderHeader();

  if (route.page === 'users') {
    await renderUsers(token);
    return;
  }

  if (route.page === 'profile') {
    await renderProfile(route.id, token);
    return;
  }

  if (route.page === 'edit') {
    await renderEdit(route.id, token);
    return;
  }

  authMode = route.authMode ?? 'login';
  appEl.innerHTML = homeTemplate({ session, authMode });
  bindAuth();
}

async function renderUsers(token) {
  appEl.innerHTML = loadingTemplate('Загружаем профили…');

  try {
    const data = await api.listUsers();
    if (token !== renderId) return;

    users = data.users;

    // Сессия могла остаться от удалённого профиля — тихо её сбрасываем.
    if (session && !users.some((user) => user._id === session.id)) {
      session = clearSession();
      renderHeader();
    }

    appEl.innerHTML = usersTemplate({ users, session });
  } catch (err) {
    if (token !== renderId) return;
    appEl.innerHTML = errorTemplate(err.message);
  }
}

async function renderProfile(id, token) {
  appEl.innerHTML = loadingTemplate('Загружаем профиль…');

  try {
    const { user } = await api.getUser(id);
    if (token !== renderId) return;
    renderProfileView(user);
  } catch (err) {
    if (token !== renderId) return;
    appEl.innerHTML = notFoundTemplate(err.message);
  }
}

async function renderEdit(id, token) {
  appEl.innerHTML = loadingTemplate('Загружаем профиль…');

  try {
    const { user } = await api.getUser(id);
    if (token !== renderId) return;

    renderEditView(user);
  } catch (err) {
    if (token !== renderId) return;
    appEl.innerHTML = notFoundTemplate(err.message);
  }
}

function renderEditView(user) {
  appEl.innerHTML = editTemplate({ user });
  bindAvatarForm(user);
  bindEditForm(user);
}

function renderProfileView(user) {
  const isSelf = Boolean(session && session.id === user._id);

  appEl.innerHTML = profileTemplate({ user, session, isSelf });

  document
    .querySelector('[data-action="delete"]')
    ?.addEventListener('click', () => askDelete(user));
}

function bindAuth() {
  const form = document.getElementById('auth-form');
  if (!form) return;

  for (const tab of appEl.querySelectorAll('[data-tab]')) {
    tab.addEventListener('click', () => {
      if (authMode === tab.dataset.tab) return;

      authMode = tab.dataset.tab;
      history.replaceState(null, '', authMode === 'register' ? '#/register' : '#/login');
      appEl.innerHTML = homeTemplate({ session, authMode });
      bindAuth();
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormError(form);

    const payload = Object.fromEntries(new FormData(form));
    setFormBusy(form, true);

    try {
      const { user } =
        authMode === 'register' ? await api.register(payload) : await api.login(payload);

      session = setSession(user);
      toast(authMode === 'register' ? 'Аккаунт создан' : 'Вы вошли');
      navigate(`#/u/${user._id}`);
    } catch (err) {
      showFormError(form, err.message);
      setFormBusy(form, false);
    }
  });
}

function bindAvatarForm(user) {
  const form = document.getElementById('avatar-form');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormError(form);

    const file = form.elements.avatar.files?.[0];

    if (!file) {
      showFormError(form, 'Выберите файл');
      return;
    }

    setFormBusy(form, true);

    try {
      const { user: updated } = await api.uploadAvatar(user._id, file);

      if (session?.id === updated._id) {
        session = setSession(updated);
        renderHeader();
      }

      toast('Аватар обновлён');
      renderEditView(updated);
    } catch (err) {
      showFormError(form, err.message);
      setFormBusy(form, false);
    }
  });
}

function bindEditForm(user) {
  const form = document.getElementById('edit-form');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormError(form);

    const data = new FormData(form);
    const patch = {
      name: String(data.get('name') ?? ''),
      email: String(data.get('email') ?? ''),
      about: String(data.get('about') ?? ''),
    };

    setFormBusy(form, true);

    try {
      const { user: updated } = await api.updateUser(user._id, patch);

      if (session?.id === updated._id) {
        session = setSession(updated);
        renderHeader();
      }

      toast('Профиль обновлён');
      navigate(`#/u/${updated._id}`);
    } catch (err) {
      showFormError(form, err.message);
      setFormBusy(form, false);
    }
  });
}

function askDelete(user) {
  if (!dialogEl) return;

  userToDelete = user;
  dialogEl.returnValue = '';
  dialogTextEl.textContent = `Профиль «${user.name}» будет удалён без возможности восстановления.`;
  dialogEl.showModal();
}

dialogEl?.addEventListener('close', async () => {
  if (dialogEl.returnValue !== 'confirm' || !userToDelete) return;

  const user = userToDelete;
  userToDelete = null;

  try {
    await api.deleteUser(user._id);

    if (session?.id === user._id) {
      session = clearSession();
    }

    toast('Профиль удалён');
    navigate('#/users');
  } catch (err) {
    toast(err.message, 'error');
  }
});

headerEl.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action="logout"]');
  if (!button) return;

  button.disabled = true;

  try {
    await api.logout();
  } catch {
    // Если сервер недоступен, всё равно выходим локально.
  }

  session = clearSession();
  toast('Вы вышли из аккаунта');
  navigate('#/');
});

window.addEventListener('hashchange', render);

if (!location.hash) {
  history.replaceState(null, '', '#/');
}

render();
