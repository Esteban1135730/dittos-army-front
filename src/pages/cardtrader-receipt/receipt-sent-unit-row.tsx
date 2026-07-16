import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import type { PanelHomologItem, SentHomologUnit } from '../../utils/sent-unit-homolog';
import { HomologCardImage } from '../incoming-v2/homolog-card-image';
import { resolvePanelImageSrc } from '../incoming-v2/use-homolog-blueprint-images';
import { resolveBlueprintImageSrc } from '../incoming-v2/use-homolog-blueprint-images';

type ReceiptSentUnitRowProps = {
  unit: SentHomologUnit;
  panelItems: PanelHomologItem[];
  blueprintImages: Record<number, string>;
  onVerify: (sentUnitKey: string, transitLineId: string) => void;
  onNovedad: (sentUnitKey: string) => void;
  disabled?: boolean;
};

export function ReceiptSentUnitRow({
  unit,
  panelItems,
  blueprintImages,
  onVerify,
  onNovedad,
  disabled,
}: ReceiptSentUnitRowProps) {
  const [expanded, setExpanded] = useState(false);
  const thumbSrc = resolveBlueprintImageSrc(unit.blueprint_id, blueprintImages);

  const availableItems = panelItems.filter((p) => p.available_in_session > 0);

  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderColor: '#e0e0e0' }}>
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
        <HomologCardImage src={thumbSrc} alt={unit.name} variant="list" />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={0.75} flexWrap="wrap">
            <Typography variant="body2" fontWeight={600} noWrap sx={{ flex: 1, minWidth: 0 }}>
              {unit.name}
            </Typography>
            <Chip size="small" label="pendiente" color="default" />
          </Stack>
          <Typography variant="caption" color="text.secondary" display="block" noWrap>
            {unit.order_code}
            {unit.expansion ? ` · ${unit.expansion}` : ''}
            {unit.rareza ? ` · ${unit.rareza}` : ''}
            {unit.blueprint_id ? ` · BP#${unit.blueprint_id}` : ''}
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.5} flexShrink={0}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => setExpanded((v) => !v)}
            disabled={disabled}
          >
            {expanded ? 'Cerrar' : 'Buscar'}
          </Button>
          <Button
            size="small"
            color="warning"
            variant="outlined"
            onClick={() => onNovedad(unit.sent_unit_key)}
            disabled={disabled}
          >
            Novedad
          </Button>
        </Stack>
      </Box>

      <Collapse in={expanded} unmountOnExit>
        <Box mt={1.5}>
          {availableItems.length === 0 ? (
            <Alert severity="warning" sx={{ py: 0.5 }}>
              Sin líneas de tránsito disponibles. Usa "Sync CT + Auto-match" o marca como novedad.
            </Alert>
          ) : (
            <Stack spacing={0.75}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                Líneas de tránsito disponibles ({availableItems.length})
              </Typography>
              {availableItems.map((item) => {
                const img = resolvePanelImageSrc(item.image_url);
                return (
                  <Paper
                    key={item.transit_line_id}
                    variant="outlined"
                    sx={{
                      p: 1,
                      display: 'flex',
                      gap: 1,
                      alignItems: 'center',
                      cursor: disabled ? 'default' : 'pointer',
                      '&:hover': disabled ? {} : { bgcolor: 'action.hover' },
                    }}
                    onClick={() => !disabled && onVerify(unit.sent_unit_key, item.transit_line_id)}
                  >
                    <HomologCardImage src={img} alt={item.card_name} variant="list" />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600} noWrap>
                        {item.card_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {item.language}
                        {item.rareza ? ` · ${item.rareza}` : ''}
                        {' · '}Disp. {item.available_in_session}/{item.remaining_quantity}
                      </Typography>
                    </Box>
                    <Button
                      size="small"
                      variant="contained"
                      disabled={disabled}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!disabled) onVerify(unit.sent_unit_key, item.transit_line_id);
                      }}
                    >
                      Asignar
                    </Button>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
}
