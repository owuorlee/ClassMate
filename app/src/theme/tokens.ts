/**
 * ClassMate design tokens — a single source of truth for the app's look.
 *
 * Aesthetic direction: "midnight campus." A deep, near-black canvas with
 * layered surfaces, an electric-violet primary, and a controlled set of vivid
 * category colors. Reads premium and modern without feeling toy-like — built
 * for university students who live on their phones.
 */

export const colors = {
  // Canvas & surfaces (layered, darkest → lightest)
  bg: '#08080C',
  bgElevated: '#0F0F17',
  surface: '#14141F',
  surfaceElevated: '#1B1B29',
  surfacePressed: '#232334',

  // Hairline borders
  border: 'rgba(255,255,255,0.07)',
  borderStrong: 'rgba(255,255,255,0.13)',

  // Text
  textPrimary: '#F6F6FA',
  textSecondary: '#A4A4B8',
  textMuted: '#6C6C82',
  textInverse: '#0A0A10',

  // Brand
  primary: '#7C5CFF',
  primaryBright: '#9D86FF',
  primarySoft: 'rgba(124,92,255,0.16)',
  primaryGradient: ['#8B6BFF', '#6B4EF0'] as const,

  // Feedback
  success: '#34D399',
  danger: '#FF5D73',
} as const;

/** Per-event-type accent + soft background. Keys match the server's EventType. */
export const category = {
  cat: { color: '#FFB020', soft: 'rgba(255,176,32,0.15)', label: 'CAT' },
  exam: { color: '#FF5D73', soft: 'rgba(255,93,115,0.15)', label: 'Exam' },
  assignment: { color: '#7C5CFF', soft: 'rgba(124,92,255,0.17)', label: 'Assignment' },
  class_update: { color: '#38BDF8', soft: 'rgba(56,189,248,0.15)', label: 'Class' },
  material: { color: '#34D399', soft: 'rgba(52,211,153,0.15)', label: 'Material' },
  announcement: { color: '#94A3B8', soft: 'rgba(148,163,184,0.15)', label: 'Notice' },
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;

/** Font family names as exported by @expo-google-fonts/{sora,inter}. */
export const font = {
  display: 'Sora_700Bold',
  displaySemi: 'Sora_600SemiBold',
  displayExtra: 'Sora_800ExtraBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
} as const;

export const type = {
  hero: { fontFamily: font.displayExtra, fontSize: 30, lineHeight: 36 },
  h1: { fontFamily: font.display, fontSize: 24, lineHeight: 30 },
  h2: { fontFamily: font.displaySemi, fontSize: 19, lineHeight: 25 },
  title: { fontFamily: font.bodySemi, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: font.body, fontSize: 14, lineHeight: 21 },
  bodyMedium: { fontFamily: font.bodyMedium, fontSize: 14, lineHeight: 21 },
  bodySemi: { fontFamily: font.bodySemi, fontSize: 14, lineHeight: 21 },
  label: { fontFamily: font.bodySemi, fontSize: 12, lineHeight: 16 },
  caption: { fontFamily: font.bodyMedium, fontSize: 11.5, lineHeight: 15 },
} as const;

/** Soft elevation for cards on the dark canvas. */
export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  glow: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 10,
  },
} as const;
