export function isImageLogo(value: string): boolean {
  return value.startsWith("data:image");
}

/** Affiche le logo du site : une image importée (data URL) ou un simple emoji/texte. */
export default function LogoIcon({
  value,
  className,
  style,
}: {
  value: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  if (isImageLogo(value)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={value} alt="" className={`object-contain ${className ?? ""}`} style={style} />;
  }
  return (
    <span className={className} style={style}>
      {value}
    </span>
  );
}
