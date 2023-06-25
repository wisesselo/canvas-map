import express, { json, urlencoded } from 'express';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import indexRouter from './routes/index.js';

// Set up server
const app = express();
const port = process.env.PORT || 3000;

// Express middleware
app.use(json());
app.use(urlencoded({ extended: false }));

// Set up __dirname for ES6 modules and define routes
const __dirname = dirname(fileURLToPath(import.meta.url));
app.use(express.static(join(__dirname, 'public')));
app.use('/', indexRouter);

// Start server
app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})

export default app;
