FROM node:16.13.1-alpine

# add a user to not run with root
RUN addgroup exporter && adduser --ingroup exporter --gecos "" --disabled-password exporter

# set the working directory
WORKDIR /home/exporter

# copy the source files
COPY . .

# install the source files
RUN npm install

# set the user
USER exporter

# start the exporter
CMD [ "npm", "start"]