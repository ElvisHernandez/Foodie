import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { authRouter } from './auth/routes.js';
import { isAuthenticated } from './auth/middleware.js';

const app = express();

app.use(cors());
app.use(cookieParser());

app.get('/', isAuthenticated, (_, res) => {
	res.send('yerr');
});

app.use('/auth', authRouter);

const PORT = 4000;

app.listen(PORT, () => {
	console.log(`listening on port ${PORT}`);
});
