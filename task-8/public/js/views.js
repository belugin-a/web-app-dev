import { avatarHtml, escapeHtml, formatDate, shortId } from './ui.js';

function authTemplate(mode) {
  const isRegister = mode === 'register';

  return `
    <section class="card">
      <div class="tabs" role="tablist" aria-label="Вход или регистрация">
        <button type="button" class="tab ${isRegister ? '' : 'is-active'}"
                data-tab="login" role="tab" aria-selected="${!isRegister}">Вход</button>
        <button type="button" class="tab ${isRegister ? 'is-active' : ''}"
                data-tab="register" role="tab" aria-selected="${isRegister}">Регистрация</button>
      </div>

      <form id="auth-form" class="form" data-mode="${mode}">
        ${
          isRegister
            ? `<label class="field">
                 <span class="field__label">Имя</span>
                 <input name="name" type="text" maxlength="60" autocomplete="name"
                        required placeholder="Как вас зовут" />
               </label>`
            : ''
        }

        <label class="field">
          <span class="field__label">E-mail</span>
          <input name="email" type="email" maxlength="254" autocomplete="email"
                 required placeholder="you@example.com" />
        </label>

        <label class="field">
          <span class="field__label">Пароль</span>
          <input name="password" type="password" minlength="8" maxlength="72"
                 autocomplete="${isRegister ? 'new-password' : 'current-password'}"
                 required placeholder="Минимум 8 символов" />
        </label>

        <p class="form__error" hidden></p>

        <button class="btn btn--primary" type="submit">
          ${isRegister ? 'Создать аккаунт' : 'Войти'}
        </button>
      </form>
    </section>
  `;
}

function signedInTemplate(session) {
  return `
    <section class="card">
      <div class="welcome">
        ${avatarHtml({ name: session.name }, 'md')}
        <div>
          <p class="welcome__eyebrow">Вы вошли как</p>
          <p class="welcome__name">${escapeHtml(session.name)}</p>
        </div>
      </div>

      <div class="actions">
        <a class="btn btn--primary" href="#/u/${encodeURIComponent(session.id)}">Мой профиль</a>
        <a class="btn" href="#/users">Все профили</a>
      </div>
    </section>
  `;
}

export function homeTemplate({ session, authMode }) {
  return `
    <div class="narrow">
      ${session ? signedInTemplate(session) : authTemplate(authMode)}
    </div>
  `;
}

export function usersTemplate({ users, session }) {
  const content =
    users.length === 0
      ? `<p class="empty">
           Пока ни одного профиля. <a href="#/register">Зарегистрируйтесь</a> — и он появится здесь.
         </p>`
      : `<ul class="user-grid">
          ${users
            .map((user) => {
              const isMe = session && session.id === user._id;

              return `
                <li>
                  <a class="user-card" href="#/u/${encodeURIComponent(user._id)}">
                    ${avatarHtml(user, 'md')}
                    <span class="user-card__body">
                      <span class="user-card__name">${escapeHtml(user.name)}</span>
                      ${user.about ? `<span class="user-card__meta">${escapeHtml(user.about)}</span>` : ''}
                      <span class="user-card__id">
                        ID ${escapeHtml(shortId(user._id))}${isMe ? ' · это вы' : ''}
                      </span>
                    </span>
                    <span class="user-card__arrow" aria-hidden="true">→</span>
                  </a>
                </li>
              `;
            })
            .join('')}
        </ul>`;

  return `
    <div class="page-head">
      <h1>Все профили</h1>
      <span class="count">${users.length}</span>
    </div>
    <section class="card">${content}</section>
  `;
}

export function profileTemplate({ user, session, isSelf }) {
  const facts = [
    ['О себе', user.about || '—'],
    ['E-mail', user.email ?? '—'],
    ['Дата регистрации', formatDate(user.createdAt)],
    ['Идентификатор', user._id],
  ];

  const factsHtml = facts
    .map(
      ([term, value]) => `
        <div>
          <dt>${escapeHtml(term)}</dt>
          <dd>${escapeHtml(value)}</dd>
        </div>
      `,
    )
    .join('');

  return `
    <a class="back" href="#/users">← Все профили</a>

    <section class="card profile">
      <div class="profile__head">
        ${avatarHtml(user, 'lg')}
        <div class="profile__title">
          <h1>${escapeHtml(user.name)}</h1>
          <p class="profile__id">ID ${escapeHtml(shortId(user._id))}${isSelf ? ' · это вы' : ''}</p>
        </div>
      </div>
      <dl class="facts">${factsHtml}</dl>
    </section>

    <div class="profile-actions">
      <a class="btn btn--primary" href="#/u/${encodeURIComponent(user._id)}/edit">Изменить</a>
      <button class="btn btn--danger" type="button" data-action="delete">Удалить</button>
    </div>
  `;
}

export function editTemplate({ user }) {
  return `
    <a class="back" href="#/u/${encodeURIComponent(user._id)}">← К профилю</a>

    <div class="medium">
      <div class="page-head">
        <h1>Изменить профиль</h1>
      </div>

      <section class="card">
        <h2>Аватар</h2>
        <div class="avatar-editor">
          ${avatarHtml(user, 'lg')}
          <form id="avatar-form" class="form">
            <label class="field">
              <span class="field__label">Новый аватар</span>
              <input name="avatar" type="file" accept="image/png,image/jpeg,image/webp" required />
            </label>
            <p class="hint">PNG, JPEG или WebP, не больше 2 МБ.</p>
            <p class="form__error" hidden></p>
            <button class="btn" type="submit">Загрузить аватар</button>
          </form>
        </div>
      </section>

      <section class="card">
        <form id="edit-form" class="form">
          <div class="form__row">
            <label class="field">
              <span class="field__label">Имя</span>
              <input name="name" type="text" maxlength="60" required value="${escapeHtml(user.name)}" />
            </label>

            <label class="field">
              <span class="field__label">E-mail</span>
              <input name="email" type="email" maxlength="254" required value="${escapeHtml(user.email)}" />
            </label>
          </div>

          <label class="field">
            <span class="field__label">О себе</span>
            <textarea name="about" rows="5" maxlength="500"
                      placeholder="Пара слов о себе">${escapeHtml(user.about)}</textarea>
          </label>

          <p class="form__error" hidden></p>

          <div class="actions">
            <button class="btn btn--primary" type="submit">Сохранить</button>
            <a class="btn" href="#/u/${encodeURIComponent(user._id)}">Отмена</a>
          </div>
        </form>
      </section>
    </div>
  `;
}

export function notFoundTemplate(message) {
  return `
    <a class="back" href="#/users">← Все профили</a>
    <section class="card">
      <h1>Профиль недоступен</h1>
      <p class="lead">${escapeHtml(message)}</p>
      <a class="btn btn--primary" href="#/">На главную</a>
    </section>
  `;
}

export function errorTemplate(message) {
  return `
    <section class="card">
      <h1>Что-то пошло не так</h1>
      <p class="lead">${escapeHtml(message)}</p>
      <a class="btn btn--primary" href="#/">На главную</a>
    </section>
  `;
}

export function loadingTemplate(message = 'Загрузка…') {
  return `<p class="loading"><span class="spinner" aria-hidden="true"></span>${escapeHtml(message)}</p>`;
}
