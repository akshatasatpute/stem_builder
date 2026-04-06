FROM node:20-alpine

WORKDIR /app

# better-sqlite3 compiles on install
RUN apk add --no-cache python3 make g++

COPY package*.json ./
# Full install: vite + esbuild (devDependencies) are required for `npm run build`
RUN npm ci

COPY . .
RUN npm run build
RUN npm prune --omit=dev && npm cache clean --force

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/server.mjs"]
