import { assertReleaseHygiene, readVersions, releaseRepository, run } from './desktop-release-config.mjs';

const { config } = await readVersions();
await releaseRepository(config);
assertReleaseHygiene();
await import('./build-web.mjs');
run(process.execPath, ['node_modules/vitest/vitest.mjs', 'run']);
