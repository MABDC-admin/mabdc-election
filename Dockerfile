FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx vite build
EXPOSE 4000
ENV PORT=4000
ENV NODE_ENV=production
CMD ["node", "server/index.js"]