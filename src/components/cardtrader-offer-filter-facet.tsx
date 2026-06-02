import type { ReactNode } from "react";
import { Box, Chip, Typography } from "@mui/material";
import { LanguageChipLabel } from "../utils/cardtrader-language-flags";
import { conditionChipSx } from "../utils/cardtrader-marketplace-offers";

export function OfferFilterFacet({
  hint,
  options,
  selected,
  onToggle,
  renderLabel,
  chipSxForValue,
  withFlagIcon,
}: {
  hint?: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  renderLabel?: (value: string) => ReactNode;
  chipSxForValue?: (value: string) => Record<string, unknown> | undefined;
  withFlagIcon?: boolean;
}) {
  if (options.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {hint ?? "Sin opciones en el listado."}
      </Typography>
    );
  }
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
      {options.map((value) => {
        const isOn = selected.includes(value);
        const customSx = isOn ? chipSxForValue?.(value) : undefined;
        return (
          <Chip
            key={value}
            label={
              renderLabel
                ? renderLabel(value)
                : withFlagIcon
                  ? <LanguageChipLabel lang={value} flagWidth={18} />
                  : value
            }
            clickable
            onClick={() => onToggle(value)}
            variant={isOn ? "filled" : "outlined"}
            color={isOn && !customSx ? "primary" : "default"}
            sx={{
              fontWeight: isOn ? 600 : 500,
              borderRadius: 2,
              height: 32,
              bgcolor: isOn ? undefined : "background.paper",
              borderColor: isOn ? "transparent" : "divider",
              transition: "background-color 0.15s, box-shadow 0.15s",
              "& .MuiChip-icon": { ml: 0.25, mr: -0.25 },
              "& .MuiChip-label": { fontFamily: "inherit" },
              ...(isOn && customSx ? customSx : {}),
              "&:hover": { boxShadow: 1 },
            }}
          />
        );
      })}
    </Box>
  );
}

export { conditionChipSx };
