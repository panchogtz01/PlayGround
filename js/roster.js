export const TAU = Math.PI * 2;

export const WORLD = {
  w: 1600,
  h: 1000,
  left: 168,
  right: 1432,
  top: 182,
  bottom: 816,
  cx: 800,
  cy: 500
};

export const ROLE = {
  brawler: {
    key: 'brawler',
    label: 'CORTA DISTANCIA',
    short: 'CORTA',
    weapon: 'HUEVO DE OBSIDIANA',
    hp: 220,
    speed: 266,
    radius: 31,
    fireDelay: 1.1,
    projSpeed: 600,
    range: 480,
    damage: 23,
    poolDps: 15,
    poolLife: 2.8,
    poolRadius: 52,
    specialCd: 9,
    dashCd: 2.7,
    preferred: 280,
    desc: 'Huevos negros que revientan en lava verde.'
  },
  sniper: {
    key: 'sniper',
    label: 'LARGA DISTANCIA',
    short: 'LARGA',
    weapon: 'PLUMA ÍGNEA',
    hp: 180,
    speed: 256,
    radius: 27,
    fireDelay: 1.0,
    projSpeed: 1220,
    range: 780,
    damage: 29,
    pierce: 2,
    burnDps: 8,
    burnTime: 1.6,
    specialCd: 10,
    dashCd: 2.7,
    preferred: 520,
    desc: 'Plumas perforantes que queman a distancia.'
  }
};

export const TEAM = [
  { id: 0, name: 'AZUL', color: '#38d6ff', soft: '#9beaff', dark: '#0b4a5e' },
  { id: 1, name: 'ROJO', color: '#ff4d63', soft: '#ffb3bd', dark: '#5e0b16' }
];

export const FIGHTERS = [
  {
    id: 'rex', name: 'REX', title: 'EL DEMOLEDOR', role: 'brawler', team: 0,
    palette: { skin: '#e9a96f', skinDark: '#b7744a', skinLight: '#ffd2a0', feather: '#ffe9b8', featherDark: '#d6ab68', comb: '#ff4a35', combDark: '#9c1d12', beak: '#ffc23c', glove: '#2b3033', metal: '#6d7c82', accent: '#38d6ff' }
  },
  {
    id: 'titan', name: 'TITÁN', title: 'PUÑO DE HIERRO', role: 'brawler', team: 0,
    palette: { skin: '#cb8a56', skinDark: '#8f5733', skinLight: '#eebb85', feather: '#f7dba3', featherDark: '#c39a62', comb: '#e83b2a', combDark: '#7d160e', beak: '#ffcf5a', glove: '#3a2b23', metal: '#8b7a5f', accent: '#38d6ff' }
  },
  {
    id: 'vertigo', name: 'VÉRTIGO', title: 'OJO DE HALCÓN', role: 'sniper', team: 0,
    palette: { skin: '#efc9a4', skinDark: '#b98a61', skinLight: '#ffe4c4', feather: '#fff0cf', featherDark: '#d6bd93', comb: '#ff5a3c', combDark: '#a12612', beak: '#ffd05a', glove: '#263038', metal: '#728892', accent: '#38d6ff' }
  },
  {
    id: 'jade', name: 'JADE', title: 'PLUMA VERDE', role: 'sniper', team: 0,
    palette: { skin: '#d9b98a', skinDark: '#a27a50', skinLight: '#f4dbb2', feather: '#e9ffd6', featherDark: '#b7d79c', comb: '#ff4664', combDark: '#8e1f30', beak: '#ffd25e', glove: '#293a33', metal: '#6f967c', accent: '#38d6ff' }
  },
  {
    id: 'garra', name: 'GARRA', title: 'LA SIERRA', role: 'brawler', team: 1,
    palette: { skin: '#d99b6c', skinDark: '#9c5f3d', skinLight: '#f6c190', feather: '#3a3f42', featherDark: '#222629', comb: '#ff2d55', combDark: '#8a0f24', beak: '#ffb347', glove: '#1e2225', metal: '#6b7378', accent: '#ff4d63' }
  },
  {
    id: 'maza', name: 'MAZA', title: 'EL VERDUGO', role: 'brawler', team: 1,
    palette: { skin: '#b47a50', skinDark: '#7c4c2d', skinLight: '#dba877', feather: '#4a3a36', featherDark: '#2b211f', comb: '#ff3a2d', combDark: '#821208', beak: '#ffc04d', glove: '#231c19', metal: '#7b6a58', accent: '#ff4d63' }
  },
  {
    id: 'cuervo', name: 'CUERVO', title: 'SOMBRA FRÍA', role: 'sniper', team: 1,
    palette: { skin: '#b79581', skinDark: '#7f604f', skinLight: '#dcc0a9', feather: '#2d3340', featherDark: '#191d26', comb: '#ff2d55', combDark: '#7e0f22', beak: '#f0b552', glove: '#171c23', metal: '#5c7079', accent: '#ff4d63' }
  },
  {
    id: 'onix', name: 'ÓNIX', title: 'EL ÚLTIMO PLUMERO', role: 'sniper', team: 1,
    palette: { skin: '#a47c62', skinDark: '#6c4c3a', skinLight: '#caa489', feather: '#22262a', featherDark: '#0f1113', comb: '#ff4664', combDark: '#7a1022', beak: '#e8a93e', glove: '#14181b', metal: '#697b80', accent: '#ff4d63' }
  }
];

export const SPAWNS = [
  [330, 278], [330, 426], [330, 574], [330, 722],
  [1270, 278], [1270, 426], [1270, 574], [1270, 722]
];
