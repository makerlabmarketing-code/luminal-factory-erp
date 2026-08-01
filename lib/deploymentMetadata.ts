export type DeploymentMetadata = {
  status: 'available' | 'unavailable';
  commitSha: string | null;
  deploymentEnvironment: 'production' | 'preview' | 'development' | null;
};

const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/i;
const DEPLOYMENT_ENVIRONMENTS = ['production', 'preview', 'development'] as const;
type DeploymentEnvironment = typeof DEPLOYMENT_ENVIRONMENTS[number];

export function getDeploymentMetadata(environment: {
  VERCEL_GIT_COMMIT_SHA?: string;
  VERCEL_ENV?: string;
}): DeploymentMetadata {
  const rawCommitSha = environment.VERCEL_GIT_COMMIT_SHA?.trim() || '';
  const commitSha = COMMIT_SHA_PATTERN.test(rawCommitSha) ? rawCommitSha.toLowerCase() : null;
  const rawEnvironment = environment.VERCEL_ENV?.trim().toLowerCase() || '';
  const deploymentEnvironment = DEPLOYMENT_ENVIRONMENTS.includes(rawEnvironment as DeploymentEnvironment)
    ? rawEnvironment as DeploymentMetadata['deploymentEnvironment']
    : null;

  return {
    status: commitSha ? 'available' : 'unavailable',
    commitSha,
    deploymentEnvironment,
  };
}
