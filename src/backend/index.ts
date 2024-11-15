import express from 'express';
import * as client from 'openid-client';
import { getEnvVar } from './env.js';
import cors from 'cors';

const app = express();

app.use(cors());

app.get('/', (_, res) => {
	res.send('yerr');
});

let code_verifier = '';
let state: string | undefined;

app.get('/auth/google/url', async (_, res) => {
	let redirectUrl: URL | null = null;
	let statusCode = 200;

	try {
		const config: client.Configuration = await client.discovery(
			new URL("https://accounts.google.com/.well-known/openid-configuration"),
			getEnvVar('GOOGLE_OAUTH_CLIENT_ID'),
			getEnvVar('GOOGLE_OAUTH_CLIENT_SECRET')
		);

		const redirect_uri = 'http://localhost:4000/auth/google/callback';
		const scope = 'openid https://www.googleapis.com/auth/userinfo.email';
		code_verifier = client.randomPKCECodeVerifier();
		const code_challenge = await client.calculatePKCECodeChallenge(code_verifier);

		let parameters: Record<string, string> = {
			redirect_uri,
			scope,
			code_challenge,
			code_challenge_method: 'S256',
		};

		if (!config.serverMetadata().supportsPKCE()) {
			state = client.randomState();
			parameters.state = state;
		}

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

app.get('/auth/google/callback', async (req, res) => {
	const currentUrl = new URL(`${req.protocol}://${req.get('host')}${req.originalUrl}`);
	const config: client.Configuration = await client.discovery(
		new URL("https://accounts.google.com/.well-known/openid-configuration"),
		getEnvVar('GOOGLE_OAUTH_CLIENT_ID'),
		getEnvVar('GOOGLE_OAUTH_CLIENT_SECRET'),
	);
	const tokens = await client.authorizationCodeGrant(
		config,
		currentUrl,
		{
			pkceCodeVerifier: code_verifier,
			expectedState: state,
		}
	);

	console.log({ tokens });
	console.log(tokens.claims());
	const { access_token } = tokens;
	const sub = tokens.claims()?.sub;

	if (access_token && sub) {
		const userInfo = await client.fetchUserInfo(config, access_token, sub);
		console.log({ userInfo });
	}


	res.redirect('http://localhost:3000?coming_from_google_redirect=true');
});

const PORT = 4000;

app.listen(PORT, () => {
	console.log(`listening on port ${PORT}`);
});
