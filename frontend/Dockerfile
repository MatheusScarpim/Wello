# syntax=docker/dockerfile:1

ARG NODE_VERSION=20.9.0

FROM node:${NODE_VERSION}-alpine as deps

WORKDIR /usr/src/app

COPY package.json package-lock.json* pnpm-lock.yaml* ./

RUN if [ -f pnpm-lock.yaml ]; then npm install -g pnpm@8.15.5 && pnpm install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci; \
    else npm install; fi

FROM deps as build

ARG VITE_API_URL=http://localhost:8091
ENV VITE_API_URL=$VITE_API_URL

COPY . .

RUN npm run build:docker

FROM node:${NODE_VERSION}-alpine as final

WORKDIR /usr/src/app

COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist
COPY package.json ./

EXPOSE 4176

CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "4176"]


