import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-[3px] text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground",
        outline: "border-border text-foreground",
        primary:
          "border-transparent bg-[var(--accent-subtle)] text-[var(--accent-fg)]",
        teal: "border-transparent bg-[var(--teal-subtle)] text-[var(--teal-fg)]",
        success:
          "border-transparent bg-[var(--success-subtle)] text-[var(--success-fg)]",
        error:
          "border-transparent bg-[var(--error-subtle)] text-[var(--error-fg)]",
        warning:
          "border-transparent bg-[var(--amber-subtle)] text-[var(--amber-fg)]",
        info: "border-transparent bg-[var(--info-subtle)] text-[var(--info-fg)]",
        solid: "border-transparent bg-primary text-primary-foreground",
        "solid-teal": "border-transparent bg-teal text-teal-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };

