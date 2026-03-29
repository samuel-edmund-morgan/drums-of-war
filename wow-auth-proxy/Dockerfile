FROM python:3.12-alpine

WORKDIR /app
COPY auth_proxy.py .

EXPOSE 3724

CMD ["python", "-u", "auth_proxy.py"]
