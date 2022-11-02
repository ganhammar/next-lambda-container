FROM node:16-alpine AS build
WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn --frozen-lockfile

COPY . .

RUN yarn build

FROM public.ecr.aws/lambda/nodejs:16 AS run
WORKDIR /app

ENV NODE_ENV production

COPY --from=build /app/public ./public

COPY ./handler.js ./
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

EXPOSE 80

ENV PORT 80

ENTRYPOINT ["node", "handler.js"]