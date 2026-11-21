import { expect, it } from 'vitest';
import { assertMatchingWeb } from '../scripts/ota-consistency.mjs';

const page = { path: 'index.html', size: 123, sha256: 'page' };
const styles = { path: 'style.css', size: 456, sha256: 'styles' };
const bundle = { version: '1.1.2', files: [page, styles] };

it('accepts identical inventories in any order and ignores different web versions', () => {
  expect(() => assertMatchingWeb({ ...bundle, files: [styles, page] }, bundle, 'APK')).not.toThrow();
  expect(() => assertMatchingWeb({ version: '1.1.1', files: [] }, bundle, 'APK')).not.toThrow();
});

it.each([
  [[{ ...page, sha256: 'stale' }, styles], 'index.html'],
  [[{ ...page, size: 124 }, styles], 'index.html'],
  [[page], 'style.css'],
  [[page, styles, { ...page, path: 'extra.js' }], 'extra.js'],
])('rejects a changed, missing, or extra file at the same web version', (files, mismatch) => {
  expect(() => assertMatchingWeb({ ...bundle, files }, bundle, 'APK')).toThrow(mismatch);
});
