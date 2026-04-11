import { NavLink as RouterNavLink, NavLinkProps } from "react-router-dom";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { withTrailingSlash } from "@/lib/url/withTrailingSlash";

interface NavLinkCompatProps extends Omit<NavLinkProps, "className" | "to"> {
  to: string | { pathname?: string; search?: string; hash?: string };
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, pendingClassName, to, ...props }, ref) => {
    const normalizedTo =
      typeof to === "string"
        ? withTrailingSlash(to)
        : to && typeof to === "object" && "pathname" in to
          ? `${withTrailingSlash((to as { pathname?: string }).pathname || "")}${(to as { search?: string }).search || ""}${(to as { hash?: string }).hash || ""}`
          : "";

    return (
      <RouterNavLink
        ref={ref}
        to={normalizedTo}
        className={({ isActive, isPending }) =>
          cn(className, isActive && activeClassName, isPending && pendingClassName)
        }
        {...props}
      />
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
