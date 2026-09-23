import { FormControl, InputLabel, MenuItem, Select, type SelectChangeEvent } from "@mui/material";
import type { ReactNode } from "react";

const panelSelectSx = {
  "& .MuiInputBase-root": {
    color: "common.white",
    bgcolor: "rgba(0,0,0,0.25)",
    fontSize: 13,
    borderRadius: 1.5,
  },
  "& .MuiInputLabel-root": { color: "grey.400", fontSize: 13 },
  "& .MuiInputLabel-root.Mui-focused": { color: "grey.300" },
  "& .MuiOutlinedInput-notchedOutline": {
    borderColor: "rgba(255,255,255,0.12)",
  },
  "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
    borderColor: "rgba(255,255,255,0.25)",
  },
  "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
    borderColor: "rgba(255,255,255,0.35)",
  },
  "& .MuiSvgIcon-root": { color: "grey.400" },
  "& .MuiSelect-select": { py: 1 },
};

type Option = { value: string; label: string };

type PanelSelectProps = {
  id: string;
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
};

/** Select oscuro del menú lateral (usuario y TCG). */
export function PanelSelect({ id, label, value, options, onChange }: PanelSelectProps) {
  return (
    <FormControl size="small" fullWidth sx={panelSelectSx}>
      <InputLabel id={id}>{label}</InputLabel>
      <Select
        labelId={id}
        label={label}
        value={value}
        onChange={(e: SelectChangeEvent<string>, _child: ReactNode) => {
          onChange(e.target.value);
        }}
      >
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
