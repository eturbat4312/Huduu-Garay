export {};

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    google: any;
  }
}

// 🟢 maplibre-gl module-ийн type зарлал
declare module "maplibre-gl";
