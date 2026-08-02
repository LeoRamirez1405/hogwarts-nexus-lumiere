// Proxy de autenticacion (antes "middleware"; renombrado en Next.js 16).
//
// Guardado de rutas server-side: verifica el access token (cookie httpOnly)
// antes de renderizar cualquier pagina protegida, redirigiendo a /login si no
// hay sesion valida. Es una comprobacion optimista; la autorizacion real la
// sigue imponiendo el backend en cada request.
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// JWT_SECRET debe estar en frontend/.env.local (mismo valor que backend/.env).
const secret = new TextEncoder().encode(process.env.JWT_SECRET || "");

const PUBLIC_PATHS = new Set(["/", "/login"]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  // Si JWT_SECRET no esta configurado en el frontend, no podemos verificar la
  // cookie. En ese caso se deja pasar (el layout + el backend siguen
  // protegiendo) para no romper la app con un loop de redirects.
  if (secret.length > 0) {
    const accessToken = request.cookies.get("access_token")?.value;
    if (accessToken) {
      try {
        await jwtVerify(accessToken, secret);
        return NextResponse.next();
      } catch {
        // token invalido o expirado -> redirigir
      }
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
      * Correr en todas las rutas salvo API, assets estaticos, imagen,
      * favicon, y archivos publicos del PWA (sw.js, manifest, iconos,
      * fallbacks). Sin esta exclusion el proxy redirige /sw.js -> /login
      * y el navegador rechaza el SW con SecurityError ("script resource
     *  is behind a redirect").
      */
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|sw\.js|manifest\.json|manifest\.webmanifest|icons/.*|fallbacks/.*).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
