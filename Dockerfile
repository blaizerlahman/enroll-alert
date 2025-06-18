FROM golang:1.24 AS backend-build
WORKDIR /src
COPY backend/go.* ./
RUN go mod download
COPY backend .
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/enrollalert ./cmd

FROM node:20-alpine AS frontend-build
WORKDIR /app

COPY frontend/package*.json ./
ENV NODE_ENV=production
RUN npm ci --omit=dev

COPY frontend .
RUN npm run build && npm prune --omit=dev && npm cache clean --force

FROM public.ecr.aws/amazonlinux/amazonlinux:2023 AS runtime
WORKDIR /srv/app

RUN dnf -y install nodejs20 curl --setopt=install_weak_deps=False && dnf clean all

COPY --from=backend-build  /bin/enrollalert        /usr/local/bin/

COPY --from=frontend-build /app/.next              ./.next
COPY --from=frontend-build /app/public             ./public
COPY --from=frontend-build /app/node_modules       ./node_modules
COPY --from=frontend-build /app/package*.json      ./

ENV NODE_ENV=production PORT=3000
EXPOSE 3000
ENTRYPOINT ["/bin/sh","-c"]
CMD "/usr/local/bin/enrollalert & npx next start -p $PORT"

