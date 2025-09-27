import ru from './locales/ru.json';
import uz from './locales/uz.json';

type TranslationKeys = keyof typeof ru & keyof typeof uz;

export type Translations = {
  [key in TranslationKeys]: string;
};


export const translations: {
    ru: Translations,
    uz: Translations
} = {
  ru,
  uz,
};
