FROM node:argon

RUN mkdir -p /output
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY package.json .
RUN npm install

COPY * ./

ENTRYPOINT ["node", "export.js"]
