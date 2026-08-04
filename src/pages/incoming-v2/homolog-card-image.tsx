import { Box, Skeleton, Typography } from '@mui/material';
import {
  CARD_THUMB_SIZES,
  CardThumb,
  type CardThumbSize,
} from '../../components/card-thumb';

type HomologCardImageProps = {
  src?: string;
  alt: string;
  width?: number;
  height?: number;
  loading?: boolean;
  variant?: 'list' | 'detail' | 'candidate';
};

/** Map legacy homolog variants → shared CardThumb sizes (larger / readable). */
const VARIANT_TO_SIZE: Record<
  NonNullable<HomologCardImageProps['variant']>,
  CardThumbSize
> = {
  list: 'md',
  candidate: 'lg',
  detail: 'xl',
};

/**
 * @deprecated Prefer `CardThumb` from `components/card-thumb`.
 * Kept for existing incoming/receipt imports; sizes now match CardThumb.
 */
export function HomologCardImage(props: HomologCardImageProps) {
  const {
    src,
    alt,
    loading = false,
    variant = 'list',
    width: widthProp,
    height: heightProp,
  } = props;

  const size = VARIANT_TO_SIZE[variant];
  const preset = CARD_THUMB_SIZES[size];
  const w = widthProp ?? preset.width;
  const h = heightProp ?? preset.height;

  if (loading) {
    return (
      <Box
        sx={{
          width: w,
          minWidth: w,
          height: h,
          borderRadius: 1,
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <Skeleton variant="rounded" width={w} height={h} />
      </Box>
    );
  }

  if (!src && variant === 'detail') {
    return (
      <Box
        sx={{
          width: w,
          minWidth: w,
          height: h,
          borderRadius: 1,
          bgcolor: 'grey.100',
          border: '1px solid',
          borderColor: 'grey.200',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ px: 0.5, textAlign: 'center' }}>
          Sin imagen
        </Typography>
      </Box>
    );
  }

  return (
    <CardThumb
      src={src}
      alt={alt}
      size={size}
      width={widthProp}
      height={heightProp}
      enlargeOnHover={variant === 'list' || variant === 'candidate'}
    />
  );
}
