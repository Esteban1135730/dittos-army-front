import { Box, Skeleton, Typography } from '@mui/material';

type HomologCardImageProps = {
  src?: string;
  alt: string;
  width?: number;
  height?: number;
  loading?: boolean;
  variant?: 'list' | 'detail' | 'candidate';
};

const VARIANT_SIZES = {
  list: { width: 44, height: 62 },
  detail: { width: 180, height: 252 },
  candidate: { width: 56, height: 78 },
} as const;

export function HomologCardImage(props: HomologCardImageProps) {
  const {
    src,
    alt,
    loading = false,
    variant = 'list',
    width: widthProp,
    height: heightProp,
  } = props;

  const { width, height } = VARIANT_SIZES[variant];
  const w = widthProp ?? width;
  const h = heightProp ?? height;

  return (
    <Box
      sx={{
        width: w,
        minWidth: w,
        height: h,
        borderRadius: 1,
        overflow: 'hidden',
        bgcolor: 'grey.100',
        border: '1px solid',
        borderColor: 'grey.200',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {loading ? (
        <Skeleton variant="rounded" width={w} height={h} />
      ) : src ? (
        <Box
          component="img"
          src={src}
          alt={alt}
          loading="lazy"
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block',
            bgcolor: '#fff',
          }}
        />
      ) : (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ px: 0.5, textAlign: 'center', fontSize: variant === 'list' ? 9 : 11 }}
        >
          Sin imagen
        </Typography>
      )}
    </Box>
  );
}
