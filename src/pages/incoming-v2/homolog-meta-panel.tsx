import { Box, Typography } from '@mui/material';

export type MetaLine = {
  label: string;
  value: string;
  highlight?: boolean;
};

export function HomologMetaGrid(props: { lines: MetaLine[]; columns?: 1 | 2 }) {
  const { lines, columns = 2 } = props;
  return (
    <Box
      display="grid"
      gridTemplateColumns={columns === 1 ? '1fr' : { xs: '1fr', sm: '1fr 1fr' }}
      gap={0.75}
      sx={{ mt: 1 }}
    >
      {lines.map((line) => (
        <Box key={line.label}>
          <Typography variant="caption" color="text.secondary" display="block">
            {line.label}
          </Typography>
          <Typography
            variant="body2"
            fontWeight={line.highlight ? 700 : 400}
            color={line.highlight ? 'success.dark' : 'text.primary'}
            sx={line.highlight ? { fontSize: '1.05rem' } : undefined}
          >
            {line.value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

export function HomologMetaSection(props: {
  title: string;
  lines: MetaLine[];
  columns?: 1 | 2;
}) {
  const { title, lines, columns } = props;
  if (lines.length === 0) return null;
  return (
    <Box
      sx={{
        mt: 1.5,
        p: 1.25,
        borderRadius: 1,
        bgcolor: 'grey.50',
        border: '1px solid',
        borderColor: 'grey.200',
      }}
    >
      <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" mb={0.5}>
        {title}
      </Typography>
      <HomologMetaGrid lines={lines} columns={columns} />
    </Box>
  );
}
