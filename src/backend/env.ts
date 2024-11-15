
export function getEnvVar(env: string) {
	const envVar = process.env[env];

	if (!envVar) {
		throw new Error(`${envVar} not defined`);
	}

	return envVar;
}
