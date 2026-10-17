const config = {
  poweredByHeader: false,
  distDir: process.env.FOOTBALL_BUILD_CHECK === "1" ? ".next-check" : ".next",
  async rewrites() {
    return [
      { source: "/api/:path*", destination: "http://127.0.0.1:3101/:path*" },
    ];
  },
};
export default config;
