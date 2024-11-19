import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { authRouter } from './auth/routes.js';
import { isAuthenticated } from './auth/middleware.js';
import swaggerUi from 'swagger-ui-express';
//import swaggerDocument from '../../openapi.json';
import path from 'path';
import fs from 'fs';

const app = express();

app.use(cors());
app.use(cookieParser());

app.use('/api-docs', swaggerUi.serve,
	swaggerUi.setup(
		// @ts-ignore
		JSON.parse(fs.readFileSync(path.resolve(process.cwd(), './openapi.json')))
	)
);
app.get('/', isAuthenticated, (_, res) => {
	res.send('yerr');
});

app.use('/v1/auth', authRouter);

const PORT = 4000;

app.listen(PORT, () => {
	console.log(`listening on port ${PORT}`);
});
