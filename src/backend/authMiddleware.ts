import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import * as client from 'openid-client';
import { getEnvVar } from './env.js';
import { prisma } from './prisma.js';
import { createOrUpdateUserAuthToken, getOAuthConfig, getOAuthParams } from './authUtils.js';

export async function isAuthenticated(req: Request, res: Response, next: NextFunction) {
	const authHeader = req.get('Authorization') || '';
	const authToken = authHeader.split('Bearer ')?.[1];

	if (!authToken) {
		res.status(403).json({ error: 'Unauthenticated' });
		return;
	}

	try {
		jwt.verify(authToken, getEnvVar('JWT_SECRET'));
		next();
	}
	catch (e) {
		if (e instanceof jwt.TokenExpiredError) {
			await refreshExpiredTokens(authToken, res);
			next();
		}
		else {
			console.error(e);
			res.status(403).json({ error: 'Unauthenticated' });
		}
	}
}

async function refreshExpiredTokens(authToken: string, res: Response) {
	try {
		const decoded = decodeJwtPayload(authToken);
		const email = decoded?.email || '';
		const user = await prisma.user.findUnique({
			where: { email },
			include: { token: true },
		});

		const oauthConfig = await getOAuthConfig();
		const { parameters } = await getOAuthParams(oauthConfig);

		if (!user?.token?.refreshToken) {
			throw new Error(`Was not able to retrieve access token for ${email}`);
		}

		const refreshedTokens = await client.refreshTokenGrant(
			oauthConfig,
			user.token.refreshToken,
			parameters
		);

		const tokens = {
			access_token: refreshedTokens.access_token,
			expires_in: refreshedTokens.expires_in,
			refresh_token: user.token.refreshToken,
		} as client.TokenEndpointResponse;

		await createOrUpdateUserAuthToken(email, tokens);

		const jwtToken = jwt.sign(
			{ email },
			getEnvVar('JWT_SECRET'),
			{
				expiresIn: refreshedTokens.expires_in!
			}
		);
		res.set('Authorization', `Bearer ${jwtToken}`);
	}
	catch (e) {
		console.error(e);
		res.status(403).json({ error: 'Unauthenticated' });
		return;
	}
}

const decodeJwtPayload = (authToken: string) => {
	if (!authToken) return;

	const base64UrlEncodedPayload = authToken.split('.')[1];
	const base64EncodedPayload = base64UrlEncodedPayload
		.replace(/-/g, '+')
		.replace(/_/g, '/');
	const jsonPayload = atob(base64EncodedPayload);
	const payload = JSON.parse(jsonPayload);

	return payload;
}
