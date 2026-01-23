import fs from 'node:fs/promises';

export async function generateEnvModule(keysToInline: string[]) {
  const entries = keysToInline
    .map((key) => {
      const value = process.env[key];
      if (!!value) {
        return `  ${key}: ${JSON.stringify(value)},`;
      }
      return null;
    })
    .filter(Boolean)
    .join('\n');

  const moduleContent = `
// AUTO-GENERATED - DO NOT EDIT MANUALLY
// Generated a build time by bundle.ts

export const BUILD_ENV: Record<string, string> = {
${entries}
} as const;

export const BUILD_ENV_KEYS = new Set(Object.keys(BUILD_ENV));
`;

  await fs.writeFile('./src/generated/env.ts', moduleContent);
}

if (process.argv[1] === import.meta.filename) {
  await generateEnvModule([]);
}
