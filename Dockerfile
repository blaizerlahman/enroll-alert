FROM golang:1.24 AS backend-build

WORKDIR /src

COPY backend/go.* ./
RUN go mod download

COPY backend/ .
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/enrollalert ./cmd

FROM node:20-alpine AS frontend-build

WORKDIR /app

COPY frontend/package*.json ./
COPY frontend/tsconfig.json   ./
COPY frontend/next-env.d.ts   ./

RUN npm ci

COPY frontend/ .

ENV NEXT_FONT_IGNORE_DOWNLOAD_ERRORS=true \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build && npm prune --production

FROM public.ecr.aws/amazonlinux/amazonlinux:2023

COPY --from=backend-build  /bin/enrollalert   /usr/local/bin/enrollalert
COPY --from=frontend-build /app/.next         /srv/app/.next
COPY --from=frontend-build /app/public        /srv/app/public

WORKDIR /
ENV PORT=3000
EXPOSE 3000

ENTRYPOINT ["/usr/bin/env", "-S", "sh", "-c"]
CMD ["enrollalert & npx serve -s /srv/app -l 3000"]

