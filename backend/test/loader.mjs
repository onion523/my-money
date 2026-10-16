export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (err.code === 'ERR_MODULE_NOT_FOUND' || err.code === 'ERR_UNSUPPORTED_DIR_IMPORT') {
      const candidates = [];
      if (specifier.endsWith('.js')) {
        candidates.push(specifier.slice(0, -3) + '.ts');
      }
      for (const ext of ['.ts', '.js', '/index.ts', '/index.js']) {
        candidates.push(specifier + ext);
      }
      for (const candidate of candidates) {
        try {
          return await nextResolve(candidate, context);
        } catch (_) {}
      }
    }
    throw err;
  }
}
