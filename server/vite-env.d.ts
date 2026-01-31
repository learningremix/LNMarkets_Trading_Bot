/// <reference types="vite/client" />
import type { ServerBuild } from 'react-router';

declare module 'virtual:react-router/server-build' {
  export const entry: ServerBuild['entry'];
  export const routes: ServerBuild['routes'];
  export const assets: ServerBuild['assets'];
  export const publicPath: ServerBuild['publicPath'];
  export const basename: ServerBuild['basename'];
  export const isSpaMode: ServerBuild['isSpaMode'];
  export const future: ServerBuild['future'];
  export const mode: ServerBuild['mode'];
  export const assetsBuildDirectory: ServerBuild['assetsBuildDirectory'];
  export const ssr: ServerBuild['ssr'];
}
