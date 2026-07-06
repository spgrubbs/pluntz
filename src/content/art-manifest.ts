/**
 * Registry of every drawable in the game. For now all entries are procedural
 * Pixi Graphics (see src/render). When handmade art starts landing, a loader
 * will check `public/art/<id>.png` and prefer it over the procedural
 * placeholder — no code change needed per asset. `tintable` art should be
 * authored in grayscale/white so faction colors can be applied as tints.
 */
export interface ArtEntry {
  id: string;
  desc: string;
  tintable: boolean;
}

export const ART_MANIFEST: ArtEntry[] = [
  { id: 'asteroid', desc: 'Irregular rock polygon, lit rim + faceted dark side', tintable: false },
  { id: 'part.heart', desc: 'Heartseed: circle with glowing core + energy ring', tintable: true },
  { id: 'part.root', desc: 'Root wedge driven into rock', tintable: true },
  { id: 'part.stem', desc: 'Tapered stem strut segment', tintable: true },
  { id: 'part.leaf.needle', desc: 'Pinophyta needle fan (3 blades)', tintable: true },
  { id: 'sun', desc: 'Sun disc with layered additive glow', tintable: false },
  { id: 'starfield', desc: 'Parallax star layers (procedural, likely stays so)', tintable: false },
];
