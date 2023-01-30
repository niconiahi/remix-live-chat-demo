/* eslint-disable camelcase */
/** @type {import('@remix-run/dev').AppConfig} */
export default {
  ignoredRouteFiles: ["**/.*"],
  serverDependenciesToBundle: [/~/],
  serverModuleFormat: "esm",
  publicPath: "/_static/build/",
  serverBuildPath: "src/remix.mjs",
  future: {
    v2_routeConvention: true,
  },
};
