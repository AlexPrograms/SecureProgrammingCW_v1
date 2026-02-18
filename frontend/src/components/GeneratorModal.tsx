import { useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { RefreshCcw } from 'lucide-react';

import { PasswordField } from './PasswordField';

interface GeneratorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUse: (password: string) => void;
  onCopy: (password: string) => void | Promise<void>;
}

const charsets = {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  digits: '0123456789',
  symbols: '!@#$%^&*()_+[]{}<>?/|~',
  ambiguous: 'O0Il1'
};

const buildPassword = (
  length: number,
  options: {
    upper: boolean;
    lower: boolean;
    digits: boolean;
    symbols: boolean;
    avoidAmbiguous: boolean;
  }
): string => {
  let pool = '';

  if (options.upper) pool += charsets.upper;
  if (options.lower) pool += charsets.lower;
  if (options.digits) pool += charsets.digits;
  if (options.symbols) pool += charsets.symbols;

  if (!pool) {
    return '';
  }

  if (options.avoidAmbiguous) {
    pool = [...pool].filter((char) => !charsets.ambiguous.includes(char)).join('');
  }

  if (!pool) {
    return '';
  }

  let output = '';
  const randomValues = new Uint32Array(length);
  crypto.getRandomValues(randomValues);

  for (let index = 0; index < length; index += 1) {
    output += pool[randomValues[index] % pool.length];
  }

  return output;
};

export function GeneratorModal({ open, onOpenChange, onUse, onCopy }: GeneratorModalProps) {
  const [length, setLength] = useState(20);
  const [upper, setUpper] = useState(true);
  const [lower, setLower] = useState(true);
  const [digits, setDigits] = useState(true);
  const [symbols, setSymbols] = useState(true);
  const [avoidAmbiguous, setAvoidAmbiguous] = useState(true);
  const [generated, setGenerated] = useState('');

  const hasAnyCharset = useMemo(() => upper || lower || digits || symbols, [upper, lower, digits, symbols]);

  const regenerate = (): void => {
    setGenerated(
      buildPassword(length, {
        upper,
        lower,
        digits,
        symbols,
        avoidAmbiguous
      })
    );
  };

  useEffect(() => {
    if (open) {
      setGenerated(
        buildPassword(length, {
          upper,
          lower,
          digits,
          symbols,
          avoidAmbiguous
        })
      );
    }
  }, [open, length, upper, lower, digits, symbols, avoidAmbiguous]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(38rem,94vw)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-slate-700 bg-slate-900 p-5 text-slate-100 shadow-2xl focus:outline-none">
          <Dialog.Title className="text-lg font-semibold">Password generator</Dialog.Title>

          <div className="mt-4 space-y-4">
            <label className="block text-sm">
              Length: <span className="font-semibold">{length}</span>
              <input
                type="range"
                min={12}
                max={64}
                value={length}
                onChange={(event) => setLength(Number(event.target.value))}
                className="mt-2 w-full"
              />
            </label>

            <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={upper} onChange={(event) => setUpper(event.target.checked)} />
                Uppercase
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={lower} onChange={(event) => setLower(event.target.checked)} />
                Lowercase
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={digits} onChange={(event) => setDigits(event.target.checked)} />
                Digits
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={symbols} onChange={(event) => setSymbols(event.target.checked)} />
                Symbols
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={avoidAmbiguous}
                  onChange={(event) => setAvoidAmbiguous(event.target.checked)}
                />
                Avoid ambiguous
              </label>
            </div>

            {!hasAnyCharset ? <p className="text-sm text-rose-300">Select at least one character set.</p> : null}

            <PasswordField value={generated} onCopy={onCopy} disabled={!hasAnyCharset || !generated} />

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={regenerate}
                className="inline-flex items-center gap-2 rounded-md border border-slate-600 px-3 py-2 text-sm hover:border-slate-400"
                disabled={!hasAnyCharset}
              >
                <RefreshCcw size={14} />
                Regenerate
              </button>
              <button
                type="button"
                onClick={() => {
                  if (generated) {
                    onUse(generated);
                    onOpenChange(false);
                  }
                }}
                className="rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-sky-900"
                disabled={!generated}
              >
                Use
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
