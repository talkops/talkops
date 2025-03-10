FROM node:23.9-slim AS base
ENV NODE_NO_WARNINGS=1
RUN npm install -g pm2
RUN mkdir /app && chown node:node /app
ENV PORT=80
EXPOSE $PORT
CMD ["pm2-runtime", "ecosystem.config.cjs" ]
WORKDIR /app
ENV DEFAULT_NAME=TalkOps

FROM base AS dev
USER node
VOLUME [ "/app" ]

FROM base
COPY ecosystem.config.cjs index.mjs package.json ./
RUN npm install --omit=dev
ENV GATEWAY_URL=wss://ebfaa96d.talkops.app
ENV PUBLISHER_URL=https://b62b3726.talkops.app
USER node
