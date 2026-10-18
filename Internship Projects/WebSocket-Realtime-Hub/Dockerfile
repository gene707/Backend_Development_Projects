FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3003
ENV NODE_ENV=production
ENV PORT=3003

CMD ["node", "src/server.js"]
