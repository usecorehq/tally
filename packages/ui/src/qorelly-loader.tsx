// Qorelly-branded loader: the mark rotated with SVG SMIL (no JS, no CSS dependency).
// currentColor, so text-* sets it; defaults to text-primary.
import { cn } from "./lib/cn";

interface QorellyLoaderProps {
  className?: string
  size?: number | string
  /** Seconds per full rotation. Default 1.1s. */
  speed?: number
}

export function QorellyLoader({
  className,
  size,
  speed = 1.1,
}: QorellyLoaderProps) {
  const dimensionProps =
    size !== undefined ? { width: size, height: size } : {}

  return (
    <svg
      {...dimensionProps}
      viewBox="0 0 34 34"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('text-primary inline-block shrink-0', className)}
      role="status"
      aria-label="Loading"
    >
      <g>
        <path
          d="M32.9 16.59L31.21 14.24C31 13.95 30.59 13.76 30.15 13.76H24.9L28.61 10.05C28.92 9.74 29.08 9.32 29.02 8.96L28.55 6.11C28.5 5.78 28.26 5.54 27.93 5.49L25.08 5.02C24.72 4.96 24.31 5.12 23.99 5.43L20.28 9.14V3.9C20.28 3.46 20.1 3.05 19.8 2.84L17.45 1.15C17.17 0.95 16.84 0.95 16.57 1.15L14.22 2.84C13.93 3.05 13.74 3.46 13.74 3.9V9.15L10.03 5.44C9.72 5.13 9.3 4.97 8.94 5.03L6.09 5.5C5.76 5.55 5.52 5.79 5.47 6.12L5 8.97C4.94 9.33 5.1 9.74 5.41 10.06L9.12 13.77H3.89C3.45 13.77 3.04 13.95 2.83 14.25L1.15 16.59C0.95 16.87 0.95 17.2 1.15 17.47L2.84 19.82C3.05 20.11 3.46 20.3 3.9 20.3H9.15L5.44 24.01C5.13 24.32 4.97 24.74 5.03 25.1L5.5 27.95C5.55 28.28 5.79 28.52 6.12 28.57L8.97 29.04C9.33 29.1 9.74 28.94 10.06 28.63L13.77 24.92V30.17C13.77 30.61 13.95 31.02 14.25 31.23L16.6 32.92C16.88 33.12 17.21 33.12 17.48 32.92L19.83 31.23C20.12 31.02 20.31 30.61 20.31 30.17V24.92L24.02 28.63C24.33 28.94 24.75 29.1 25.11 29.04L27.96 28.57C28.29 28.52 28.53 28.28 28.58 27.95L29.05 25.1C29.11 24.74 28.95 24.33 28.64 24.01L24.93 20.3H30.18C30.62 20.3 31.03 20.12 31.24 19.82L32.93 17.47C33.13 17.19 33.13 16.86 32.93 16.59H32.9ZM17.02 20.3C15.22 20.3 13.75 18.84 13.75 17.03C13.75 15.22 15.21 13.76 17.02 13.76C18.83 13.76 20.29 15.22 20.29 17.03C20.29 18.84 18.83 20.3 17.02 20.3Z"
          fill="currentColor"
        />
        <animateTransform
          attributeName="transform"
          attributeType="XML"
          type="rotate"
          from="0 17 17"
          to="360 17 17"
          dur={`${speed}s`}
          repeatCount="indefinite"
        />
      </g>
    </svg>
  )
}
