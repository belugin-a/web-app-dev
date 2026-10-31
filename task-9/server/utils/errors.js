/**
 * Типизированные ошибки приложения.
 *
 * Слой бизнес-логики бросает их с готовым HTTP-статусом, а слой
 * маршрутизации превращает в ответ. Благодаря этому слои не зависят
 * друг от друга напрямую: бизнес-логика ничего не знает об Express.
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

/** 404 — запись не найдена. */
export function notFound(message = 'Заявка не найдена') {
  return httpError(404, message);
}

/** 409 — действие конфликтует с текущим состоянием записи. */
export function conflict(message = 'Действие невозможно в текущем состоянии') {
  return httpError(409, message);
}
