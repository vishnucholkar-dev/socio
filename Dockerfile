FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --no-frozen-lockfile
COPY . .
# Ensure apartment_seed.json exists in clean container clones
RUN node -e "if (!require('node:fs').existsSync('./src/data/apartment_seed.json')) require('node:fs').copyFileSync('./src/data/apartment_seed.template.json', './src/data/apartment_seed.json')"
RUN pnpm build
# Copy index.html and static assets into dist for nginx, and ensure dist/dist alias exists
RUN cp index.html dist/ 2>/dev/null || true
RUN cp -r public/* dist/ 2>/dev/null || true
RUN mkdir -p dist/dist && cp dist/bundle.esm.js dist/dist/bundle.esm.js

FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
