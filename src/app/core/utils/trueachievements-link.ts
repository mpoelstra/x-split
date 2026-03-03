const collapseDashes = (value: string): string => value.replace(/-+/g, '-');
const normalizeLookupKey = (value: string): string =>
  collapseDashes(
    value
      .trim()
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/['’`]/g, '')
      .replace(/[®™]/g, '')
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  );

const trueAchievementsOverrides: Record<string, string> = {
  'tomb-raider-i-iii-remastered-starring-lara-croft':
    'Tomb-Raider-1-3-Remastered',
  'tomb-raider-1-3-remastered-starring-lara-croft':
    'Tomb-Raider-1-3-Remastered',
  'tomb-raider-1-3-remastered': 'Tomb-Raider-1-3-Remastered'
};

export const trueAchievementsGameUrl = (gameTitle: string): string => {
  const override = trueAchievementsOverrides[normalizeLookupKey(gameTitle)];
  if (override) {
    return `https://www.trueachievements.com/game/${override}/achievements`;
  }

  const slug = collapseDashes(
    gameTitle
      .trim()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/['’`]/g, '')
      .replace(/[®™]/g, '')
      .replace(/&/g, ' and ')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  );

  return `https://www.trueachievements.com/game/${slug}/achievements`;
};
