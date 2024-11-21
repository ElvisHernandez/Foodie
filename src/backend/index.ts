import express, { NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { authRouter } from './auth/routes.js';
import { isAuthenticated, validateToken } from './auth/middleware.js';
import swaggerUi from 'swagger-ui-express';
import path from 'path';
import fs from 'fs';
import { createServer } from 'node:http';
import { Server } from 'socket.io';

const app = express();

app.use(cors());
app.use(cookieParser());

const server = createServer(app);
const io = new Server(server, {
	cors: {
		origin: '*'
	}
});

io.use(async (socket, next) => {
	const authToken = socket.handshake.auth?.token;
	const validatedToken = await validateToken(authToken);

	if (validatedToken) {
		console.log('Token was validated!!!');
		next();
	}
	else {
		console.log('Token failed validation!!!');
	}
});

io.on('connection', (socket) => {
	console.log('a user connected');
});

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

server.listen(PORT, () => {
	console.log(`listening on port ${PORT}`);
});
