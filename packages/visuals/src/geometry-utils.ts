import * as THREE from "three";

// Merges freshly created static geometries into a single buffer so a batch of
// decorative pieces renders as one draw call — draw-call count is the main
// rendering cost on mobile GPUs. Transforms must already be baked into each
// geometry; the inputs are disposed and only attributes present in every
// geometry survive the merge.
export function mergeStaticGeometries(
  geometries: THREE.BufferGeometry[],
): THREE.BufferGeometry {
  const expanded = geometries.map((geometry) =>
    geometry.index ? geometry.toNonIndexed() : geometry,
  );
  const first = expanded[0]!;
  const names = Object.keys(first.attributes).filter((name) =>
    expanded.every((geometry) => geometry.getAttribute(name)),
  );
  const merged = new THREE.BufferGeometry();
  for (const name of names) {
    const itemSize = first.getAttribute(name).itemSize;
    const total = expanded.reduce(
      (sum, geometry) => sum + geometry.getAttribute(name).count,
      0,
    );
    const array = new Float32Array(total * itemSize);
    let offset = 0;
    for (const geometry of expanded) {
      const attribute = geometry.getAttribute(name);
      array.set(attribute.array as ArrayLike<number>, offset);
      offset += attribute.count * itemSize;
    }
    merged.setAttribute(name, new THREE.BufferAttribute(array, itemSize));
  }
  for (let index = 0; index < geometries.length; index += 1) {
    if (expanded[index] !== geometries[index]) expanded[index]!.dispose();
    geometries[index]!.dispose();
  }
  return merged;
}
