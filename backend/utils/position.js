// Fractional ordering: moving an item only rewrites ONE document.
// `index` = where the item should land among its siblings (0 = top).
export async function computePosition(Model, filter, index, excludeId = null) {
  const query = { ...filter };
  if (excludeId) query._id = { $ne: excludeId };

  const items = await Model.find(query).sort({ position: 1 }).select("position").lean();
  const i = Math.max(0, Math.min(Number(index) || 0, items.length));
  const prev = items[i - 1]?.position;
  const next = items[i]?.position;

  if (prev === undefined && next === undefined) return 1024;
  if (prev === undefined) return next - 1024;
  if (next === undefined) return prev + 1024;
  return (prev + next) / 2;
}

export async function nextPosition(Model, filter) {
  return computePosition(Model, filter, Number.MAX_SAFE_INTEGER);
}
