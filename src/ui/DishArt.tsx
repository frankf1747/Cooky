// Owner: Platform. A recipe's picture until the team chooses dish photography: a flat, top-down
// still life drawn from the recipe's title. A blue-rimmed enamel plate, a bowl or a cast-iron
// skillet on a parchment table, with the dish's own ingredients on it (pasta nest, rice, eggs,
// greens, salmon...). Deterministic per recipe id, so a recipe always looks the same, and
// neighbours in a grid differ in arrangement, not in colour. Food colours are fixed (food does
// not change at night); the table follows the theme.
import { useId, type ReactNode } from "react";

const F = {
  plate: "#fffdf8", rim: "#2b4bd8", iron: "#2e2a33", ironIn: "#3a3540", ironRim: "#5c5563", wood: "#c48848", fork: "#a59c91",
  rice: "#fbf6ea", grain: "#e4d9c2", friedRice: "#f3dfb0",
  pasta: "#f4d488", pastaShade: "#ddb260", soba: "#c58b4c", sobaShade: "#a8733a",
  sauce: "#d4492a", sauceHi: "#e86b45", curry: "#dd9a35", curryHi: "#eab65a", cream: "#f5ead2",
  egg: "#ffffff", yolk: "#f5ac25", omelette: "#f6cd5c", omeletteShade: "#e6b343",
  leaf: "#3c8a55", leaf2: "#5fa56c", pea: "#7cba5c", bean: "#4c9853",
  tomato: "#e0532c", tomatoIn: "#f07a52", chicken: "#e3a75f", glazed: "#b8672e", sear: "#c37f3b",
  salmon: "#f08a62", salmonFat: "#fcd2bf", beef: "#8a4b2e", beefHi: "#a55d3a",
  mushroom: "#c9a27a", gill: "#a7805a", chickpea: "#e8c37b", blackbean: "#2e2430",
  lemon: "#f6d34a", pith: "#fff3b0", tortilla: "#efd39a", char: "#cf9f55",
  potato: "#f1cf86", potatoEdge: "#e0b45e", zucchini: "#86b862", zucchiniIn: "#e8f1c6",
  pepperRed: "#e0532c", pepperGreen: "#5aa05a", cheese: "#f7d26a", sesame: "#fff4dc", scallion: "#6fb36a",
};

type Kind = "noodles" | "bowl" | "skillet" | "folded" | "plate";

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function random(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Coordinates are rounded: the server and the browser compute sine and cosine a hair apart
 * (1e-14), which would otherwise make the server's picture and the browser's disagree.
 */
const r2 = (v: number) => Math.round(v * 100) / 100;

/** n points spread around a disc, jittered, starting at a random angle. */
function ring(n: number, cx: number, cy: number, r: number, rnd: () => number, jitter = 0.35): [number, number, number][] {
  const start = rnd() * Math.PI * 2;
  return Array.from({ length: n }, (_, i) => {
    const a = start + (i / n) * Math.PI * 2 + (rnd() - 0.5) * jitter;
    const rr = r * (0.75 + rnd() * 0.4);
    return [r2(cx + Math.cos(a) * rr), r2(cy + Math.sin(a) * rr), r2(rnd() * 360)];
  });
}

/** n points inside a disc. */
function scatter(n: number, cx: number, cy: number, r: number, rnd: () => number): [number, number, number][] {
  return Array.from({ length: n }, () => {
    const a = rnd() * Math.PI * 2;
    const rr = Math.sqrt(rnd()) * r;
    return [r2(cx + Math.cos(a) * rr), r2(cy + Math.sin(a) * rr), r2(rnd() * 360)];
  });
}

const at = (x: number, y: number, r = 0, s = 1) => `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${r.toFixed(0)}) scale(${s})`;

/** A soft irregular blob of radius r around (cx, cy). */
function blob(cx: number, cy: number, r: number, rnd: () => number, points = 8): string {
  const pts = Array.from({ length: points }, (_, i) => {
    const a = (i / points) * Math.PI * 2;
    const rr = r * (0.86 + rnd() * 0.24);
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
  });
  // A smooth closed curve: start between the first two points, then curve through each point
  // towards the midpoint of the next pair.
  const mid = (i: number) => {
    const [x0, y0] = pts[i % points];
    const [x1, y1] = pts[(i + 1) % points];
    return `${((x0 + x1) / 2).toFixed(1)} ${((y0 + y1) / 2).toFixed(1)}`;
  };
  let d = `M${mid(0)}`;
  for (let i = 1; i <= points; i++) {
    const [x, y] = pts[i % points];
    d += ` Q${x.toFixed(1)} ${y.toFixed(1)} ${mid(i)}`;
  }
  return `${d} Z`;
}

// ---------------------------------------------------------------- ingredients
const Leaf = ({ x, y, r, s = 1, dark = true }: { x: number; y: number; r: number; s?: number; dark?: boolean }) => (
  <g transform={at(x, y, r, s)}>
    <path d="M0 -7 C5 -3.5 5 3.5 0 7 C-5 3.5 -5 -3.5 0 -7 Z" fill={dark ? F.leaf : F.leaf2} />
    <path d="M0 -5 V5" stroke={dark ? F.leaf2 : F.leaf} strokeWidth="0.8" strokeLinecap="round" />
  </g>
);
const Pea = ({ x, y }: { x: number; y: number }) => <circle cx={x} cy={y} r="2.5" fill={F.pea} />;
const GreenBean = ({ x, y, r }: { x: number; y: number; r: number }) => <rect transform={at(x, y, r)} x="-9" y="-1.8" width="18" height="3.6" rx="1.8" fill={F.bean} />;
const Tomato = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <g transform={at(x, y, 0, s)}>
    <circle r="4.8" fill={F.tomato} />
    <circle r="3.1" fill={F.tomatoIn} />
    <circle cx="-1" cy="-0.6" r="0.7" fill="#ffd9c4" />
    <circle cx="1.1" cy="0.8" r="0.7" fill="#ffd9c4" />
  </g>
);
const FriedEgg = ({ x, y, r, s = 1 }: { x: number; y: number; r: number; s?: number }) => (
  <g transform={at(x, y, r, s)}>
    <path d="M-10 -1 C-10 -8 -2 -11 4 -9 C10 -7.5 12 -1 10 4.5 C8 10 -1 11 -5.5 8 C-9.5 5.5 -10 2.5 -10 -1 Z" fill={F.egg} />
    <circle cx="0.5" cy="-0.5" r="4.6" fill={F.yolk} />
    <circle cx="-0.8" cy="-1.9" r="1.3" fill="#ffd77a" />
  </g>
);
const EggBit = ({ x, y, r }: { x: number; y: number; r: number }) => (
  <path transform={at(x, y, r)} d="M-4 -2 C-2 -5 3 -4.5 4 -1 C5 2 2 4.5 -1 4 C-4 3.5 -5.5 0.5 -4 -2 Z" fill={F.omelette} />
);
const Chicken = ({ x, y, r, glazed = false }: { x: number; y: number; r: number; glazed?: boolean }) => (
  <g transform={at(x, y, r)}>
    <rect x="-7.5" y="-5" width="15" height="10" rx="4.5" fill={glazed ? F.glazed : F.chicken} />
    <path d="M-4 -2 l6 0 M-3 2 l6 0" stroke={glazed ? "#9a5524" : F.sear} strokeWidth="1.3" strokeLinecap="round" />
  </g>
);
const Beef = ({ x, y, r }: { x: number; y: number; r: number }) => (
  <g transform={at(x, y, r)}>
    <path d="M-6.5 -3 C-4.5 -6.5 4.5 -6.5 6.5 -2 C7.5 2.5 3.5 5.5 -1 5.5 C-5.5 5.5 -7.5 1 -6.5 -3 Z" fill={F.beef} />
    <path d="M-3 -2 q3 -1.5 6 0" stroke={F.beefHi} strokeWidth="1.2" fill="none" strokeLinecap="round" />
  </g>
);
const Mushroom = ({ x, y, r }: { x: number; y: number; r: number }) => (
  <g transform={at(x, y, r)}>
    <path d="M-6.5 0.5 C-6.5 -6 6.5 -6 6.5 0.5 Z" fill={F.mushroom} />
    <rect x="-2" y="0" width="4" height="5" rx="1.5" fill={F.gill} />
  </g>
);
const Chickpea = ({ x, y, r }: { x: number; y: number; r: number }) => (
  <g transform={at(x, y, r)}>
    <circle r="2.9" fill={F.chickpea} />
    <path d="M-1 -2 q1.5 1.5 0 3.5" stroke="#d1a95c" strokeWidth="0.8" fill="none" />
  </g>
);
const BlackBean = ({ x, y, r }: { x: number; y: number; r: number }) => <ellipse transform={at(x, y, r)} rx="2.4" ry="1.6" fill={F.blackbean} />;
const Lemon = ({ x, y, r, s = 1 }: { x: number; y: number; r: number; s?: number }) => (
  <g transform={at(x, y, r, s)}>
    <circle r="7.5" fill={F.lemon} />
    <circle r="6" fill="#f9df6c" />
    {[0, 60, 120, 180, 240, 300].map((a) => (
      <path key={a} d="M0 0 L0 -5.6" transform={`rotate(${a})`} stroke={F.pith} strokeWidth="1.1" strokeLinecap="round" />
    ))}
    <circle r="1.4" fill={F.pith} />
  </g>
);
const PotatoCube = ({ x, y, r }: { x: number; y: number; r: number }) => (
  <g transform={at(x, y, r)}>
    <rect x="-3.8" y="-3.8" width="7.6" height="7.6" rx="2" fill={F.potato} />
    <path d="M-3.8 1.8 h7.6" stroke={F.potatoEdge} strokeWidth="1.2" />
  </g>
);
const Zucchini = ({ x, y }: { x: number; y: number }) => (
  <g transform={at(x, y)}>
    <circle r="4.6" fill={F.zucchini} />
    <circle r="3.4" fill={F.zucchiniIn} />
  </g>
);
const Pepper = ({ x, y, r, red }: { x: number; y: number; r: number; red: boolean }) => (
  <rect transform={at(x, y, r)} x="-7.5" y="-1.7" width="15" height="3.4" rx="1.7" fill={red ? F.pepperRed : F.pepperGreen} />
);
const Sesame = ({ x, y, r }: { x: number; y: number; r: number }) => <ellipse transform={at(x, y, r)} rx="0.9" ry="1.7" fill={F.sesame} />;
const Scallion = ({ x, y }: { x: number; y: number }) => <circle cx={x} cy={y} r="1.9" fill="none" stroke={F.scallion} strokeWidth="1.3" />;

// The two helpers below draw random detail, so they are called as plain functions during
// DishArt's own render (never as components): the random sequence then runs in one fixed order
// on the server and the client, and the picture hydrates cleanly.

/** A nest of noodles or spaghetti, seen from above. */
function nest({ cx, cy, r, rnd, soba }: { cx: number; cy: number; r: number; rnd: () => number; soba: boolean }) {
  // Loose strands: arcs of different sizes around slightly different centres, so they cross
  // like real pasta instead of stacking into rings.
  const strands: ReactNode[] = [];
  for (let i = 0; i < 16; i++) {
    const ox = cx + (rnd() - 0.5) * 9;
    const oy = cy + (rnd() - 0.5) * 9;
    const rr = 5 + rnd() * (r - 9);
    const a0 = rnd() * Math.PI * 2;
    const sweep = Math.PI * (0.8 + rnd() * 0.9);
    const x0 = ox + Math.cos(a0) * rr;
    const y0 = oy + Math.sin(a0) * rr;
    const x1 = ox + Math.cos(a0 + sweep) * rr;
    const y1 = oy + Math.sin(a0 + sweep) * rr;
    const d = `M${x0.toFixed(1)} ${y0.toFixed(1)} A${rr.toFixed(1)} ${rr.toFixed(1)} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
    strands.push(<path key={`s${i}`} d={d} fill="none" stroke={soba ? F.sobaShade : F.pastaShade} strokeWidth="3.4" strokeLinecap="round" transform="translate(0.6 1)" />);
    strands.push(<path key={`h${i}`} d={d} fill="none" stroke={soba ? F.soba : F.pasta} strokeWidth="2.6" strokeLinecap="round" />);
  }
  return (
    <g>
      <path d={blob(cx, cy, r * 0.78, rnd, 9)} fill={soba ? F.sobaShade : F.pastaShade} />
      {strands}
    </g>
  );
}

function rice({ cx, cy, r, rnd, fried = false }: { cx: number; cy: number; r: number; rnd: () => number; fried?: boolean }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={fried ? F.friedRice : F.rice} />
      {scatter(26, cx, cy, r - 3, rnd).map(([x, y, a], i) => (
        <ellipse key={i} transform={at(x, y, a)} rx="1.7" ry="0.8" fill={fried ? "#e2c88e" : F.grain} />
      ))}
    </g>
  );
}

// ---------------------------------------------------------------- the dish
function kindOf(t: string): Kind {
  if (/spaghetti|pasta|noodle/.test(t)) return "noodles";
  if (/frittata|shakshuka|hash/.test(t)) return "skillet";
  if (/taco|quesadilla/.test(t)) return "folded";
  if (/rice|bowl|curry|oyakodon|stir-fry/.test(t)) return "bowl";
  return "plate";
}

export function DishArt({
  id,
  title,
  className = "",
  frame = "table",
}: {
  id: string;
  title: string;
  className?: string;
  /** "table": the still life on parchment. "plate": just the plated dish, cropped square, for shelves. */
  frame?: "table" | "plate";
}) {
  const clip = useId().replace(/:/g, "");
  const t = title.toLowerCase();
  const seed = hash(id);
  const rnd = random(seed);
  const kind = kindOf(t);
  const has = (re: RegExp) => re.test(t);
  const cx = 80;
  const cy = 60;
  const asian = has(/soy|sesame|ginger|oyakodon|tamagoyaki|japanese|fried rice|stir-fry/);
  const food: ReactNode[] = [];
  let k = 0;
  const add = (n: ReactNode) => food.push(<g key={k++}>{n}</g>);

  if (kind === "noodles") {
    const soba = has(/noodle/);
    add(nest({ cx, cy, r: 31, rnd, soba }));
    if (has(/marinara|tomato/)) add(<path d={blob(cx + 2, cy - 1, 15, rnd)} fill={F.sauce} />);
    if (has(/creamy/)) add(<path d={blob(cx, cy, 17, rnd)} fill={F.cream} opacity="0.92" />);
    if (has(/mushroom/)) ring(5, cx, cy, 15, rnd).forEach(([x, y, a]) => add(<Mushroom x={x} y={y} r={a} />));
    if (has(/chicken/)) ring(4, cx, cy, 22, rnd).forEach(([x, y, a]) => add(<Chicken x={x} y={y} r={a} />));
    if (has(/peas/)) scatter(14, cx, cy, 26, rnd).forEach(([x, y]) => add(<Pea x={x} y={y} />));
    if (has(/vegetable/)) ring(6, cx, cy, 20, rnd).forEach(([x, y, a], i) => add(<Pepper x={x} y={y} r={a} red={i % 2 === 0} />));
    if (has(/sesame/)) scatter(16, cx, cy, 22, rnd).forEach(([x, y, a]) => add(<Sesame x={x} y={y} r={a} />));
    if (has(/sesame|soy/)) scatter(7, cx, cy, 18, rnd).forEach(([x, y]) => add(<Scallion x={x} y={y} />));
    if (!has(/sesame|soy/)) ring(3, cx - 4, cy - 6, 8, rnd).forEach(([x, y, a], i) => add(<Leaf x={x} y={y} r={a} s={0.7} dark={i % 2 === 0} />));
  }

  if (kind === "bowl") {
    if (has(/chickpea/)) {
      add(<circle cx={cx} cy={cy} r={34} fill={F.curry} />);
      add(<path d={blob(cx - 6, cy - 4, 10, rnd)} fill={F.curryHi} />);
      scatter(16, cx, cy, 26, rnd).forEach(([x, y, a]) => add(<Chickpea x={x} y={y} r={a} />));
      ring(5, cx, cy, 20, rnd).forEach(([x, y, a], i) => add(<Leaf x={x} y={y} r={a} s={0.95} dark={i % 2 === 0} />));
      add(<path d={`M${cx - 10} ${cy + 4} q6 -8 13 -2 t12 2`} fill="none" stroke={F.cream} strokeWidth="2.6" strokeLinecap="round" />);
    } else if (has(/curry/)) {
      add(rice({ cx, cy, r: 34, rnd }));
      add(<path d={`M${cx - 34} ${cy} A34 34 0 0 0 ${cx + 34} ${cy} C${cx + 18} ${cy - 8} ${cx - 16} ${cy + 8} ${cx - 34} ${cy} Z`} fill={F.curry} transform={`rotate(${(rnd() * 60 - 30).toFixed(0)} ${cx} ${cy})`} />);
      scatter(4, cx + 2, cy + 14, 11, rnd).forEach(([x, y, a]) => add(<PotatoCube x={x} y={y} r={a} />));
      scatter(3, cx - 6, cy + 16, 10, rnd).forEach(([x, y, a]) => add(<Chicken x={x} y={y} r={a} />));
      add(<circle cx={cx + 8} cy={cy + 10} r="2.6" fill="#e5873b" />);
    } else {
      const fried = has(/fried rice/);
      add(rice({ cx, cy, r: 34, rnd, fried }));
      if (fried) {
        scatter(14, cx, cy, 27, rnd).forEach(([x, y]) => add(<Pea x={x} y={y} />));
        scatter(8, cx, cy, 25, rnd).forEach(([x, y, a]) => add(<EggBit x={x} y={y} r={a} />));
        scatter(8, cx, cy, 25, rnd).forEach(([x, y]) => add(<Scallion x={x} y={y} />));
      }
      if (has(/oyakodon/)) {
        add(<path d={blob(cx, cy, 26, rnd, 9)} fill={F.omelette} />);
        add(<path d={blob(cx + 3, cy - 2, 12, rnd)} fill="#f8dc84" />);
        ring(5, cx, cy, 15, rnd).forEach(([x, y, a]) => add(<Chicken x={x} y={y} r={a} />));
        scatter(6, cx, cy, 20, rnd).forEach(([x, y]) => add(<Scallion x={x} y={y} />));
      }
      if (has(/tomato/) && has(/egg/)) {
        scatter(7, cx, cy, 20, rnd).forEach(([x, y, a]) => add(<EggBit x={x} y={y} r={a} />));
        scatter(6, cx, cy, 22, rnd).forEach(([x, y]) => add(<Tomato x={x} y={y} s={0.9} />));
        scatter(5, cx, cy, 20, rnd).forEach(([x, y]) => add(<Scallion x={x} y={y} />));
      }
      if (has(/fajita/)) {
        // a section each: peppers, chicken, beans, a lime
        ring(6, cx - 12, cy - 10, 8, rnd).forEach(([x, y, a], i) => add(<Pepper x={x} y={y} r={a} red={i % 2 === 0} />));
        ring(4, cx + 13, cy - 8, 7, rnd).forEach(([x, y, a]) => add(<Chicken x={x} y={y} r={a} />));
        scatter(10, cx, cy + 15, 9, rnd).forEach(([x, y, a]) => add(<BlackBean x={x} y={y} r={a} />));
        add(<g transform={at(cx + 18, cy + 14)}><circle r="6.5" fill="#9cc54a" /><circle r="5" fill="#cfe58a" /></g>);
      }
      if (has(/beef/)) {
        ring(6, cx - 8, cy - 4, 11, rnd).forEach(([x, y, a]) => add(<Beef x={x} y={y} r={a} />));
        ring(5, cx + 14, cy + 6, 9, rnd).forEach(([x, y, a]) => add(<GreenBean x={x} y={y} r={a} />));
        scatter(14, cx, cy, 24, rnd).forEach(([x, y, a]) => add(<Sesame x={x} y={y} r={a} />));
      }
    }
  }

  if (kind === "skillet") {
    if (has(/shakshuka/)) {
      add(<path d={blob(cx, cy, 36, rnd, 10)} fill={F.sauce} />);
      add(<path d={blob(cx - 8, cy - 8, 14, rnd)} fill={F.sauceHi} opacity="0.7" />);
      ring(3, cx, cy, 17, rnd, 0.15).forEach(([x, y, a]) => add(<FriedEgg x={x} y={y} r={a} s={0.72} />));
      scatter(10, cx, cy, 30, rnd).forEach(([x, y]) => add(<circle cx={x} cy={y} r="1.3" fill="#f2c94c" opacity="0.9" />));
      scatter(5, cx, cy, 28, rnd).forEach(([x, y, a], i) => add(<Leaf x={x} y={y} r={a} s={0.55} dark={i % 2 === 0} />));
    } else if (has(/hash/)) {
      add(<circle cx={cx} cy={cy} r={36} fill="#e6c27a" />);
      scatter(18, cx, cy, 30, rnd).forEach(([x, y, a]) => add(<PotatoCube x={x} y={y} r={a} />));
      scatter(7, cx, cy, 28, rnd).forEach(([x, y]) => add(<Zucchini x={x} y={y} />));
      ring(2, cx, cy, 11, rnd, 0.2).forEach(([x, y, a]) => add(<FriedEgg x={x} y={y} r={a} />));
    } else {
      add(<circle cx={cx} cy={cy} r={36} fill={F.omelette} />);
      add(<circle cx={cx} cy={cy} r={36} fill="none" stroke={F.omeletteShade} strokeWidth="4" />);
      scatter(9, cx, cy, 26, rnd).forEach(([x, y, a], i) => add(<Leaf x={x} y={y} r={a} s={0.85} dark={i % 2 === 0} />));
      scatter(5, cx, cy, 24, rnd).forEach(([x, y]) => add(<Tomato x={x} y={y} s={0.8} />));
      scatter(10, cx, cy, 28, rnd).forEach(([x, y]) => add(<circle cx={x} cy={y} r="1.6" fill={F.omeletteShade} />));
    }
  }

  if (kind === "folded") {
    if (has(/quesadilla/)) {
      [0, 1, 2, 3].forEach((i) => {
        const a = -90 + i * 72 + rnd() * 10;
        add(
          <g transform={`rotate(${a.toFixed(0)} ${cx} ${cy}) translate(0 -3)`}>
            <path d={`M${cx} ${cy} L${cx - 13} ${cy - 30} Q${cx} ${cy - 36} ${cx + 13} ${cy - 30} Z`} fill={F.tortilla} />
            <path d={`M${cx - 11} ${cy - 30} Q${cx} ${cy - 34} ${cx + 11} ${cy - 30}`} fill="none" stroke={F.cheese} strokeWidth="2.6" />
            <circle cx={cx - 3} cy={cy - 17} r="1.8" fill={F.char} />
            <circle cx={cx + 4} cy={cy - 23} r="1.4" fill={F.char} />
            <ellipse cx={cx + 6} cy={cy - 29} rx="1.8" ry="1.2" fill={F.blackbean} />
          </g>,
        );
      });
      add(<circle cx={cx + 22} cy={cy + 18} r="9" fill={F.sauce} />);
      add(<circle cx={cx + 22} cy={cy + 18} r="9" fill="none" stroke={F.plate} strokeWidth="1.5" />);
    } else {
      // Three tacos side by side, seen from above: a tortilla shell either side of the filling.
      const turn = (rnd() - 0.5) * 16 - 30;
      [-1, 0, 1].forEach((i) => {
        add(
          <g transform={`rotate(${turn.toFixed(0)} ${cx} ${cy}) translate(${cx + i * 15} ${cy})`}>
            <ellipse rx="7.5" ry="27" fill={F.char} />
            <ellipse rx="6.6" ry="26" fill={F.tortilla} />
            <ellipse rx="3.6" ry="22" fill={F.beef} />
            {[-15, -7, 1, 9, 16].map((y, j) => (
              <circle key={j} cx={(j % 2 ? 1 : -1) * 1.2} cy={y + rnd() * 3} r="1.6" fill={j % 3 === 0 ? F.tomato : j % 3 === 1 ? F.cheese : F.leaf2} />
            ))}
          </g>,
        );
      });
    }
  }

  if (kind === "plate") {
    if (has(/salmon/)) {
      add(<g transform={at(cx - 9, cy - 2, -18 + rnd() * 10)}><rect x="-19" y="-10.5" width="38" height="21" rx="8" fill={F.salmon} />{[-10, -3, 4, 11].map((x) => <path key={x} d={`M${x} -9 q-3 9 0 18`} stroke={F.salmonFat} strokeWidth="1.6" fill="none" strokeLinecap="round" />)}<path d="M-16 -7 h30" stroke="#c96a43" strokeWidth="2.2" strokeLinecap="round" opacity="0.5" /></g>);
    } else if (has(/tamagoyaki/)) {
      [0, 1, 2].forEach((i) =>
        add(
          <g transform={at(cx - 16 + i * 13, cy - 4 + i * 3, -8)}>
            <rect x="-6" y="-9" width="12" height="18" rx="3" fill={F.omelette} />
            <path d="M-3 -6 q5 2 0 5 q-5 3 0 6" stroke={F.omeletteShade} strokeWidth="1.3" fill="none" />
          </g>,
        ),
      );
    } else if (has(/chicken/)) {
      const glazed = has(/soy|ginger|honey/);
      if (has(/lemon/)) add(<g transform={at(cx - 9, cy - 2, -12 + rnd() * 10)}><path d="M-19 0 C-19 -10 -6 -13 4 -11 C15 -9 20 -3 19 3 C18 10 6 13 -4 12 C-14 11 -19 7 -19 0 Z" fill={F.chicken} /><path d="M-11 -5 l14 -2 M-12 1 l18 -2 M-9 7 l14 -2" stroke={F.sear} strokeWidth="1.8" strokeLinecap="round" /></g>);
      else ring(5, cx - 8, cy - 2, 11, rnd).forEach(([x, y, a]) => add(<Chicken x={x} y={y} r={a} glazed={glazed} />));
    }
    // the sides
    if (has(/spinach/)) scatter(9, cx + 18, cy + 14, 11, rnd).forEach(([x, y, a], i) => add(<Leaf x={x} y={y} r={a} s={0.95} dark={i % 3 !== 0} />));
    if (has(/green bean/)) {
      // a neat bundle, the way they are served
      const turn = 55 + rnd() * 30;
      [-6, -3, 0, 3, 6, 9].forEach((o, i) => add(<g transform={`translate(${cx + 19} ${cy + 12}) rotate(${turn.toFixed(0)})`}><GreenBean x={o * 0.9} y={(i % 2) * 1.5 - 1} r={(rnd() - 0.5) * 8} /></g>));
    }
    if (has(/honey|glaze/)) add(<path d={`M${cx - 24} ${cy - 6} q4 -5 8 0 t8 0 t8 0 t8 0`} transform={`rotate(-14 ${cx - 9} ${cy - 2})`} fill="none" stroke="#e9a53a" strokeWidth="1.8" strokeLinecap="round" opacity="0.9" />);
    if (has(/lemon/)) add(<Lemon x={cx + 22} y={cy - 16} r={rnd() * 60} />);
    if (has(/sesame|soy|ginger/)) scatter(14, cx + 4, cy + 4, 24, rnd).forEach(([x, y, a]) => add(<Sesame x={x} y={y} r={a} />));
    if (has(/honey|soy|ginger/)) scatter(5, cx - 8, cy - 2, 14, rnd).forEach(([x, y]) => add(<Scallion x={x} y={y} />));
  }

  // the vessel, and what sits around it on the table. On a shelf there is no table, and a
  // skillet dish is served on a plate.
  const onTable = frame === "table";
  const vessel: Kind = !onTable && kind === "skillet" ? "plate" : kind;
  const flip = seed % 2 === 0;
  const cutlery = !onTable ? "none" : asian ? "chopsticks" : kind === "bowl" ? "spoon" : "fork";
  return (
    <svg viewBox={onTable ? "12 3 136 102" : "31 11 98 98"} preserveAspectRatio="xMidYMid slice" className={className} role="img" aria-label={`An illustration of ${title}`}>
      <defs>
        <clipPath id={`${clip}-in`}>
          <circle cx={cx} cy={cy} r={vessel === "bowl" ? 36.5 : vessel === "skillet" ? 39 : 42} />
        </clipPath>
      </defs>
      {onTable && <rect width="160" height="120" fill="var(--parchment)" />}
      {/* a striped tea towel under one side */}
      {onTable && (
      <g transform={flip ? "rotate(-14 30 96)" : "rotate(12 132 26)"}>
        <rect x={flip ? -8 : 104} y={flip ? 72 : -6} width="58" height="44" rx="3" fill="var(--cobalt-tint)" />
        {[0, 1, 2].map((i) => (
          <rect key={i} x={flip ? -8 : 104} y={(flip ? 78 : 0) + i * 6} width="58" height="1.8" fill="var(--cobalt)" opacity="0.55" />
        ))}
      </g>
      )}
      {/* cutlery */}
      {cutlery === "chopsticks" && (
        <g transform={flip ? "rotate(-62 140 80)" : "rotate(58 20 40)"}>
          <rect x={flip ? 102 : -18} y={flip ? 78 : 38} width="62" height="3" rx="1.5" fill={F.wood} />
          <rect x={flip ? 102 : -18} y={flip ? 84 : 44} width="62" height="3" rx="1.5" fill={F.wood} />
        </g>
      )}
      {cutlery === "fork" && (
        <g transform={flip ? "translate(140 22) rotate(8)" : "translate(16 30) rotate(-8)"} fill={F.fork}>
          <rect x="-2" y="18" width="4" height="62" rx="2" />
          <path d="M-6 0 h2.2 v14 h1.2 v-14 h2.2 v14 h1.2 v-14 h2.2 v16 q0 5 -5 5 h0 q-5 0 -5 -5 z" />
        </g>
      )}
      {cutlery === "spoon" && (
        <g transform={flip ? "translate(142 24) rotate(10)" : "translate(16 28) rotate(-10)"} fill={F.fork}>
          <ellipse cx="0" cy="8" rx="6" ry="9" />
          <rect x="-2" y="15" width="4" height="62" rx="2" />
        </g>
      )}

      {/* the vessel's shadow, then the vessel */}
      {vessel === "skillet" ? (
        <g>
          <rect x={cx + 30} y={cy - 6} width="44" height="12" rx="6" fill={F.iron} transform={`rotate(${flip ? 28 : -28} ${cx} ${cy})`} />
          <circle cx={cx + 2.5} cy={cy + 3.5} r="46" fill="#3c2a14" opacity="0.14" />
          <circle cx={cx} cy={cy} r="45" fill={F.iron} />
          {/* a lit rim, so the pan keeps its edge on a dark table */}
          <circle cx={cx} cy={cy} r="44.4" fill="none" stroke={F.ironRim} strokeWidth="1.2" />
          <circle cx={cx} cy={cy} r="40" fill={F.ironIn} />
        </g>
      ) : (
        <g>
          {onTable && <circle cx={cx + 2.5} cy={cy + 3.5} r={vessel === "bowl" ? 44 : 47} fill="#3c2a14" opacity="0.13" />}
          <circle cx={cx} cy={cy} r={vessel === "bowl" ? 44 : 47} fill={F.plate} />
          <circle cx={cx} cy={cy} r={vessel === "bowl" ? 41.5 : 44.5} fill="none" stroke={F.rim} strokeWidth={vessel === "bowl" ? 3.4 : 2} />
          {vessel === "bowl" && <circle cx={cx} cy={cy} r="37" fill="#f3ede2" />}
        </g>
      )}
      <g clipPath={`url(#${clip}-in)`}>
        {/* plated food is drawn small and spread out; bring it closer so the plate looks full */}
        <g transform={kind === "plate" ? `translate(${cx} ${cy}) scale(1.22) translate(${-cx} ${-cy})` : undefined}>{food}</g>
      </g>
    </svg>
  );
}
