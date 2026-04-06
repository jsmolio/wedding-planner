FROM python:3.12-slim

WORKDIR /app

# Install the package
COPY pyproject.toml .
COPY wedding_agent/ wedding_agent/
COPY knowledge/ knowledge/
COPY evals/ evals/

RUN pip install --no-cache-dir -e .

# Expose the FastAPI port
EXPOSE 8000

CMD ["python", "-m", "wedding_agent.server"]
