// proxy.js
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose'; // Next.js Edge Runtime kompatibel

/**
 * Middleware to protect routes based on auth token in cookies
 * fired on full page reloads and direct accesses
**/
export async function proxy(request) {
  const token = request.cookies.get('authToken')?.value;
  const allowedRoutes = ['/api/auth/login', '/api/auth/register', '/api/generate/session'];
  const isApiRoute = request.nextUrl.pathname.startsWith('/api');

  console.log('Middleware check for path:', request.nextUrl.pathname);
  console.log('REST Auth token:', token ? 'Present' : 'Absent');

  //if (protectedRoutes.some(route => request.nextUrl.pathname.startsWith(route))) {
  if (!token) {
    // API Routes → JSON Response
    if (isApiRoute && !allowedRoutes.includes(request.nextUrl.pathname)) {
      return NextResponse.json(
        { error: 'Unauthorized - No token provided' },
        { status: 401 }
      );
    } else if (isApiRoute && allowedRoutes.includes(request.nextUrl.pathname)) {
      return NextResponse.next(); // Allow routes without token
    }

    // UI Routes → Redirect
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Token verifizieren
  try {
    const secret = new TextEncoder().encode(process.env.JWT_KEY);
    const { payload } = await jwtVerify(token, secret);

    console.log('Token valid for user:', payload._id);

    // User-ID im Request-Header weitergeben für API Routes
    const response = NextResponse.next();
    response.headers.set('x-user-id', payload._id);
    return response;

  } catch (error) {
    console.log('Token verification failed:', error.message);

    // API Routes → JSON Response + Cookie löschen
    if (isApiRoute) {
      const response = NextResponse.json(
        { error: 'Unauthorized - Invalid or expired token' },
        { status: 401 }
      );
      response.cookies.delete('authToken');
      return response;
    }

    // UI Routes → Redirect + Cookie löschen
    const response = NextResponse.redirect(new URL('/', request.url));
    response.cookies.delete('authToken');
    return response;
  }
  //}

  //return NextResponse.next();
}

export const config = {
  matcher: ['/auth/account', '/dashboard', '/api/:path*'],
};