FROM node:18-alpine
WORKDIR /usr/src/app

# install dependencies (this project has no external deps but keep safe path)
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install

COPY . .

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
