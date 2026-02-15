# =============================================
# Stage 1: Build
# =============================================
FROM node:20-alpine AS builder

# Install native dependencies for canvas & bcrypt
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev \
    librsvg-dev \
    pixman-dev

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# =============================================
# Stage 2: Production
# =============================================
FROM node:20-alpine

# Runtime native libraries for canvas
RUN apk add --no-cache \
    cairo \
    pango \
    jpeg \
    giflib \
    librsvg \
    pixman

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN apk add --no-cache python3 make g++ \
    cairo-dev pango-dev jpeg-dev giflib-dev librsvg-dev pixman-dev \
    && npm ci --omit=dev \
    && apk del python3 make g++ \
    cairo-dev pango-dev jpeg-dev giflib-dev librsvg-dev pixman-dev

# Copy built application
COPY --from=builder /app/dist ./dist

# Copy migrations (needed for runtime migration execution)
COPY --from=builder /app/migrations ./migrations

# Copy scripts
COPY --from=builder /app/scripts ./scripts

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3000/api/v1/health || exit 1

CMD ["node", "dist/app.js"]
