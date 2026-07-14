import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Session granted only after a Zoho CRM entry (2 minutes). */
const ACCESS_COOKIE = "zoho_crm_session";
/** Clear any older access cookie from the previous approach. */
const LEGACY_ACCESS_COOKIE = "zoho_crm_access";

const ACCESS_TTL_SECONDS = 2 * 60; // 2 minutes

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

function hasValidAccessCookie(request: NextRequest): boolean {
  return request.cookies.get(ACCESS_COOKIE)?.value === "1";
}

function withSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("Content-Security-Policy", FRAME_ANCESTORS);
  response.cookies.set({
    name: LEGACY_ACCESS_COOKIE,
    value: "",
    path: "/",
    maxAge: 0,
  });
  return response;
}

function setAccessCookie(response: NextResponse): void {
  response.cookies.set({
    name: ACCESS_COOKIE,
    value: "1",
    path: "/",
    maxAge: ACCESS_TTL_SECONDS,
    httpOnly: true,
    // App is framed inside Zoho CRM — cookie must work in a cross-site iframe.
    secure: true,
    sameSite: "none",
  });
}

function clearAccessCookie(response: NextResponse): void {
  response.cookies.set({
    name: ACCESS_COOKIE,
    value: "",
    path: "/",
    maxAge: 0,
    httpOnly: true,
    secure: true,
    sameSite: "none",
  });
}

function allow(setCookie = false): NextResponse {
  const response = withSecurityHeaders(NextResponse.next());
  if (setCookie) {
    setAccessCookie(response);
  }
  return response;
}

type DenyReason = "outside" | "expired";

function denyAccess(reason: DenyReason): NextResponse {
  const copy =
    reason === "expired"
      ? {
          title: "Session expired",
          heading: "Open this tab from CRM again",
          body: "Your access window has ended. Reopen this view from Zoho CRM to continue.",
        }
      : {
          title: "Access restricted",
          heading: "You cannot access this page",
          body: "Open this view from Zoho CRM to access it. Direct links and other sites are not allowed.",
        };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${copy.title}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f6f7f9; color: #1a1a1a; }
    main { max-width: 28rem; padding: 1.5rem; text-align: center; }
    h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
    p { margin: 0; line-height: 1.5; color: #444; }
  </style>
</head>
<body>
  <main>
    <h1>${copy.heading}</h1>
    <p>${copy.body}</p>
  </main>
</body>
</html>`;

  const response = new NextResponse(html, {
    status: 403,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
  clearAccessCookie(response);
  return withSecurityHeaders(response);
}

export function middleware(request: NextRequest) {
  const hostname = request.nextUrl.hostname.toLowerCase();

  // Local development stays unrestricted.
  if (isLocalDevHost(hostname)) {
    return NextResponse.next();
  }

  const refererHost = hostnameFromHeader(request.headers.get("referer"));
  const originHost = hostnameFromHeader(request.headers.get("origin"));
  const fromZoho =
    isZohoHostname(refererHost) || isZohoHostname(originHost);

  // Fresh entry from Zoho CRM → grant a 2-minute session cookie.
  if (fromZoho) {
    return allow(true);
  }

  // Within the 2-minute window → continue using the app (navigations, API, etc.).
  if (hasValidAccessCookie(request)) {
    return allow(false);
  }

  // Cookie missing/expired: same-app traffic → ask to reopen from CRM.
  const site = request.headers.get("sec-fetch-site");
  if (
    site === "same-origin" ||
    isSameAppHost(hostname, refererHost) ||
    isSameAppHost(hostname, originHost)
  ) {
    return denyAccess("expired");
  }

  // Outside Zoho / direct URL / other sites.
  return denyAccess("outside");
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
