import { app } from './app.js';
import { config } from './config.js';

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

// Аккуратно закрываем сервер по Ctrl+C, чтобы порт освобождался сразу.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log('\nОстанавливаю сервер…');
    server.close(() => process.exit(0));
  });
}
