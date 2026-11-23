import type { ThemeMode } from '@/services/theme';

interface Props {
  themeMode: ThemeMode;
  onChange(mode: ThemeMode): void;
}

const OPTIONS = [
  { value: 'system', label: 'Follow system' },
  { value: 'dark', label: 'On' },
  { value: 'light', label: 'Off' },
] as const;

export function AppearanceSection({ themeMode, onChange }: Props) {
  return (
    <section className="appearance-settings" aria-labelledby="appearance-settings-title">
      <h3 id="appearance-settings-title">Appearance</h3>
      <p className="settings-help">Choose how Frame looks. “Follow system” matches your device setting.</p>
      <div className="theme-switch" role="radiogroup" aria-label="Theme">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={themeMode === option.value}
            className={themeMode === option.value ? 'active' : ''}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </section>
  );
}
