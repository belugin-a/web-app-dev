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
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  isProduction: process.env.NODE_ENV === 'production',
  appName: 'task-8-user-profiles',
};

if (!process.env.JWT_SECRET) {
  console.warn(
    'JWT_SECRET не задан — используется значение для разработки. ' +
      'Скопируйте .env.example в .env и задайте свой секрет.',
  );
}
