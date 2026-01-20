import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enCommon from '../locales/en/common.json';
import zhCommon from '../locales/zh/common.json';
import esVECommon from '../locales/es-VE/common.json';
import esARCommon from '../locales/es-AR/common.json';
import esCLCommon from '../locales/es-CL/common.json';
import ptBRCommon from '../locales/pt-BR/common.json';
import enNGCommon from '../locales/en-NG/common.json';
import swKECommon from '../locales/sw-KE/common.json';
import thCommon from '../locales/th/common.json';
import msCommon from '../locales/ms/common.json';
import viCommon from '../locales/vi/common.json';
import idCommon from '../locales/id/common.json';

const resources = {
  en: {
    translation: {
      ...enCommon,
    },
  },
  zh: {
    translation: {
      ...zhCommon,
    },
  },
  'es-VE': {
    translation: {
      ...esVECommon,
    },
  },
  'es-AR': {
    translation: {
      ...esARCommon,
    },
  },
  'es-CL': {
    translation: {
      ...esCLCommon,
    },
  },
  'pt-BR': {
    translation: {
      ...ptBRCommon,
    },
  },
  'en-NG': {
    translation: {
      ...enNGCommon,
    },
  },
  'sw-KE': {
    translation: {
      ...swKECommon,
    },
  },
  th: {
    translation: {
      ...thCommon,
    },
  },
  ms: {
    translation: {
      ...msCommon,
    },
  },
  vi: {
    translation: {
      ...viCommon,
    },
  },
  id: {
    translation: {
      ...idCommon,
    },
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    defaultNS: 'translation',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
  });

export default i18n;
