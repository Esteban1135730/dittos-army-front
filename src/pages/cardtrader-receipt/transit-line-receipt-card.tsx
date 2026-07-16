import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import type { PanelHomologItem, SentHomologUnit } from '../../utils/sent-unit-homolog';
import { HomologCardImage } from '../incoming-v2/homolog-card-image';
import { resolvePanelImageSrc } from '../incoming-v2/use-homolog-blueprint-images';

type TransitLineReceiptCardProps = {
  panelItem: PanelHomologItem;
  assignedUnits: SentHomologUnit[];
  onUndoUnit?: (sentUnitKey: string) => void;
  undoDisabled?: boolean;
};

function completionColor(assigned: number, ordered: number): 'success' | 'warning' | 'default' {
  if (assigned === 0) return 'default';
  if (assigned >= ordered) return 'success';
  return 'warning';
}

export function TransitLineReceiptCard({
  panelItem,
  assignedUnits,
  onUndoUnit,
  undoDisabled,
}: TransitLineReceiptCardProps) {
  const { assigned_in_session, remaining_quantity, quantity_ordered, card_name, language, rareza } =
    panelItem;
  const imgSrc = resolvePanelImageSrc(panelItem.image_url);
  const isComplete = assigned_in_session >= remaining_quantity;
  const color = completionColor(assigned_in_session, remaining_quantity);

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        borderColor: isComplete ? 'success.main' : assigned_in_session > 0 ? 'warning.main' : '#e0e0e0',
        bgcolor: isComplete ? '#f0faf0' : assigned_in_session > 0 ? '#fffde7' : '#fff',
      }}
    >
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
        <HomologCardImage src={imgSrc} alt={card_name} variant="candidate" />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" mb={0.5}>
            <Typography variant="subtitle2" fontWeight={600} noWrap sx={{ flex: 1, minWidth: 0 }}>
              {card_name}
            </Typography>
            <Chip
              size="small"
              color={color}
              label={
                isComplete
                  ? `✓ Completo ${assigned_in_session}/${remaining_quantity}`
                  : assigned_in_session > 0
                    ? `Parcial ${assigned_in_session}/${remaining_quantity}`
                    : `Pendiente 0/${remaining_quantity}`
              }
            />
          </Stack>

          <Typography variant="caption" color="text.secondary" display="block">
            {language}
            {rareza ? ` · ${rareza}` : ''}
            {' · '}Ordenadas: {quantity_ordered}
          </Typography>

          {assignedUnits.length > 0 && (
            <Stack spacing={0.25} mt={0.75}>
              {assignedUnits.map((u) => (
                <Box
                  key={u.sent_unit_key}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    py: 0.25,
                    px: 0.5,
                    borderRadius: 0.5,
                    bgcolor: 'success.50',
                  }}
                >
                  <Typography variant="caption" color="success.dark" sx={{ flex: 1, minWidth: 0 }} noWrap>
                    ✓ Sent unit #{u.unit_index} · {u.order_code}
                  </Typography>
                  {onUndoUnit && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ cursor: undoDisabled ? 'default' : 'pointer', '&:hover': undoDisabled ? {} : { color: 'error.main' } }}
                      onClick={() => !undoDisabled && onUndoUnit(u.sent_unit_key)}
                    >
                      Deshacer
                    </Typography>
                  )}
                </Box>
              ))}
            </Stack>
          )}

          {assigned_in_session === 0 && (
            <Typography variant="caption" color="text.disabled" display="block" mt={0.5}>
              Sin sent units asignadas todavía
            </Typography>
          )}
        </Box>
      </Box>
    </Paper>
  );
}
