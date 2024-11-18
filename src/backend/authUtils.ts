import * as client from 'openid-client';
import { v4 as uuid } from 'uuid';
import { getEnvVar } from './env.js';
import { prisma } from './prisma.js';

export type OAuthState = {
	code_verifier: string;
	state: string | undefined;
};

export const oauthStore: Record<string, OAuthState> = {};

export async function getOAuthConfig() {
	const config: client.Configuration = await client.discovery(
		new URL("https://accounts.google.com/.well-known/openid-configuration"),
		getEnvVar('GOOGLE_OAUTH_CLIENT_ID'),
		getEnvVar('GOOGLE_OAUTH_CLIENT_SECRET'),
	);

	return config;
}

export async function getOAuthParams(config: client.Configuration) {
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

export async function createOrUpdateUserAuthToken(email: string, tokens: client.TokenEndpointResponse) {
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
