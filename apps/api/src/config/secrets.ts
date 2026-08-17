import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

export interface RuntimeSecrets {
  databaseUrl: string;
  jwtSecret: string;
}

/**
 * Local/dev/test: secrets come from process.env (.env, git-ignored).
 * Production: secrets come from AWS Secrets Manager, fetched at boot via the
 * EC2 instance's IAM role — no long-lived AWS keys on disk, nothing sensitive
 * committed. See AGENTS.md [SECRETS] and infra/DEPLOY.md.
 */
export async function loadSecrets(): Promise<RuntimeSecrets> {
  if (process.env.NODE_ENV === "production") {
    const secretId = requireEnv("SECRETS_MANAGER_SECRET_ID");
    const region = requireEnv("AWS_REGION");
    const client = new SecretsManagerClient({ region });
    const result = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
    if (!result.SecretString) {
      throw new Error(`Secret ${secretId} has no SecretString payload`);
    }
    const parsed = JSON.parse(result.SecretString);
    return {
      databaseUrl: parsed.DATABASE_URL,
      jwtSecret: parsed.JWT_SECRET,
    };
  }

  return {
    databaseUrl: requireEnv("DATABASE_URL"),
    jwtSecret: requireEnv("JWT_SECRET"),
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}
