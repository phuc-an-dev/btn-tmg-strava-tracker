import type {NextConfig} from "next";
import {createHash,randomUUID} from "node:crypto";

const buildVersion=process.env.VERCEL_DEPLOYMENT_ID||process.env.VERCEL_URL||(process.env.REVIVE_BUILD_VERSION??=process.env.NODE_ENV==='development'?'development':randomUUID());

const config:NextConfig={
 env:{NEXT_PUBLIC_APP_VERSION:createHash('sha256').update(buildVersion).digest('hex').slice(0,12)},
 images:{remotePatterns:[{protocol:"https",hostname:"dgtzuqphqg23d.cloudfront.net",port:"",pathname:"/**"}],maximumRedirects:0},
 async headers(){return [{source:"/revive/og/:path*",headers:[{key:"Cache-Control",value:"public, max-age=31536000, immutable"}]},{source:"/sw.js",headers:[{key:"Content-Type",value:"application/javascript; charset=utf-8"},{key:"Cache-Control",value:"no-cache, no-store, must-revalidate"},{key:"Content-Security-Policy",value:"default-src 'self'; script-src 'self'"},{key:"X-Content-Type-Options",value:"nosniff"}]}];},
};
export default config;
