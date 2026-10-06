FROM node:22-slim

RUN corepack enable

WORKDIR /workspace

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/web/package.json apps/web/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/api-client/package.json packages/api-client/package.json

RUN pnpm install

COPY . .

WORKDIR /workspace/apps/web

EXPOSE 5173

CMD ["pnpm", "exec", "vite", "--host"]
