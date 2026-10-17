FROM node:22-alpine
ENV NODE_ENV=production TZ=Africa/Abidjan
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
