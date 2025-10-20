FROM node:18

# Optional: Fix for lightningcss
RUN apt-get update && apt-get install -y libc6

WORKDIR /app

COPY package*.json ./
COPY .env.local .env.local


# install dependencies including lightningcss binary
RUN npm install

COPY frontend/. .

# build
RUN npm run build

EXPOSE 3000

# change to production mode if needed:
CMD ["npm", "run", "start"]
