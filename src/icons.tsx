import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  return {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

export function IconMenu(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16.2 16.2 20 20" />
    </svg>
  );
}

export function IconSelect(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4.5" y="4.5" width="15" height="15" rx="2" />
      <path d="m8 12.2 2.6 2.6L16.4 9" />
    </svg>
  );
}

export function IconRefresh(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M20 12a8 8 0 1 1-2.3-5.7" />
      <path d="M20 5v5h-5" />
    </svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <svg {...base(props)} strokeWidth={2.2}>
      <path d="M12 6v12M6 12h12" />
    </svg>
  );
}

export function IconEye(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M2.8 12s3.2-6.2 9.2-6.2S21.2 12 21.2 12 18 18.2 12 18.2 2.8 12 2.8 12Z" />
      <circle cx="12" cy="12" r="2.4" />
    </svg>
  );
}

export function IconThermal(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M10 14.6V6.8a2 2 0 1 1 4 0v7.8a3.2 3.2 0 1 1-4 0Z" />
      <path d="M12 9.2v4.2" />
      <path d="M17.4 5.2v2.2M19.6 7.4h-2.2" />
    </svg>
  );
}

export function IconWave(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 14c2.2-6 3.4-6 5.2 0 1.8 6 3 6 4.8 0 1.8-6 3-6 4.8 0 .9 3 1.6 3 3.2 0" />
    </svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function IconBack(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M15 5 8 12l7 7" />
    </svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

export function IconTrash(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 7h14M10 7V5h4v2M8 7l.8 12h6.4L16 7" />
    </svg>
  );
}

export function IconGps(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21" />
      <circle cx="12" cy="12" r="7" />
    </svg>
  );
}

export function IconBook(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v16H7.5A2.5 2.5 0 0 0 5 21.5Z" />
      <path d="M5 5.5v16" />
    </svg>
  );
}

export function IconEdit(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 16.8V20h3.2L18.4 8.8l-3.2-3.2L4 16.8Z" />
      <path d="m13.7 4.3 3.2 3.2" />
    </svg>
  );
}

export function IconMap(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4.5 6.2 9.2 4.5 14.8 6.2 19.5 4.5v13.3l-4.7 1.7-5.6-1.7-4.7 1.7Z" />
      <path d="M9.2 4.5v13.3M14.8 6.2v13.3" />
    </svg>
  );
}
