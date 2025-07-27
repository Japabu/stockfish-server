FROM node:22-alpine3.21 AS builder
WORKDIR /app
COPY package*.json .
RUN npm install
COPY . .
RUN npx @vercel/ncc build

FROM node:22-alpine3.21
WORKDIR /app
COPY --from=builder /app/dist/index.mjs index.mjs
COPY bin/ ./bin/
CMD ["node", "index.mjs"]