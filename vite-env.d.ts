export const DESIGN = {
  width: 1080,
  height: 1920
} as const;

export const STORY = {
  title: 'My forever love',
  audioFile: 'audio/scene-1.mp3',
  duration: 78,
  cues: {
    penguinsEnter: 0.8,
    kiss: 4.2,
    emotionalDrop: 8.8,
    underIce: 11.5,
    firstCrack: 13.0,
    deepWater: 27.0,
    creatures: 31.0,
    whale: 42.0,
    eyePortal: 53.0,
    stars: 58.0,
    ending: 74.0
  },
  messages: [
    { at: 13.4, duration: 4.0, text: 'until the end' },
    { at: 18.2, duration: 4.3, text: 'i love you, always' },
    { at: 23.4, duration: 4.0, text: 'never let go' },
    { at: 28.5, duration: 4.6, text: 'planting the seed' },
    { at: 34.5, duration: 5.0, text: 'my forever…' },
    { at: 50.0, duration: 5.0, text: 'my forever love' },
    { at: 60.0, duration: 7.0, text: 'and now, traveling through the stars…' }
  ]
} as const;
