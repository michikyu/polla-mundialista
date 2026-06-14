import { app } from './app';

const PORT = 4517;

app.listen(PORT, '127.0.0.1', () => {
  console.log(`API de la polla escuchando en http://localhost:${PORT}`);
});
