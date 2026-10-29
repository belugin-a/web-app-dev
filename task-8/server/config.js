// Загружаем .env, если он есть. Файла может не быть — это нормально:
// значения по умолчанию подходят для локального запуска.
try {
  process.loadEnvFile();
} catch {
  // .env отсутствует — работаем на значениях по умолчанию.
}

export const config = {
  port: Number(process.env.PORT) || 3000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/web-app-dev',
  appName: 'task-8-user-profiles',
};
