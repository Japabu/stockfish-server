FROM node:22-alpine3.21 AS builder
WORKDIR /app
COPY package*.json .
RUN npm install
COPY . .
RUN npx @vercel/ncc build

FROM node:22-alpine3.21
WORKDIR /app
COPY bin/ ./bin/
COPY --from=builder /app/dist/index.mjs index.mjs
CMD ["node", "index.mjs"]