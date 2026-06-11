# Use Node.js 20 slim image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy all application files (including local node_modules)
COPY . .

# Expose the application port (defaults to 3000)
EXPOSE 3000

# Start the application server
CMD ["node", "server.js"]
