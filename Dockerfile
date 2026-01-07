# Node base image
FROM node:20-alpine

# App directory
WORKDIR /app

# Dependencies install
COPY package*.json ./
RUN npm install --production

# Copy app code
COPY . .

# Port
ENV PORT=8080
EXPOSE 8080

# Start command
CMD ["node", "server.js"]
