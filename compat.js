(function (root) {
    function define(object, key, value) {
        if (!(key in object)) Object.defineProperty(object, key, { configurable: true, writable: true, value });
    }
    define(root, 'globalThis', root);
    define(Object, 'hasOwn', (object, key) => Object.prototype.hasOwnProperty.call(object, key));
    define(Object, 'fromEntries', function (entries) {
        const object = {};
        for (const [key, value] of entries) Object.defineProperty(object, key, { configurable: true, enumerable: true, writable: true, value });
        return object;
    });
    function flatten(items, depth, output) {
        Array.prototype.forEach.call(items, item => {
            if (depth > 0 && Array.isArray(item)) flatten(item, depth - 1, output);
            else output.push(item);
        });
        return output;
    }
    define(Array.prototype, 'flat', function (depth = 1) { return flatten(this, Math.floor(depth), []); });
    define(Array.prototype, 'flatMap', function (callback, receiver) { return flatten(Array.prototype.map.call(this, callback, receiver), 1, []); });
    define(Array.prototype, 'at', function (index) {
        const offset = Math.trunc(index) || 0;
        const position = offset < 0 ? this.length + offset : offset;
        return position >= 0 && position < this.length ? this[position] : undefined;
    });
    function findLastIndex(callback, receiver) {
        for (let index = this.length - 1; index >= 0; index--) {
            if (callback.call(receiver, this[index], index, this)) return index;
        }
        return -1;
    }
    define(Array.prototype, 'findLastIndex', findLastIndex);
    define(Array.prototype, 'findLast', function (callback, receiver) {
        const index = findLastIndex.call(this, callback, receiver);
        return index < 0 ? undefined : this[index];
    });
    define(Promise.prototype, 'finally', function (action) {
        if (typeof action !== 'function') return this.then(action, action);
        return this.then(value => Promise.resolve(action()).then(() => value),
            error => Promise.resolve(action()).then(() => { throw error; }));
    });
    define(Element.prototype, 'replaceChildren', function (...children) {
        this.textContent = '';
        this.append(...children);
    });
    define(Element.prototype, 'toggleAttribute', function (name, force = !this.hasAttribute(name)) {
        if (force) { if (!this.hasAttribute(name)) this.setAttribute(name, ''); }
        else this.removeAttribute(name);
        return Boolean(force);
    });
})(window);
