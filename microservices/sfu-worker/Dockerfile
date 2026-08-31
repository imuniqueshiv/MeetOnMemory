FROM node:18-bullseye

# Install tools for building Mediasoup (Python, C++)
RUN apt-get update && \
    apt-get install -y python3 python3-pip build-essential && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 4001
# Expose Mediasoup UDP/TCP ports for WebRTC
EXPOSE 2000-2020/udp
EXPOSE 2000-2020/tcp

CMD ["npm", "start"]
