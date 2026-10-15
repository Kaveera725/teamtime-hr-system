# Build stage using Node.js
FROM node:22-alpine AS build
WORKDIR /app

# Install dependencies first for efficient layer caching
COPY package*.json ./
RUN npm install

# Copy source files and build production bundle
COPY . .
RUN npm run build

# Production runtime stage using Nginx
FROM nginx:alpine AS final
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
