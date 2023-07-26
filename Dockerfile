FROM willprice/nvidia-ffmpeg:latest
WORKDIR /app

# Install dependencies.
RUN apt-get update -y && \
    apt-get install curl -y

# Install node.
RUN curl -sL https://deb.nodesource.com/setup_16.x -o nodesource_setup.sh && \
    bash nodesource_setup.sh && \
    apt-get install nodejs -y && \
    npm install yarn -g

# Run API.
ENTRYPOINT ["yarn", "dev"]