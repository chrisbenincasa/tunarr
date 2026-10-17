// TypeScript 7.0 has no JS compiler API. These tools still call it, so they
// get their own TypeScript 5.9.3 instead of the workspace's 7.x peer.
const NEEDS_TS_API = new Set([
  '@hey-api/openapi-ts',
  'cosmiconfig',
  'cosmiconfig-typescript-loader',
  'ts-node',
]);

function readPackage(pkg) {
  if (NEEDS_TS_API.has(pkg.name)) {
    delete pkg.peerDependencies?.typescript;
    delete pkg.peerDependenciesMeta?.typescript;
    pkg.dependencies = { ...pkg.dependencies, typescript: '5.9.3' };
  }
  return pkg;
}

module.exports = { hooks: { readPackage } };
