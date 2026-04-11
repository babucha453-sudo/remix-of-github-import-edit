import React, { useEffect, useMemo } from "react";
import NextLink from "next/link";
import { useRouter } from "next/router";

/**
 * Minimal `react-router-dom` compatibility layer for Next.js (Pages Router).
 *
 * This project was originally built on React Router. During migration we keep
 * most imports intact by aliasing `react-router-dom` to this file in `next.config.mjs`.
 *
 * Supported exports (only what this codebase uses):
 * - Link (accepts both `to` and `href` props)
 * - NavLink
 * - Navigate
 * - useNavigate
 * - useLocation
 * - useParams
 * - useSearchParams
 *
 * NOT supported:
 * - BrowserRouter / Routes / Route (Next handles routing)
 */

type To = string;

function toHref(to: To): string {
  if (!to) return "/";
  // Ensure leading slash for internal routes.
  if (to.startsWith("http://") || to.startsWith("https://")) return to;
  return to.startsWith("/") ? to : `/${to}`;
}

// Accept both `to` (react-router-dom) and `href` (Next.js) props
type LinkProps = Omit<
  React.ComponentProps<typeof NextLink>,
  "href"
> & {
  to?: To;
  href?: To;
  replace?: boolean;
};

export function Link({ to, href, replace, ...rest }: LinkProps) {
  const url = toHref(to || href || "/");
  const router = useRouter();
  
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Check if this is an internal navigation
    if (typeof window !== 'undefined' && url.startsWith('/')) {
      const currentPath = router.asPath.split('?')[0];
      const targetPath = url.split('?')[0];
      
      // If navigating to a different internal path, do full reload
      if (currentPath !== targetPath) {
        window.location.href = url;
        e.preventDefault();
        return;
      }
    }
  };
  
  // For external links or same-page navigation, use default behavior
  return <NextLink href={url} replace={replace} scroll {...(rest as any)} onClick={handleClick} />;
}

export type NavLinkProps = Omit<LinkProps, "className"> & {
  className?:
    | string
    | ((args: { isActive: boolean; isPending: boolean }) => string | undefined);
};

export function NavLink({ to, href, className, ...rest }: NavLinkProps) {
  const router = useRouter();
  const url = toHref(to || href || "/");
  const pathname = router.asPath.split("?")[0] || "/";
  const isActive = pathname === url.replace(/\/+$/, "") || pathname === url;

  const computedClassName =
    typeof className === "function"
      ? (className as (args: { isActive: boolean; isPending: boolean }) => string | undefined)({ isActive, isPending: false })
      : className;

  return <Link to={url} className={computedClassName} {...rest} />;
}

export function useNavigate() {
  const router = useRouter();
  return useMemo(() => {
    return (to: To, opts?: { replace?: boolean }) => {
      const url = toHref(to);
      if (opts?.replace) {
        void router.replace(url);
      } else {
        void router.push(url);
      }
    };
  }, [router]);
}

export function useLocation() {
  const router = useRouter();
  const asPath = router.asPath || "/";
  const [pathname, search = ""] = asPath.split("?");
  return useMemo(
    () => ({
      pathname: pathname || "/",
      search: search ? `?${search}` : "",
      hash: "",
      state: null as any,
      key: asPath,
    }),
    [asPath, pathname, search]
  );
}

export function useParams<TParams extends Record<string, string | undefined> = any>(): TParams {
  const router = useRouter();
  // Next query values can be string|string[]
  const params: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(router.query || {})) {
    if (typeof v === "string") params[k] = v;
    else if (Array.isArray(v)) params[k] = v[0];
    else params[k] = undefined;
  }
  return params as TParams;
}

export function useSearchParams(): [
  URLSearchParams,
  (nextInit: Record<string, string | undefined> | URLSearchParams, options?: { replace?: boolean }) => void,
] {
  const router = useRouter();
  const search = (router.asPath || "").split("?")[1] || "";
  const sp = useMemo(() => new URLSearchParams(search), [search]);
  const navigate = useNavigate();

  const setSearchParams = useMemo(() => {
    return (
      nextInit: Record<string, string | undefined> | URLSearchParams,
      options?: { replace?: boolean }
    ) => {
      const next =
        nextInit instanceof URLSearchParams
          ? nextInit
          : new URLSearchParams(
              Object.entries(nextInit).flatMap(([k, v]) =>
                v == null ? [] : [[k, v]]
              )
            );
      const pathname = (router.asPath || "/").split("?")[0] || "/";
      const nextUrl = `${pathname}${next.toString() ? `?${next.toString()}` : ""}`;
      navigate(nextUrl, { replace: options?.replace });
    };
  }, [navigate, router.asPath]);

  return [sp, setSearchParams];
}

export function Navigate({
  to,
  replace,
}: {
  to: To;
  replace?: boolean;
}) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to, { replace });
  }, [navigate, replace, to]);
  return null;
}

// Re-export a few names/types that exist in react-router-dom and are imported in code.
export type NavigateFunction = ReturnType<typeof useNavigate>;

export function BrowserRouter({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function Routes({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function Route({ element }: { path?: string; element: React.ReactNode; index?: boolean }) {
  return <>{element}</>;
}

