/** In-memory stand-in for a Cloudflare KV namespace, for unit tests. */
export function memoryKV() {
	/** @type {Map<string, string>} */
	const store = new Map();
	/** @type {Map<string, any>} put options (e.g. expirationTtl) by key */
	const options = new Map();
	return {
		store,
		options,
		/** @param {string} k */
		async get(k) {
			return store.has(k) ? store.get(k) : null;
		},
		/** @param {string} k @param {string} v @param {any} [opts] */
		async put(k, v, opts) {
			store.set(k, v);
			options.set(k, opts);
		},
		/** @param {string} k */
		async delete(k) {
			store.delete(k);
		},
		/** @param {{ prefix?: string }} [opts] */
		async list(opts = {}) {
			const keys = [...store.keys()]
				.filter((k) => k.startsWith(opts.prefix ?? ''))
				.map((name) => ({ name }));
			return { keys, list_complete: true, cursor: undefined };
		}
	};
}
