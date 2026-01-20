import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

interface LanguageSwitcherProps {
  variant?: 'button' | 'menu-item';
  onSelect?: () => void;
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ variant = 'button', onSelect }) => {
  const { i18n, t } = useTranslation();

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'zh', name: '中文' },
    { code: 'es-VE', name: 'Español (Venezuela)' },
    { code: 'es-AR', name: 'Español (Argentina)' },
    { code: 'es-CL', name: 'Español (Chile)' },
    { code: 'pt-BR', name: 'Português (Brasil)' },
    { code: 'en-NG', name: 'English (Nigeria)' },
    { code: 'sw-KE', name: 'Kiswahili (Kenya)' },
    { code: 'th', name: 'ไทย (Thailand)' },
    { code: 'ms', name: 'Bahasa Melayu (Malaysia)' },
    { code: 'vi', name: 'Tiếng Việt (Vietnam)' },
    { code: 'id', name: 'Bahasa Indonesia' },
  ];

  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

  const handleLanguageChange = (langCode: string) => {
    i18n.changeLanguage(langCode);
    if (onSelect) {
      onSelect();
    }
  };

  if (variant === 'menu-item') {
    // 作为菜单项使用
    return (
      <div className="relative">
        <button
          type="button"
          className="w-full px-4 py-3 text-sm font-bold text-slate-800 hover:bg-gray-50 flex items-center justify-between border-t border-gray-100 transition-colors"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <span className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-500" />
            {t('common.language')}
          </span>
          <span className="text-gray-400 text-xs">{currentLanguage.name}</span>
        </button>
        {/* 语言选项子菜单 */}
        <div className="border-t border-gray-100">
          {languages.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleLanguageChange(lang.code);
              }}
              className={`w-full px-4 py-2 text-sm hover:bg-gray-50 transition text-left pl-12 ${
                i18n.language === lang.code ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'
              }`}
            >
              {lang.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // 作为独立按钮使用
  return (
    <div className="relative group">
      <button
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition text-sm text-gray-700"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <Globe className="w-4 h-4" />
        <span>{currentLanguage.name}</span>
      </button>
      <div className="absolute top-full right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[120px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => {
              handleLanguageChange(lang.code);
            }}
            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition ${
              i18n.language === lang.code ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'
            }`}
          >
            {lang.name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default LanguageSwitcher;
