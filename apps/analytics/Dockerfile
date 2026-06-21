FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY apps/analytics/requirements.txt ./requirements.txt

RUN pip install --no-cache-dir -r requirements.txt

COPY apps/analytics/app ./app

EXPOSE 8000

# Em dev o docker-compose sobrepõe este CMD (uvicorn --reload com volume montado);
# este CMD garante que a imagem arranca a app fora do compose / em produção.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
