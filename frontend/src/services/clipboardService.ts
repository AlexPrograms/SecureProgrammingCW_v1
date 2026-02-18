export const copyToClipboard = async (value: string): Promise<boolean> => {
  if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
    return false;
  }

  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
};

export const clearClipboardBestEffort = async (): Promise<boolean> => {
  if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
    return false;
  }

  try {
    await navigator.clipboard.writeText('');
    return true;
  } catch {
    return false;
  }
};
