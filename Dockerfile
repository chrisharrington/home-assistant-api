FROM oven/bun:latest
WORKDIR /app

ENTRYPOINT ["bun", "--watch", "app.ts"]