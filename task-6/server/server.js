import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, '..');

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.static(path.join(projectRoot, 'public')));
app.use('/data', express.static(path.join(projectRoot, 'data')));

app.listen(port, () => {
  console.log(`Табло авиарейсов: http://localhost:${port}`);
});
