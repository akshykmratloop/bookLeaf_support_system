{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "cleanUrls": false,
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://${HOST_API_HOST}/api/:path*" },
    { "source": "/login", "destination": "https://${HOST_API_HOST}/login" },
    { "source": "/logout", "destination": "https://${HOST_API_HOST}/logout" },
    { "source": "/me", "destination": "https://${HOST_API_HOST}/me" },
    { "source": "/support-token", "destination": "https://${HOST_API_HOST}/support-token" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "X-Frame-Options", "value": "DENY" },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' ${SUPPORT_ORIGIN}; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self' https://${HOST_API_HOST}; frame-src ${SUPPORT_ORIGIN}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'"
        }
      ]
    }
  ]
}
