{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "cleanUrls": false,
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://${API_HOST}/api/:path*" },
    { "source": "/embed", "destination": "https://${API_HOST}/embed" },
    { "source": "/embed/:path*", "destination": "https://${API_HOST}/embed/:path*" },
    { "source": "/assets/:path*", "destination": "https://${API_HOST}/assets/:path*" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    },
    {
      "source": "/((?!embed).*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self' wss://${API_HOST}; worker-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'"
        },
        { "key": "X-Frame-Options", "value": "DENY" }
      ]
    },
    {
      "source": "/embed.js",
      "headers": [
        { "key": "Cache-Control", "value": "no-cache" },
        { "key": "Cross-Origin-Resource-Policy", "value": "cross-origin" }
      ]
    }
  ]
}
