# syntax=docker/dockerfile:1
FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
# Puerto interno fijo (para simplificar el mapeo)
ENV PORT=4000
ENV HOST=0.0.0.0

EXPOSE 4000

# Debes tener "start": "node src/server.js" en package.json
CMD ["npm", "start"]






