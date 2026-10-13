import type { I18nText } from './i18n-text';
import type { Tetri } from './money';

export type SpiceLevel = 0 | 1 | 2 | 3;

export type MenuOption = {
  slug: string;
  name: I18nText;
  priceDeltaTetri: Tetri;
  isDefault: boolean;
  isAvailable: boolean;
};

export type MenuModifierGroup = {
  slug: string;
  name: I18nText;
  minSelect: number;
  maxSelect: number;
  options: MenuOption[];
};

export type MenuItem = {
  slug: string;
  categorySlug: string;
  name: I18nText;
  description: I18nText | null;
  priceTetri: Tetri;
  photoPath: string | null;
  isVeg: boolean;
  spiceLevel: SpiceLevel | null;
  allergens: string[];
  isPopular: boolean;
  /** Effective availability: available in the menu source and not switched off by the kitchen. */
  isAvailable: boolean;
  modifierGroups: MenuModifierGroup[];
};

export type MenuCategory = {
  slug: string;
  name: I18nText;
  blurb: I18nText | null;
};

export type Menu = {
  categories: MenuCategory[];
  items: MenuItem[];
};

export const isRequiredGroup = (group: MenuModifierGroup) => group.minSelect > 0;
