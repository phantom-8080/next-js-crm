import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Clear any older access cookie from the previous approach. */
const LEGACY_ACCESS_COOKIE = "zoho_crm_access";

const FRAME_ANCESTORS =
  "frame-ancestors https://*.zoho.com https://zoho.com https://crm.zoho.com;";

function hostnameFromHeader(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Only zoho.com and its subdomains (includes crm.zoho.com). */
function isZohoHostname(hostname: string | null): boolean {
  if (!hostname) return false;
  return hostname === "zoho.com" || hostname.endsWith(".zoho.com");
}

function isLocalDevHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost")
  );
}

function isSameAppHost(requestHost: string, sourceHost: string | null): boolean {
  if (!sourceHost) return false;
  return sourceHost === requestHost.toLowerCase();
}

/**
 * Browser address-bar / bookmark open — not coming from another site.
 * These must never be allowed unless Referer/Origin is Zoho (it won't be).
 */
function isDirectBrowserEntry(request: NextRequest): boolean {
  const site = request.headers.get("sec-fetch-site");
  // Modern browsers send "none" when the user types/pastes the URL.
  if (site === "none") return true;
  // No Zoho/same-app source and no sec-fetch-site (or empty referer) on a document load.
  const dest = request.headers.get("sec-fetch-dest");
  const referer = request.headers.get("referer");
  const origin = request.headers.get("origin");
  if ((dest === "document" || dest === "iframe") && !referer && !origin) {
    return true;
  }
  return false;
}

function withSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("Content-Security-Policy", FRAME_ANCESTORS);
  // Clear legacy cookie from the earlier approach (no stored access).
  response.cookies.set({
    name: LEGACY_ACCESS_COOKIE,
    value: "",
    path: "/",
    maxAge: 0,
  });
  return response;
}

function allow(): NextResponse {
  return withSecurityHeaders(NextResponse.next());
}

function denyAccess(): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Access restricted</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f6f7f9; color: #1a1a1a; }
    main { max-width: 28rem; padding: 1.5rem; text-align: center; }
    h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
    p { margin: 0; line-height: 1.5; color: #444; }
  </style>
</head>
<body>
  <main>
    <h1>You are not authorized to access this app</h1>
    <p>Please contact your administrator to get access to this app.</p>
  </main>
</body>
</html>`;

  const response = new NextResponse(html, {
    status: 403,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
  return withSecurityHeaders(response);
}

export function middleware(request: NextRequest) {
  const hostname = request.nextUrl.hostname.toLowerCase();

  // Local development stays unrestricted.
  if (isLocalDevHost(hostname)) {
    return NextResponse.next();
  }

  // Every request: inspect current Referer / Origin (nothing stored in cookie/localStorage).
  const refererHost = hostnameFromHeader(request.headers.get("referer"));
  const originHost = hostnameFromHeader(request.headers.get("origin"));

  // Allowed entry: request is coming from zoho.com / crm.zoho.com (or other *.zoho.com).
  if (isZohoHostname(refererHost) || isZohoHostname(originHost)) {
    return allow();
  }

  // Typing/pasting the AppSail URL in the browser → always blocked.
  if (isDirectBrowserEntry(request)) {
    return denyAccess();
  }

  /*
   * Same-app follow-up only (checked on this request’s headers each time):
   * After CRM opens the app, Next.js navigations and /api calls send Referer
   * as this AppSail host — not Zoho. Still not "remembered" access.
   */
  const site = request.headers.get("sec-fetch-site");
  if (
    site === "same-origin" ||
    isSameAppHost(hostname, refererHost) ||
    isSameAppHost(hostname, originHost)
  ) {
    return allow();
  }

  return denyAccess();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
