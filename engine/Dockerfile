# syntax=docker/dockerfile:1

ARG NODE_VERSION=20.9.0
ARG PNPM_VERSION=8.15.5

FROM node:${NODE_VERSION}-alpine as base

WORKDIR /usr/src/app

RUN --mount=type=cache,target=/root/.npm \
    npm install -g pnpm@${PNPM_VERSION}

FROM base as deps

COPY package.json pnpm-lock.yaml ./

ENV PUPPETEER_SKIP_DOWNLOAD="true"

RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

FROM deps as build

COPY . .

RUN pnpm run build

FROM base as final

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true

ENV NXZAP_LITE=false
ENV NXZAP_WPP=true
ENV URL_WEBHOOK_MENSAGENS="https://750d-2804-14c-5783-90a2-742a-5b65-2074-215.ngrok-free.app/api/v1/webhooks/atendimento/mensagens"
ENV DB_NAME='welloDataBase2'
ENV TOKEN_META="Bearer EAAMUxVuenhgBOwo6hyvr7xhr3lbF7HtIoGEbSxlZAfgM8g5MbpxBaUGXXrjGZA9zOhZA8cZADFLvdv0zYwEAODKUeCrcOScxITZC0AHBkJF6VeZBVXMuJw3LB3KZBjZAkFLp7FEnyZAArmMXm3NnDsruS55swSMZCj3QCzp1T5B7Y2HZANggoMqfUjZBgTjBswO5V7MnowZDZD"
ENV CODE_META=317541784785494
ENV URL_META=https://graph.facebook.com/v21.0/
ENV TELEGRAM_BOT_TOKEN='6728340092:AAEHNLaBGyxbgd-F8Vhzp58j9iYfRkaOMPs'
ENV PORT=8091
ENV BOT_IDENTIFIER='coopluiza'
ENV NODE_ENV='production'
ENV BOT_SYSTEM="wello"
ENV BOT_NAME='wello'
ENV BOT_VERSION='1.0.3'
ENV BOT_DESCRIPTION='Bot de atendimento'
ENV BOT_AUTHOR='Scarpins'
ENV DB_HOST='localhost'
ENV DB_PORT='27018'
ENV DB_URL='mongodb://mongodb:27018/'
ENV WHATSAPP_DEVICE_NAME='Testing_Nxzap'
ENV WHATSAPP_DEVICE_ID='1'
ENV FACEBOOK_PAGE_ID='138522866009140'
ENV FACEBOOK_APP_ID='138522866009140'
ENV FACEBOOK_APP_SECRET='138522866009140'
ENV INSTAGRAM_PAGE_ID='138522866009140'
ENV INSTAGRAM_APP_ID='138522866009140'
ENV INSTAGRAM_APP_SECRET='138522866009140'
ENV TWITTER_PAGE_ID='138522866009140'
ENV TWITTER_APP_ID='138522866009140'
ENV TWITTER_APP_SECRET='138522866009140'
ENV META_PAGE_ID='138522866009140'
ENV META_APP_ID='138522866009140'
ENV META_APP_SECRET='138522866009140'

ENV CHROME_BIN="/usr/bin/chromium-browser" \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD="true"
RUN set -x \
    && apk update \
    && apk upgrade \
    && apk add --no-cache \
    udev \
    ttf-freefont \
    chromium \
    ffmpeg \
    dos2unix

RUN echo "kernel.unprivileged_userns_clone = 1" >> /etc/sysctl.conf

RUN sysctl -p

COPY --from=build /usr/src/app/remove_singleton_lock.sh /usr/src/app/
RUN dos2unix /usr/src/app/remove_singleton_lock.sh && chmod +x /usr/src/app/remove_singleton_lock.sh

RUN chown -R node:node /usr/src/app

RUN mkdir -p /usr/src/app/tokens && chown -R node:node /usr/src/app/tokens

USER node

COPY package.json ./

COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/scripts ./scripts

EXPOSE ${PORT}

CMD ["/bin/sh", "-c", "/usr/src/app/remove_singleton_lock.sh && node ./dist/new_server.cjs"]

