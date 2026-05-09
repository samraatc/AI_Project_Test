FROM nginx:alpine
# Copy config files directly into the image - avoids Windows volume mount issues
COPY nginx.conf  /etc/nginx/nginx.conf
COPY proxy_params /etc/nginx/proxy_params
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
