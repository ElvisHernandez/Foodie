import { Router, Response } from 'express';
import * as client from 'openid-client';
import { v4 as uuid } from 'uuid';
import { getEnvVar } from './env.js';
import { prisma } from './prisma.js';
import jwt from 'jsonwebtoken';

export const authRouter = Router();

type OAuthState = {
	code_verifier: string;
	state: string | undefined;
};

const oauthStore: Record<string, OAuthState> = {};

authRouter.get('/google/signin', async (_, res) => {
	let redirectUrl: URL | null = null;
	let statusCode = 200;

	try {
		const config = await getOAuthConfig();
		const { parameters, oauthStateId } = await getOAuthParams(config);

		res.cookie('oauth_state', oauthStateId, {
			httpOnly: true,
			secure: false,
			sameSite: 'lax',
		});

		redirectUrl = client.buildAuthorizationUrl(config, parameters);
	}
	catch (e) {
		console.error(e);
		statusCode = 500;
	}

	if (redirectUrl) {
		res.redirect(redirectUrl.toString());
		return;
	}

	res.status(statusCode).json({ redirectUrl });
});

authRouter.get('/google/callback', async (req, res) => {
	const oauthStateUuid = req.cookies['oauth_state'];

	if (!oauthStateUuid) {
		res.status(400).json({ error: 'Invalid or missing OAuth state' });
		return;
	}

	try {
		const currentUrl = new URL(`${req.protocol}://${req.get('host')}${req.originalUrl}`);
		const config = await getOAuthConfig();
		const oauthState = oauthStore[oauthStateUuid] as OAuthState;
		const tokens = await client.authorizationCodeGrant(
			config,
			currentUrl,
			{
				pkceCodeVerifier: oauthState.code_verifier,
				expectedState: oauthState.state,
			}
		);

		const { access_token } = tokens;
		const { sub } = tokens.claims() ?? {};

		if (!access_token || !sub) {
			res.status(500).json({ error: 'Access token or sub not present' });
			return;
		}

		const { email } = await client.fetchUserInfo(config, access_token, sub);

		if (!email) {
			res.status(500).json({ error: 'email undefined for user' });
			return;
		}

		await createOrUpdateUserAuthToken(email, tokens);

		const jwtToken = jwt.sign(
			{ email },
			getEnvVar('JWT_SECRET'),
			{
				expiresIn: tokens.expires_in!
			}
		);

		res.redirect(`http://localhost:3000?auth_token=${jwtToken}`);
	}
	catch (e) {
		console.error(e);
		res.status(500).json({ error: 'Authentication failed. Please try again.' });
	}
	finally {
		delete oauthStore[oauthStateUuid];
	}
});

async function createOrUpdateUserAuthToken(email: string, tokens: client.TokenEndpointResponse) {
	await prisma.$transaction(async (tx) => {
		const user = await tx.user.upsert({
			where: { email },
			create: { email },
			update: {},
		});

		const accessTokenExpiration = Number(new Date()) + (tokens.expires_in! * 1000);

		const tokenFields = {
			userId: user.id,
			accessToken: tokens.access_token,
			accessTokenExpiration: new Date(accessTokenExpiration).toISOString(),
			refreshToken: tokens.refresh_token!,
			revoked: false,
		}

		await tx.token.upsert({
			where: { userId: user.id },
			update: { ...tokenFields },
			create: { ...tokenFields }
		});
	});
}

async function getOAuthConfig() {
	const config: client.Configuration = await client.discovery(
		new URL("https://accounts.google.com/.well-known/openid-configuration"),
		getEnvVar('GOOGLE_OAUTH_CLIENT_ID'),
		getEnvVar('GOOGLE_OAUTH_CLIENT_SECRET'),
	);

	return config;
}

async function getOAuthParams(config: client.Configuration) {
	const redirect_uri = 'http://localhost:4000/auth/google/callback';
	const scope = 'openid https://www.googleapis.com/auth/userinfo.email';
	const code_verifier = client.randomPKCECodeVerifier();
	const code_challenge = await client.calculatePKCECodeChallenge(code_verifier);
	let state: string | undefined;

	let parameters: Record<string, string> = {
		redirect_uri,
		scope,
		code_challenge,
		code_challenge_method: 'S256',
		access_type: 'offline',
	};

	if (!config.serverMetadata().supportsPKCE()) {
		state = client.randomState();
		parameters.state = state;
	}

	const oauthStateId = uuid();
	oauthStore[oauthStateId] = { code_verifier, state };

	return { parameters, oauthStateId };
}
