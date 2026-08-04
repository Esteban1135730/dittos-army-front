import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import { OWNERS_CONFIG, type OwnerKey } from "../../config/owners";
import { useOwner } from "./owner-context";

type OwnerSelectProps = {
  /** Called when user tries to switch owner; return false to abort. */
  onBeforeChange?: (next: OwnerKey) => boolean;
};

export function OwnerSelect({ onBeforeChange }: OwnerSelectProps) {
  const { owner, setOwner } = useOwner();

  return (
    <FormControl
      size="small"
      fullWidth
      sx={{
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
      }}
    >
      <InputLabel id="owner-select-label">Usuario</InputLabel>
      <Select
        labelId="owner-select-label"
        label="Usuario"
        value={owner}
        onChange={(e) => {
          const next = e.target.value as OwnerKey;
          if (onBeforeChange && !onBeforeChange(next)) return;
          setOwner(next);
        }}
      >
        {Object.values(OWNERS_CONFIG.owners).map((o) => (
          <MenuItem key={o.key} value={o.key}>
            {o.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
