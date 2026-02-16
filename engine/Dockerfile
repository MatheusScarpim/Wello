# syntax=docker/dockerfile:1

ARG NODE_VERSION=20.9.0
ARG PNPM_VERSION=8.15.5

FROM node:${NODE_VERSION}-alpine as base

WORKDIR /usr/src/app

RUN --mount=type=cache,target=/root/.npm \
    npm install -g pnpm@${PNPM_VERSION}

FROM base as deps

# Evita download do Chromium no postinstall do Puppeteer
# IMPORTANTE: Definir ANTES de copiar package.json
ENV PUPPETEER_SKIP_DOWNLOAD="true"
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD="true"
ENV npm_config_puppeteer_skip_download="true"

COPY package.json pnpm-lock.yaml ./

RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

FROM deps as build

COPY . .

RUN pnpm run build

FROM base as final

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true

# Variaveis de aplicacao vem do env_file no docker-compose.yml
# NAO adicione secrets ou config aqui

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

