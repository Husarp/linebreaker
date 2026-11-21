import { expect, it, vi } from 'vitest';
import '../native-save.js';
function setup(initial = {}) {
 const files = new Map(Object.entries(initial));
 const fs = {
  readFile: vi.fn(async ({ path, directory, encoding }) => { expect(directory).toBe('DATA'); expect(encoding).toBe('utf8'); if (!files.has(path)) throw Error('File does not exist'); return { data: files.get(path) }; }),
  writeFile: vi.fn(async ({ path, data }) => { files.set(path, data); }),
  rename: vi.fn(async ({ from, to }) => { files.set(to, files.get(from)); files.delete(from); })
 };
 return { files, fs, adapter: globalThis.LBNativeSave.createFilesystemSave(fs) };
}
it('loads fresh installs and writes temp then rename with previous save backup', async () => {
 const { adapter, files, fs } = setup();
 expect(await adapter.load()).toBe(null);
 await adapter.write('{"totalXP":1}');
 await adapter.write('{"totalXP":2}');
 expect(files.get('save.json')).toBe('{"totalXP":2}');
 expect(files.get('save.bak')).toBe('{"totalXP":1}');
 expect(files.has('save.tmp')).toBe(false);
 expect(fs.rename).toHaveBeenCalledWith({ directory: 'DATA', from: 'save.tmp', to: 'save.json' });
});
it('recovers backup without overwriting it with corrupt primary', async () => {
 const { adapter, files } = setup({ 'save.json': 'broken', 'save.bak': '{"totalXP":4}' });
 expect(await adapter.load()).toBe('{"totalXP":4}');
 await adapter.write('{"totalXP":5}');
 expect(files.get('save.bak')).toBe('{"totalXP":4}');
});
it('rejects corrupt saves and access failures instead of returning defaults', async () => {
 const { adapter, fs } = setup({ 'save.json': 'broken', 'save.bak': 'broken' });
 await expect(adapter.load()).rejects.toThrow();
 fs.readFile.mockRejectedValue(Error('Permission denied'));
 await expect(adapter.load()).rejects.toThrow('Permission denied');
});
it('preserves primary and backup when promotion fails', async () => {
 const { adapter, files, fs } = setup({ 'save.json': '{"totalXP":4}' });
 fs.rename.mockRejectedValue(Error('Disk full'));
 await expect(adapter.write('{"totalXP":5}')).rejects.toThrow('Disk full');
 expect(files.get('save.json')).toBe('{"totalXP":4}');
 expect(files.get('save.bak')).toBe('{"totalXP":4}');
});

it('backs up the exact older schema before migration and never replaces the backup', async () => {
 const json = '{"schemaVersion":0,"totalXP":4,"legacyField":true}';
 const { adapter, files } = setup({ 'save.json': json });
 const prepared = await globalThis.LBNativeSave.prepareLoadedSave(json, 1, adapter.backupSchema);
 expect(prepared.readOnly).toBe(null);
 expect(files.get('save.schema-0.bak')).toBe(json);
 await adapter.backupSchema('{"schemaVersion":0,"totalXP":5}', 0);
 expect(files.get('save.schema-0.bak')).toBe(json);
 expect(files.get('save.json')).toBe(json);
});

it('treats a newer schema or failed migration backup as read-only', async () => {
 const backup = vi.fn(async () => { throw Error('Disk full'); });
 const future = '{"schemaVersion":2,"newData":{"score":4}}';
 const { data, readOnly } = await globalThis.LBNativeSave.prepareLoadedSave(future, 1, backup);
 expect(data).toEqual(JSON.parse(future));
 expect(readOnly).toContain('newer version');
 expect(backup).not.toHaveBeenCalled();
 expect((await globalThis.LBNativeSave.prepareLoadedSave('{"schemaVersion":0}', 1, backup)).readOnly).toContain('backup');
});
