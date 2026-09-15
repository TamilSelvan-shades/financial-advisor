# Use official Node.js image
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package files from the frontend directory
COPY frontend/package.json frontend/package-lock.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the frontend code
COPY frontend/ ./

# Build the Next.js application
RUN npm run build

# Expose Next.js default port
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start"]