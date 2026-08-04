import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { title?: string };

function Icon({
  title,
  children,
  ...props
}: IconProps & { children: ReactNode }) {
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
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export function IconHome(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 10v10h14V10" />
    </Icon>
  );
}

export function IconInventory(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16v12H4z" />
      <path d="M4 7l2-3h12l2 3" />
      <path d="M10 11h4" />
    </Icon>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function IconGrid(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="7" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" />
      <rect x="13" y="13" width="7" height="7" rx="1" />
    </Icon>
  );
}

export function IconPackage(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3 20 7.5v9L12 21l-8-4.5v-9L12 3z" />
      <path d="M12 12 20 7.5M12 12v9M12 12 4 7.5" />
    </Icon>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="6" />
      <path d="m16 16 4 4" />
    </Icon>
  );
}

export function IconAlert(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4 3 19h18L12 4z" />
      <path d="M12 10v4M12 16h.01" />
    </Icon>
  );
}

export function IconQr(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z" />
      <path d="M14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z" />
    </Icon>
  );
}

export function IconTruck(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 7h11v10H3z" />
      <path d="M14 10h4l3 3v4h-7v-7z" />
      <circle cx="7" cy="18" r="1.5" />
      <circle cx="17" cy="18" r="1.5" />
    </Icon>
  );
}

export function IconDownload(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4v10M8 10l4 4 4-4" />
      <path d="M5 18h14" />
    </Icon>
  );
}

export function IconInbox(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 8h16v11H4z" />
      <path d="M4 12h4l2 2h4l2-2h4" />
    </Icon>
  );
}

export function IconLayers(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m12 4 8 4-8 4-8-4 8-4z" />
      <path d="m4 12 8 4 8-4" />
      <path d="m4 16 8 4 8-4" />
    </Icon>
  );
}

export function IconCart(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="19" r="1.5" />
      <circle cx="17" cy="19" r="1.5" />
      <path d="M3 4h2l2.2 11h10.3l2-8H7" />
    </Icon>
  );
}

export function IconTag(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 12V4h8l9 9-8 8-9-9z" />
      <circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function IconCash(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M7 12h.01M17 12h.01" />
    </Icon>
  );
}

export function IconScan(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 8V5h3M16 5h3v3M20 16v3h-3M8 19H5v-3" />
      <path d="M8 12h8" />
    </Icon>
  );
}

export function IconHistory(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 12a8 8 0 1 0 2.3-5.7" />
      <path d="M4 5v4h4M12 8v5l3 2" />
    </Icon>
  );
}

export function IconBalance(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4v16M5 8h14" />
      <path d="m5 8 3 8h0a3 3 0 0 1-6 0l3-8zM19 8l3 8h0a3 3 0 0 1-6 0l3-8z" />
    </Icon>
  );
}

export function IconBookmark(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 4h10v16l-5-3-5 3V4z" />
    </Icon>
  );
}

export function IconUsers(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19a6 6 0 0 1 12 0" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M16 19a4.5 4.5 0 0 0 5-4" />
    </Icon>
  );
}

export function IconPrint(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 9V4h10v5" />
      <path d="M6 14h12v6H6z" />
      <path d="M4 9h16v7h-3" />
    </Icon>
  );
}

export function IconRates(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 18V6M4 18h16" />
      <path d="m7 14 3-4 3 2 4-6" />
    </Icon>
  );
}

export function IconChevron(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m8 10 4 4 4-4" />
    </Icon>
  );
}
