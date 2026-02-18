import { useEffect, useState } from 'react';
import { Copy, Eye, EyeOff } from 'lucide-react';

interface PasswordFieldProps {
  value: string;
  label?: string;
  onCopy?: (value: string) => void | Promise<void>;
  onChange?: (next: string) => void;
  disabled?: boolean;
}

const AUTO_REHIDE_SECONDS = 10;

export function PasswordField({ value, label = 'Password', onCopy, onChange, disabled = false }: PasswordFieldProps) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!revealed) {
      return;
    }

    const timer = window.setTimeout(() => {
      setRevealed(false);
    }, AUTO_REHIDE_SECONDS * 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [revealed]);

  useEffect(() => {
    setRevealed(false);
  }, [value]);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-200">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type={revealed ? 'text' : 'password'}
          value={value}
          onChange={onChange ? (event) => onChange(event.target.value) : undefined}
          readOnly={!onChange}
          disabled={disabled}
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-offset-0 focus:border-slate-500"
        />

        <button
          type="button"
          onClick={() => setRevealed((current) => !current)}
          className="rounded-md border border-slate-700 p-2 hover:border-slate-500"
          aria-label={revealed ? 'Hide password' : 'Show password'}
          disabled={disabled}
        >
          {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>

        <button
          type="button"
          onClick={() => {
            if (onCopy) {
              void onCopy(value);
            }
          }}
          className="rounded-md border border-slate-700 p-2 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Copy password"
          disabled={disabled || !onCopy}
        >
          <Copy size={16} />
        </button>
      </div>

      <p className="text-xs text-slate-400">Revealed values auto-hide after {AUTO_REHIDE_SECONDS}s.</p>
    </div>
  );
}
