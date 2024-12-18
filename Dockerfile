FROM node:22-alpine

RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app
WORKDIR /home/node/app

COPY --chown=node:node ./package*.json ./ 

USER node

RUN npm install

COPY --chown=node:node ./prisma ./prisma
RUN npx prisma generate

COPY --chown=node:node . .
EXPOSE 4000

CMD ["npm", "run", "dev"]
