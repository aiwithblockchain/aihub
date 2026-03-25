/**
 * aiClaw i18n Module
 * Detects browser language and provides translation functions
 */

import { translations } from './translations';

type Language = 'zh' | 'en';

/**
 * Detect browser language
 * Returns 'zh' for Chinese (zh/zh-CN/zh-TW), 'en' for others
 */
function detectLanguage(): Language {
    const lang = navigator.language.toLowerCase();
    return lang.startsWith('zh') ? 'zh' : 'en';
}

const currentLanguage: Language = detectLanguage();

/**
 * Get translated text for a key
 * @param key Translation key (e.g., 'app.title')
 * @returns Translated text
 */
export function t(key: string): string {
    const text = translations[currentLanguage]?.[key];
    if (!text) {
        console.warn(`[i18n] Missing translation for key: ${key}`);
        return key;
    }
    return text;
}

/**
 * Initialize i18n for HTML elements with data-i18n attribute
 */
export function initI18n(): void {
    document.querySelectorAll('[data-i18n]').forEach((element) => {
        const key = element.getAttribute('data-i18n');
        if (key) {
            element.textContent = t(key);
        }
    });

    // Handle placeholder attributes
    document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
        const key = element.getAttribute('data-i18n-placeholder');
        if (key && element instanceof HTMLInputElement) {
            element.placeholder = t(key);
        }
    });
}

/**
 * Get current language
 */
export function getCurrentLanguage(): Language {
    return currentLanguage;
}
