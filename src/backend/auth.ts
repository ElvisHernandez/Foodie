import { Router } from 'express';
import * as client from 'openid-client';
import { getEnvVar } from './env.js';
import jwt from 'jsonwebtoken';
import { createOrUpdateUserAuthToken, getOAuthConfig, getOAuthParams, OAuthState, oauthStore } from './authUtils.js';

export const authRouter = Router();

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


