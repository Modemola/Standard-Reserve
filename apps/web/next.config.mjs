/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@standard-law/engine", "@standard-law/params"],
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
