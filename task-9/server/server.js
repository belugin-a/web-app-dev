import { app } from './app.js';
import { config } from './config.js';
import { openDatabase, closeDatabase } from './db.js';
import { seedDatabase } from './scripts/seed.js';

openDatabase();
await seedDatabase();

const server = app.listen(config.port, () => {
  console.log(`ПР9: сервер запущен — http://127.0.0.1:${config.port}`);
  console.log(`      проверка живости — http://127.0.0.1:${config.port}/api/health`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Порт ${config.port} уже занят. Укажите другой: PORT=3001`);
  } else {
    console.error(err);
  }

  process.exit(1);
});

// Аккуратно закрываем сервер и соединение с БД по Ctrl+C.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    console.log('\nОстанавливаю сервер…');
    server.close(async () => {
      closeDatabase();
      process.exit(0);
    });
  });
}
