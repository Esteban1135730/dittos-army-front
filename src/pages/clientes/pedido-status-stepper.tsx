import { Box, Step, StepLabel, Stepper, Typography } from "@mui/material";
import type { PedidoStatus } from "./pedido-types";
import { PEDIDO_STEPS, pedidoStatusStepIndex } from "./pedido-ui-utils";

type Props = {
  status: PedidoStatus;
  compact?: boolean;
};

export default function PedidoStatusStepper({ status, compact }: Props) {
  const active = pedidoStatusStepIndex(status);
  return (
    <Box sx={{ width: "100%", overflowX: "auto" }}>
      <Stepper activeStep={active} alternativeLabel={!compact} sx={{ minWidth: compact ? 280 : 360 }}>
        {PEDIDO_STEPS.map((label, i) => (
          <Step key={label} completed={i < active || (i === active && status === "entregado")}>
            <StepLabel
              optional={
                compact ? undefined : (
                  <Typography variant="caption" color="text.secondary">
                    {i === 0 && "Cartas apartadas"}
                    {i === 1 && "Cliente pagó"}
                    {i === 2 && "Entrega hecha"}
                  </Typography>
                )
              }
            >
              {label}
            </StepLabel>
          </Step>
        ))}
      </Stepper>
    </Box>
  );
}
