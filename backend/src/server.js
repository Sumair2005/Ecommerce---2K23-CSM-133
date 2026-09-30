require('dotenv').config();
const createApp = require('./app');
const pool = require('./db/pool');

const app = createApp(pool);
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`PageHaven backend listening on port ${PORT}`);
});
