# syntax=docker/dockerfile:1

# =============================================================================
# DOCKERFILE - MÓDULO CONTABLE (NEXT.JS 16 + REACT 19)
# Multi-stage build optimizado con salida standalone (~150MB)
# =============================================================================

# 1. Base Node.js
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@12.3.4 --activate
RUN apk add --no-cache libc6-compat

# 2. Dependencias
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
RUN pnpm install --frozen-lockfile --dangerously-allow-all-builds

# 3. Compilación
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN pnpm run build

# 4. Servidor de Producción (Runner)
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Usuario seguro no-root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copiar archivos estáticos y compilados en modo standalone
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
