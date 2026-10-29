import { app } from './app.js';
import { config } from './config.js';
import { connectDb, disconnectDb } from './db.js';

try {
  await connectDb();
  console.log(`MongoDB: подключено (${config.mongoUri})`);
} catch (err) {
  console.error('Не удалось подключиться к MongoDB.');
  console.error(`URI: ${config.mongoUri}`);
  console.error(`Причина: ${err.message}`);
  console.error('Проверьте, что служба MongoDB запущена, и значение MONGODB_URI в .env.');
  process.exit(1);
}

const server = app.listen(config.port, () => {
  console.log(`ПР8: сервер запущен — http://127.0.0.1:${config.port}`);
  console.log(`      проверка живости — http://127.0.0.1:${config.port}/api/health`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Порт ${config.port} уже занят. Укажите другой в .env: PORT=3001`);
  } else {
    console.error(err);
  }
  process.exit(1);
});

// Аккуратно закрываем сервер и соединение с БД по Ctrl+C,
// чтобы порт и подключение освобождались сразу.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    console.log('\nОстанавливаю сервер…');
    server.close(async () => {
      await disconnectDb();
      process.exit(0);
    });
  });
}
