import React from "react";

export interface RupiahSignProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
  strokeWidth?: number | string;
}

/**
 * RupiahSign (Rp) Icon
 * Custom vector icon crafted to seamlessly match Lucide React's 24x24 icon grid.
 * Replaces generic dollar signs ($) with the official Indonesian Rupiah symbol (Rp).
 */
export const RupiahSign: React.FC<RupiahSignProps> = ({
  size,
  className = "w-4 h-4",
  strokeWidth = 2,
  ...props
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={typeof size === "number" ? size : undefined}
      height={typeof size === "number" ? size : undefined}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Letter R */}
      <path d="M4.5 5.5v13.5" />
      <path d="M4.5 5.5h4.5a3.5 3.5 0 0 1 0 7h-4.5" />
      <path d="M8 12.5l4.5 6.5" />
      {/* Letter p */}
      <path d="M15 9.5v9.5" />
      <path d="M15 11a3 3 0 1 1 0 6" />
    </svg>
  );
};

export default RupiahSign;
