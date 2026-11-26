// Keep older products with bullet features in their description editable.
export function productContent({ description = '', keyFeatures }) {
  if (keyFeatures !== undefined) return { description, keyFeatures };
  const lines = description.split(/\r\n|\n|\r/);
  return {
    description: lines.filter(line => !/^\s*[-*\u2022]\s+/.test(line)).join('\n').trim(),
    keyFeatures: lines.filter(line => /^\s*[-*\u2022]\s+/.test(line)).map(line => line.replace(/^\s*[-*\u2022]\s+/, '')).join('\n'),
  };
}
