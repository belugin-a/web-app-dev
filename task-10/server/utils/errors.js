/**
 * Типизированные ошибки приложения.
 *
 * Слой бизнес-логики бросает их с готовым HTTP-статусом, а слой
 * маршрутизации превращает в ответ. Благодаря этому слои не зависят
 * друг от друга напрямую: бизнес-логика ничего не знает про Express.
 */

/** Ошибка с HTTP-статусом. Бросается из async-обработчиков. */
export function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/** 400 — некорректные входные данные. */
export function badRequest(message = 'Некорректные данные') {
  return httpError(400, message);
}

/** 401 — пользователь не авторизован. */
export function unauthorized(message = 'Требуется вход в аккаунт') {
  return httpError(401, message);
}

/** 403 — пользователь авторизован, но прав не хватает. */
export function forbidden(message = 'Недостаточно прав') {
  return httpError(403, message);
}

/** 404 — запись не найдена. */
export function notFound(message = 'Заявка не найдена') {
  return httpError(404, message);
}

/** 409 — действие конфликтует с текущим состоянием записи. */
export function conflict(message = 'Действие невозможно в текущем состоянии') {
  return httpError(409, message);
}

/** 429 — слишком много попыток, действие временно недоступно. */
export function tooManyRequests(message = 'Слишком много попыток, попробуйте позже') {
  return httpError(429, message);
}
