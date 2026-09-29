import { FormControl, FormHelperText, InputLabel, MenuItem, Select } from "@mui/material";
import { getApiTcgHeader } from "../../config/api";
import {
  ownersForTcg,
  type OwnerKey,
} from "../../config/owners";

type TransitLotOwnerSelectProps = {
  value: OwnerKey;
  onChange: (owner: OwnerKey) => void;
  disabled?: boolean;
  helperText?: string;
  /** Sufijo único para labelId cuando hay varios selects en la página. */
  id?: string;
};

export function TransitLotOwnerSelect(props: TransitLotOwnerSelectProps) {
  const { value, onChange, disabled, helperText, id = "default" } = props;
  const labelId = `transit-lot-owner-${id}`;
  const options = ownersForTcg(getApiTcgHeader());

  return (
    <FormControl size="small" fullWidth disabled={disabled}>
      <InputLabel id={labelId}>Dueño</InputLabel>
      <Select
        labelId={labelId}
        label="Dueño"
        value={value}
        onChange={(e) => onChange(e.target.value as OwnerKey)}
      >
        {options.map((o) => (
          <MenuItem key={o.key} value={o.key}>
            {o.label}
          </MenuItem>
        ))}
      </Select>
      {helperText ? <FormHelperText>{helperText}</FormHelperText> : null}
    </FormControl>
  );
}
