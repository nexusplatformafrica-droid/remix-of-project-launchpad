# Runs the relay on Google Cloud Run, Render, Koyeb or any Docker host.
FROM node:20-alpine
WORKDIR /app
COPY package.json index.js ./
ENV PORT=8080
EXPOSE 8080
CMD ["node", "index.js"]
