export default function DesktopSideDecoration({
  icon,
  primaryColor,
  accentColor,
  mirrored,
}: {
  icon: string;
  primaryColor: string;
  accentColor: string;
  mirrored?: boolean;
}) {
  return (
    <div className="hidden lg:block" aria-hidden="true">
      <div
        className={`sticky top-16 flex h-[75vh] items-center justify-center overflow-hidden ${
          mirrored ? "scale-x-[-1]" : ""
        }`}
      >
        <div
          className="absolute -left-12 top-8 h-64 w-64 rounded-full blur-3xl"
          style={{ backgroundColor: primaryColor, opacity: 0.14 }}
        />
        <div
          className="absolute -right-8 bottom-10 h-48 w-48 rounded-full blur-3xl"
          style={{ backgroundColor: accentColor, opacity: 0.16 }}
        />
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none text-[240px] leading-none"
          style={{ opacity: 0.05 }}
        >
          {icon}
        </div>
        <div className="relative flex flex-col items-center gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: primaryColor, opacity: 0.15 + i * 0.04 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
