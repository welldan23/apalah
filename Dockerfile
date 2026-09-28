# Image produksi Kostera untuk VPS (dipakai deploy/vps/compose.yaml). Satu image menjalankan
# `next start` sekaligus skrip operasional (db:migrate, cek:produksi, platform:admin, meta:template).

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Pembagian domain (kostera.id vs app.kostera.id) dihitung saat build — lihat src/lib/rute-domain.ts.
ARG APP_URL
ARG LANDING_URL
RUN APP_URL="$APP_URL" LANDING_URL="$LANDING_URL" npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
LABEL kostera.app="1"
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
COPY --from=build --chown=node:node /app ./
USER node
EXPOSE 3000
CMD ["node_modules/.bin/next", "start"]
