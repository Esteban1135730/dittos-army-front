import { useState } from 'react';
import { TextField, type SxProps, type Theme } from '@mui/material';

type HomologSearchFieldProps = {
  placeholder: string;
  onApply: (query: string) => void;
  sx?: SxProps<Theme>;
};

/** Input de búsqueda con estado local: escribir no re-renderiza el resto de la página. */
export function HomologSearchField({ placeholder, onApply, sx }: HomologSearchFieldProps) {
  const [draft, setDraft] = useState('');

  return (
    <TextField
      fullWidth
      size="small"
      type="search"
      placeholder={placeholder}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onApply(draft);
        }
      }}
      sx={sx}
    />
  );
}
