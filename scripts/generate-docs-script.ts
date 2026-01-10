import fs from 'node:fs/promises';
import path from 'node:path';
import semver from 'semver';

function semverRegex() {
  return /((0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?)/gi;
}

const generatedDir = await fs.readdir('docs/generated');
const openApiSpecs = generatedDir
  .filter((name) => name.endsWith('openapi.json') && !name.includes('latest'))
  .sort((l, r) => {
    const sv1 = semverRegex().exec(l.replace('-openapi.json', ''))?.[0] ?? l;
    const sv2 = semverRegex().exec(r.replace('-openapi.json', ''))?.[0] ?? r;
    return semver.rcompare(sv1, sv2);
  });

// Generate the script...

const specs = [
  {
    title: 'Latest',
    slug: 'latest',
    url: '/generated/tunarr-latest-openapi.json',
  },
  ...openApiSpecs.map((spec) => {
    const v = semverRegex().exec(spec.replace('-openapi.json', ''))?.[0];
    return {
      title: v,
      slug: v,
      url: `/generated/${spec}`,
    };
  }),
];

const script = `
const sources = ${JSON.stringify(specs)}
`;

await fs.writeFile(
  path.join(process.cwd(), 'docs', 'generated', 'openapi-specs.js'),
  script,
);
