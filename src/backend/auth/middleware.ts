import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import * as client from 'openid-client';
import { createOrUpdateUserAuthToken, getOAuthConfig, getOAuthParams } from './utils.js';
import { getEnvVar } from '../env.js';
import { prisma } from '../prisma.js';

export async function isAuthenticated(req: Request, res: Response, next: NextFunction) {
	const authHeader = req.get('Authorization') || '';
	const authToken = authHeader.split('Bearer ')?.[1];

	const validatedToken = await validateToken(authToken);

	if (validatedToken) {
		res.set('Authorization', `Bearer ${validatedToken}`);
		return next();
	}

	res.status(403).json({ error: 'Unauthenticated' });
}

export async function validateToken(authToken?: string) {
	if (!authToken) return;

	// Return original auth token if it passes validation. If the 
	// token is expired then try to refresh and return new token.
	try {
		jwt.verify(authToken, getEnvVar('JWT_SECRET'));
		return authToken;
	}
	catch (e) {
		if (e instanceof jwt.TokenExpiredError) {
			return await refreshExpiredTokens(authToken);
		}
		else {
			console.error(e);
		}
	}
}

async function refreshExpiredTokens(authToken: string) {
	try {
		const decoded = decodeJwtPayload(authToken);
		const email = decoded?.email || '';
		const user = await prisma.user.findUnique({
			where: { email },
			include: { token: true },
		});

		if (!user?.token?.refreshToken) {
			throw new Error(`Was not able to retrieve access token for ${email}`);
		}

		const oauthConfig = await getOAuthConfig();
		const { parameters } = await getOAuthParams(oauthConfig);
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

		return jwtToken;
	}
	catch (e) {
		console.error(e);
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
