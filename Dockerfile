## build Go backend
FROM golang:1.24 AS backend-build
WORKDIR /src

COPY backend/go.* ./
RUN go mod download

COPY backend/ .
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/enrollalert ./cmd

## build Next frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app

COPY frontend/package*.json ./
COPY frontend/tsconfig.json .
COPY frontend/next-env.d.ts .

RUN npm ci
COPY frontend/ .

ENV NEXT_FONT_IGNORE_DOWNLOAD_ERRORS=1 \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build && npm prune --production

## runtime
FROM public.ecr.aws/amazonlinux/amazonlinux:2023 AS runtime
WORKDIR /srv/app

RUN yum -y update && \
    yum -y install nodejs20 && \  
    yum clean all && \
    rm -rf /var/cache/yum

COPY --from=backend-build /bin/enrollalert /usr/local/bin/enrollalert
COPY --from=frontend-build /app/.next  ./.next
COPY --from=frontend-build /app/public ./public
COPY --from=frontend-build /app/package*.json ./
RUN npm install --omit=dev --ignore-scripts --prefer-offline

ENV PORT=3000
EXPOSE 3000

ENTRYPOINT ["/bin/sh","-c"]
CMD ["/usr/local/bin/enrollalert & npx next start -p $PORT"]
CMD ["sh","-c","enrollalert & npx next start -p $PORT"]

