import { translations } from './translations';

let currentLanguage: 'zh' | 'en' = 'en';

/**
 * Detect browser language
 */
export function detectLanguage(): 'zh' | 'en' {
  const lang = navigator.language.toLowerCase();
  return lang.startsWith('zh') ? 'zh' : 'en';
}

/**
 * Get current language
 */
export function getCurrentLanguage(): 'zh' | 'en' {
  return currentLanguage;
}

/**
 * Set current language
 */
export function setLanguage(lang: 'zh' | 'en'): void {
  currentLanguage = lang;
}

/**
 * Translate a key to the current language
 */
export function t(key: string): string {
  const translation = translations[currentLanguage][key];
  if (!translation) {
    console.warn(`Translation missing for key: ${key}`);
    return key;
  }
  return translation;
}

/**
 * Initialize i18n for the page
 * Automatically detects language and translates all elements with data-i18n attribute
 */
export function initI18n(): void {
  currentLanguage = detectLanguage();

  // Translate all elements with data-i18n attribute
  const elements = document.querySelectorAll('[data-i18n]');
  elements.forEach((element) => {
    const key = element.getAttribute('data-i18n');
    if (key) {
      const translation = t(key);

      // Handle HTML content (for elements with <strong> tags, etc.)
      if (translation.includes('<strong>')) {
        element.innerHTML = translation;
      } else {
        element.textContent = translation;
      }
    }
  });

  // Translate all elements with data-i18n-placeholder attribute
  const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
  placeholderElements.forEach((element) => {
    const key = element.getAttribute('data-i18n-placeholder');
    if (key && element instanceof HTMLInputElement) {
      element.placeholder = t(key);
    }
  });
}
