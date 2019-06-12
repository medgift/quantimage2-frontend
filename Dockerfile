FROM node:10
MAINTAINER Roger Schaer

# Define app folder
WORKDIR /usr/src/app

# Copy dependency files
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn

# Copy source code
COPY . .

# Start app
CMD ["yarn", "start"]