// ============================================================
//  app.config.js — ajustes dinámicos encima de app.json
// ============================================================
// google-services.json NO va al repositorio (está en .gitignore).
// En el servidor de EAS Build llega como variable de entorno de
// archivo (GOOGLE_SERVICES_JSON, visibilidad "secret"): aquí le
// decimos a Expo que use esa copia. En el PC local, donde el archivo
// sí existe, se usa el de la carpeta.

module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON || './google-services.json',
  },
});
