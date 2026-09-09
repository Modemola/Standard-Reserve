/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@standard-law/engine",
    "@standard-law/params",
    "@standard-law/sentinel",
    "@standard-law/desk",
  ],
  async redirects() {
    // Charter ids are "c-0042"; people (and the whitepaper's own prose) write
    // "0042". Alias the bare-digits form onto the canonical id.
    return [{ source: "/bank/:id(\\d+)", destination: "/bank/c-:id", permanent: false }];
  },
  webpack: (config) => {
    // Workspace packages use NodeNext-style relative imports ("./foo.js"
    // resolving to "./foo.ts"); teach webpack the same extension mapping.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
