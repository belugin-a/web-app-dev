/**
 * Ошибка с HTTP-статусом. Бросается из async-обработчиков:
 * Express 5 сам передаёт её в централизованный error handler.
 */
export function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function notFound(message = 'Не найдено') {
  return httpError(404, message);
}

export function badRequest(message = 'Некорректный запрос') {
  return httpError(400, message);
}
