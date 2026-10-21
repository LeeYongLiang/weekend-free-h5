FROM node:18-alpine

WORKDIR /app

COPY package.json server.js ./
COPY server ./server
COPY public ./public

ENV NODE_ENV=production \
    PORT=8077 \
    HOST=0.0.0.0 \
    DATA_FILE=/data/store.json

RUN mkdir -p /data && chown node:node /data

USER node

EXPOSE 8077

CMD ["node", "server.js"]