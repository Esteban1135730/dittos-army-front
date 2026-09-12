import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Glyph(props: IconProps) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    />
  );
}

export function IconPencil(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4 20h4L19 9l-4-4L4 16v4z" />
      <path d="m13 7 4 4" />
    </Glyph>
  );
}

export function IconTrash(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M5 7h14M10 7V5h4v2M8 7v12h8V7" />
    </Glyph>
  );
}
