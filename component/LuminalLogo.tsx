import Image from 'next/image';

export function LuminalLogo({ size = 40, decorative = false }: { size?: number; decorative?: boolean }) {
  return (
    <Image
      src="/brand/luminal-factory-logo-gold-20261007.png"
      alt={decorative ? '' : 'Luminal Factory'}
      width={size}
      height={size}
      sizes={`${size}px`}
      className="shrink-0 object-contain"
    />
  );
}
