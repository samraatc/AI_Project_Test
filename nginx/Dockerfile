FROM nginx:alpine
RUN apk add --no-cache curl wget
COPY nginx.conf      /etc/nginx/nginx.conf
COPY nginx-init.conf /etc/nginx/nginx-init.conf
COPY proxy_params    /etc/nginx/proxy_params
EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]
