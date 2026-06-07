import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-white/15 bg-white/5 text-white/70",
        solid: "border-transparent bg-primary text-primary-foreground",
        emerald: "border-emerald-400/30 bg-emerald-400/12 text-emerald-300",
        amber: "border-amber-400/30 bg-amber-400/12 text-amber-300",
        sky: "border-sky-400/30 bg-sky-400/12 text-sky-300",
        red: "border-red-400/30 bg-red-400/12 text-red-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
