/**
 * Central brand configuration.
 * Change the brand name/identity here after client review — nothing else
 * in the app should hardcode the product name.
 */
export const BRAND = {
  name: 'DramaRush',
  tagline: 'Stories made for every moment.',
  legalName: 'DramaRush Prototype',
  scheme: 'dramarush',
  supportEmail: 'support@dramarush.app',
  websiteUrl: 'https://dramarush.app',
  currency: {
    coinName: 'Coin',
    coinNamePlural: 'Coins',
    coinSymbol: '🪙',
  },
} as const;

export const IS_PROTOTYPE = true;
