# Multi-stage build for Go server + static UI
FROM golang:1.22-alpine AS build
WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/todo-service ./

FROM alpine:3.19
RUN adduser -D -H -u 10001 appuser
WORKDIR /srv
COPY --from=build /out/todo-service /usr/local/bin/todo-service
COPY web ./web
USER appuser
ENV PORT=8000
EXPOSE 8000
ENTRYPOINT ["/usr/local/bin/todo-service"]
