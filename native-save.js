/* Shared native contract: load() -> JSON string|null; write(json) -> Promise. */
(function (root) {
    function createFilesystemSave(filesystem) {
        const options = { directory: 'DATA', encoding: 'utf8' };
        const missing = error => /not exist|not found|ENOENT/i.test(String(error?.message || error));
        async function read(path) {
            try {
                const { data } = await filesystem.readFile({ ...options, path });
                const value = JSON.parse(data);
                if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid save');
                return data;
            } catch (error) { if (missing(error)) return null; throw error; }
        }
        let recovered = false;
        return {
            async load() {
                let primaryError;
                try { const data = await read('save.json'); if (data !== null) return data; }
                catch (error) { primaryError = error; }
                const backup = await read('save.bak');
                if (backup !== null) { recovered = true; return backup; }
                if (primaryError) throw primaryError;
                return null;
            },
            async backupSchema(json, version) {
                if (!Number.isSafeInteger(version) || version < 0) throw Error('Invalid backup schema version');
                JSON.parse(json);
                const path = `save.schema-${version}.bak`;
                if (await read(path) === null) await filesystem.writeFile({ ...options, path, data: json });
            },
            async write(json) {
                JSON.parse(json);
                await filesystem.writeFile({ ...options, path: 'save.tmp', data: json });
                if (!recovered) {
                    const previous = await read('save.json');
                    if (previous !== null) await filesystem.writeFile({ ...options, path: 'save.bak', data: previous });
                }
                await filesystem.rename({ directory: options.directory, from: 'save.tmp', to: 'save.json' });
                recovered = false;
            }
        };
    }
    const schemaOf = data => Number.isSafeInteger(data?.schemaVersion) && data.schemaVersion >= 0 ? data.schemaVersion : 0;
    async function prepareLoadedSave(json, supportedVersion, backupSchema) {
        const data = json === null ? null : JSON.parse(json);
        const version = schemaOf(data);
        if (version > supportedVersion) return { data, readOnly: 'This save comes from a newer version.' };
        if (data && version < supportedVersion && backupSchema) {
            try { await backupSchema(json, version); }
            catch { return { data, readOnly: 'A backup could not be made before migrating this save.' }; }
        }
        return { data, readOnly: null };
    }
    root.LBNativeSave = { createFilesystemSave, prepareLoadedSave, schemaOf };
})(globalThis);
